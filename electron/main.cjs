const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let apiProcess = null;

function getApiExecutable() {
  if (process.platform === 'win32') {
    return path.join(process.resourcesPath, 'backend', 'sxron-api.exe');
  }

  return path.join(process.resourcesPath, 'backend', 'sxron-api');
}

function waitForApi(timeoutMs = 15000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get('http://127.0.0.1:8000/health', (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      request.on('error', retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error('SXRON API не запустился вовремя'));
        return;
      }
      setTimeout(check, 250);
    };

    check();
  });
}

async function startApi() {
  if (isDev) return;

  const executable = getApiExecutable();
  const dataDir = path.join(app.getPath('userData'), 'data');

  apiProcess = spawn(executable, [], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SXRON_DATA_DIR: dataDir,
      SXRON_CORS_ORIGINS: 'http://127.0.0.1:8000,http://localhost:8000',
    },
  });

  apiProcess.stdout?.on('data', (data) => {
    console.log(`[SXRON API] ${data.toString().trim()}`);
  });

  apiProcess.stderr?.on('data', (data) => {
    console.warn(`[SXRON API] ${data.toString().trim()}`);
  });

  apiProcess.on('error', (error) => {
    console.error('SXRON API process error:', error);
  });

  apiProcess.on('exit', (code, signal) => {
    console.log(`SXRON API stopped: code=${code}, signal=${signal}`);
    apiProcess = null;
  });

  await waitForApi();
}

function stopApi() {
  if (!apiProcess || apiProcess.killed) return;

  try {
    apiProcess.kill();
  } catch (error) {
    console.warn('SXRON API stop:', error?.message || error);
  }

  apiProcess = null;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 700,
    title: 'SXRON Marketplace',
    backgroundColor: '#07090f',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('SXRON renderer load failed:', errorCode, errorDescription);
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
  } else {
    await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

async function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Обновление SXRON',
      message: 'Новая версия SXRON Marketplace уже скачана.',
      detail: 'Перезапустить приложение сейчас и установить обновление?',
      buttons: ['Перезапустить', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.warn('SXRON updater:', error?.message || error);
  }
}

app.whenReady().then(async () => {
  try {
    await startApi();
    await createWindow();
    await setupAutoUpdater();
  } catch (error) {
    console.error('SXRON startup failed:', error);
    await dialog.showMessageBox({
      type: 'error',
      title: 'SXRON Marketplace',
      message: 'Не удалось запустить SXRON Marketplace.',
      detail: error?.message || String(error),
    });
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    }
  });
});

app.on('before-quit', () => {
  stopApi();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
