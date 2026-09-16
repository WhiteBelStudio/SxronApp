const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let apiProcess = null;
let updateCheckStarted = false;

function registerWindowsAssociations() {
  if (process.platform !== 'win32' || isDev) return;

  try {
    app.setAsDefaultProtocolClient('sxron');
  } catch (error) {
    console.warn('SXRON protocol registration:', error?.message || error);
  }
}

function getApiExecutable() {
  if (process.platform === 'win32') {
    return path.join(process.resourcesPath, 'backend', 'sxron-api', 'sxron-api.exe');
  }

  return path.join(process.resourcesPath, 'backend', 'sxron-api', 'sxron-api');
}

function waitForApi(timeoutMs = 45000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;

    const finishError = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const retry = () => {
      if (settled) return;
      if (Date.now() - started >= timeoutMs) {
        finishError(new Error('SXRON API не запустился за 45 секунд. Если Windows Defender или другой антивирус показал предупреждение, разрешите SXRON Marketplace.'));
        return;
      }
      setTimeout(check, 300);
    };

    const check = () => {
      if (settled) return;

      const request = http.get('http://127.0.0.1:8000/health', (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          settled = true;
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

    check();
  });
}

async function startApi() {
  if (isDev) return;

  const executable = getApiExecutable();
  const apiDirectory = path.dirname(executable);
  const dataDir = path.join(app.getPath('userData'), 'data');

  console.log('SXRON API executable:', executable);
  console.log('SXRON API working directory:', apiDirectory);
  console.log('SXRON API data directory:', dataDir);

  apiProcess = spawn(executable, [], {
    cwd: apiDirectory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SXRON_DATA_DIR: dataDir,
      SXRON_CORS_ORIGINS: '*',
      PYTHONUNBUFFERED: '1',
    },
  });

  let processError = null;
  let processExited = false;
  let exitCode = null;
  let exitSignal = null;

  apiProcess.stdout?.on('data', (data) => {
    console.log(`[SXRON API] ${data.toString().trim()}`);
  });

  apiProcess.stderr?.on('data', (data) => {
    console.warn(`[SXRON API] ${data.toString().trim()}`);
  });

  apiProcess.on('error', (error) => {
    processError = error;
    console.error('SXRON API process error:', error);
  });

  apiProcess.on('exit', (code, signal) => {
    processExited = true;
    exitCode = code;
    exitSignal = signal;
    console.log(`SXRON API stopped: code=${code}, signal=${signal}`);
    apiProcess = null;
  });

  try {
    await waitForApi();
  } catch (error) {
    if (processError) {
      throw new Error(`Не удалось запустить SXRON API: ${processError.message}`);
    }

    if (processExited) {
      throw new Error(`SXRON API завершился до запуска: code=${exitCode}, signal=${exitSignal ?? 'none'}. Проверьте Windows Defender/антивирус и наличие файлов backend/sxron-api.`);
    }

    throw error;
  }
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

function configureAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.fullChangelog = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('SXRON updater: проверка обновлений...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`SXRON updater: найдено обновление ${info.version}, начинается загрузка.`);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(
      `SXRON updater: ${Math.round(progress.percent)}% ` +
        `(${Math.round(progress.bytesPerSecond / 1024)} KB/s)`,
    );
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`SXRON updater: установлена актуальная версия ${info.version}.`);
  });

  autoUpdater.on('error', (error) => {
    console.warn('SXRON updater error:', error?.message || error);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`SXRON updater: обновление ${info.version} скачано и готово к установке.`);

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Обновление SXRON',
      message: `Обновление SXRON Marketplace ${info.version} уже скачано.`,
      detail: 'После перезапуска новая версия автоматически заменит старые файлы приложения. Ваши данные сохранятся.',
      buttons: ['Перезапустить сейчас', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

async function setupAutoUpdater() {
  if (isDev || updateCheckStarted) return;

  updateCheckStarted = true;
  configureAutoUpdater();

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.warn('SXRON updater check:', error?.message || error);
  }
}

app.whenReady().then(async () => {
  registerWindowsAssociations();

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
