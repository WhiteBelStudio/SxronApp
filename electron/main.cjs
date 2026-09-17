const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let apiProcess = null;
let updateCheckStarted = false;
let mainWindow = null;
const CURRENT_VERSION = app.getVersion();
const GITHUB_RELEASE_OWNER = 'WhiteBelStudio';
const GITHUB_RELEASE_REPO = 'SxronApp';

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

function getApiLogPath() {
  return path.join(app.getPath('userData'), 'sxron-api.log');
}

function appendApiLog(text) {
  try {
    fs.appendFileSync(getApiLogPath(), text, 'utf8');
  } catch (error) {
    console.warn('SXRON API log write:', error?.message || error);
  }
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
        finishError(new Error('SXRON API не запустился за 45 секунд. Подробный лог: ' + getApiLogPath()));
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
  const logPath = getApiLogPath();

  appendApiLog(`\n===== SXRON API START ${new Date().toISOString()} =====\n`);
  appendApiLog(`Executable: ${executable}\n`);
  appendApiLog(`Working directory: ${apiDirectory}\n`);
  appendApiLog(`Data directory: ${dataDir}\n`);

  if (!fs.existsSync(executable)) {
    const message = `Файл SXRON API не найден:\n${executable}`;
    appendApiLog(message + '\n');
    throw new Error(message);
  }

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
  let stderrText = '';
  let stdoutText = '';

  apiProcess.stdout?.on('data', (data) => {
    const text = data.toString();
    stdoutText += text;
    appendApiLog(`[stdout] ${text}`);
    console.log(`[SXRON API] ${text.trim()}`);
  });

  apiProcess.stderr?.on('data', (data) => {
    const text = data.toString();
    stderrText += text;
    appendApiLog(`[stderr] ${text}`);
    console.warn(`[SXRON API] ${text.trim()}`);
  });

  apiProcess.on('error', (error) => {
    processError = error;
    appendApiLog(`[process error] ${error.stack || error}\n`);
    console.error('SXRON API process error:', error);
  });

  apiProcess.on('exit', (code, signal) => {
    processExited = true;
    exitCode = code;
    exitSignal = signal;
    appendApiLog(`[exit] code=${code}, signal=${signal ?? 'none'}\n`);
    console.log(`SXRON API stopped: code=${code}, signal=${signal}`);
    apiProcess = null;
  });

  try {
    await waitForApi();
  } catch (error) {
    const details = stderrText.trim() || stdoutText.trim() || 'API не вернул текст ошибки.';

    if (processError) {
      throw new Error(`Не удалось запустить SXRON API: ${processError.message}\n\nЛог:\n${details}`);
    }

    if (processExited) {
      throw new Error(
        `SXRON API завершился до запуска: code=${exitCode}, signal=${exitSignal ?? 'none'}.\n\nПричина API:\n${details}\n\nПолный лог:\n${logPath}`,
      );
    }

    throw new Error(`${error.message}\n\nПолный лог:\n${logPath}`);
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

function sendUpdateUi(event, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const encoded = JSON.stringify(payload).replace(/</g, '\\u003c');
  const script = `window.dispatchEvent(new CustomEvent('sxron-updater', { detail: ${encoded}, bubbles: false }));`;

  mainWindow.webContents.executeJavaScript(script).catch(() => {});
}

function getCurrentInstallerUrl() {
  return `https://github.com/${GITHUB_RELEASE_OWNER}/${GITHUB_RELEASE_REPO}/releases/download/v${CURRENT_VERSION}/SXRON-Marketplace-Setup-${CURRENT_VERSION}-x64.exe`;
}

function downloadFile(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Слишком много перенаправлений при загрузке установщика.'));
      return;
    }

    const client = url.startsWith('https://') ? https : http;
    const request = client.get(url, {
      headers: { 'User-Agent': 'SXRON-Marketplace-Updater' },
    }, (response) => {
      const status = response.statusCode || 0;

      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        downloadFile(new URL(response.headers.location, url).toString(), destination, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (status !== 200) {
        response.resume();
        reject(new Error(`GitHub вернул HTTP ${status}.`));
        return;
      }

      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      const file = fs.createWriteStream(destination);

      response.on('data', (chunk) => {
        received += chunk.length;
        const percent = total > 0 ? Math.min(100, (received / total) * 100) : 0;
        sendUpdateUi('download-progress', { percent, received, total });
      });

      response.on('error', (error) => {
        file.destroy();
        reject(error);
      });

      file.on('error', reject);
      file.on('finish', () => {
        file.close(() => resolve());
      });

      response.pipe(file);
    });

    request.on('error', reject);
    request.setTimeout(120000, () => {
      request.destroy(new Error('Загрузка установщика превысила лимит времени.'));
    });
  });
}

async function reinstallCurrentVersion() {
  if (isDev) {
    sendUpdateUi('repair-error', { message: 'Переустановка доступна в установленной версии SXRON.' });
    return;
  }

  if (process.platform !== 'win32') {
    sendUpdateUi('repair-error', { message: 'Переустановка текущей версии пока доступна только для Windows.' });
    return;
  }

  const installerPath = path.join(app.getPath('temp'), `SXRON-Marketplace-${CURRENT_VERSION}-repair.exe`);
  const url = getCurrentInstallerUrl();

  try {
    sendUpdateUi('repair-start', { version: CURRENT_VERSION, percent: 0 });
    await downloadFile(url, installerPath);

    if (!fs.existsSync(installerPath)) {
      throw new Error('Установщик не был сохранён на диске.');
    }

    sendUpdateUi('repair-ready', { version: CURRENT_VERSION, percent: 100 });

    const helperPath = path.join(app.getPath('temp'), `sxron-reinstall-${Date.now()}.cmd`);
    const pid = process.pid;
    const script = [
      '@echo off',
      'setlocal',
      `set "INSTALLER=${installerPath.replace(/"/g, '""')}"`,
      `set "APP_PID=${pid}"`,
      ':wait',
      'tasklist /FI "PID eq %APP_PID%" 2>NUL | find "%APP_PID%" >NUL',
      'if not errorlevel 1 (timeout /t 1 /nobreak >NUL & goto wait)',
      'timeout /t 1 /nobreak >NUL',
      'start "SXRON Installer" /wait "%INSTALLER%"',
      'del "%INSTALLER%" >NUL 2>&1',
      'del "%~f0" >NUL 2>&1',
    ].join('\r\n');

    fs.writeFileSync(helperPath, script, 'utf8');

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'SXRON — переустановка',
      message: `Файлы SXRON ${CURRENT_VERSION} готовы к переустановке.`,
      detail: 'Приложение сейчас закроется. Установщик заменит файлы текущей версии и снова запустит SXRON. Пользовательские данные сохранятся.',
      buttons: ['Переустановить сейчас', 'Отмена'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response !== 0) {
      try { fs.unlinkSync(installerPath); } catch {}
      try { fs.unlinkSync(helperPath); } catch {}
      sendUpdateUi('repair-cancelled');
      return;
    }

    sendUpdateUi('repair-installing', { version: CURRENT_VERSION, percent: 100 });
    spawn('cmd.exe', ['/d', '/c', 'start', '', '/b', helperPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();

    setTimeout(() => {
      app.quit();
    }, 300);
  } catch (error) {
    try { fs.unlinkSync(installerPath); } catch {}
    sendUpdateUi('repair-error', { message: error?.message || String(error) });
  }
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

  mainWindow = win;

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('SXRON renderer load failed:', errorCode, errorDescription);
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
  } else {
    await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'sxron://check-updates') {
      checkForUpdatesManually();
      return { action: 'deny' };
    }

    if (url === 'sxron://repair-current') {
      reinstallCurrentVersion();
      return { action: 'deny' };
    }

    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

function configureAutoUpdater() {
  if (updateCheckStarted) return;

  updateCheckStarted = true;
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

    if (BrowserWindow.getAllWindows().length > 0) {
      dialog.showMessageBox({
        type: 'info',
        title: 'SXRON — обновления',
        message: `У вас актуальная версия SXRON Marketplace ${info.version}.`,
        buttons: ['OK'],
      }).catch(() => {});
    }
  });

  autoUpdater.on('error', (error) => {
    console.warn('SXRON updater error:', error?.message || error);

    if (BrowserWindow.getAllWindows().length > 0) {
      dialog.showMessageBox({
        type: 'error',
        title: 'SXRON — обновления',
        message: 'Не удалось проверить обновления.',
        detail: error?.message || String(error),
        buttons: ['OK'],
      }).catch(() => {});
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`SXRON updater: обновление ${info.version} скачано и готово к установке.`);

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Обновление SXRON',
      message: `Обновление SXRON Marketplace ${info.version} уже скачано.`,
      detail: 'После перезапуска новая версия автоматически заменит файлы приложения. Пользовательские данные сохранятся.',
      buttons: ['Перезапустить сейчас', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

function checkForUpdatesManually() {
  if (isDev) {
    dialog.showMessageBox({
      type: 'info',
      title: 'SXRON — обновления',
      message: 'Проверка обновлений доступна в установленной версии приложения.',
      buttons: ['OK'],
    }).catch(() => {});
    return;
  }

  configureAutoUpdater();
  autoUpdater.checkForUpdates().catch((error) => {
    console.warn('SXRON manual update check:', error?.message || error);
  });
}

async function setupAutoUpdater() {
  if (isDev) return;
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
