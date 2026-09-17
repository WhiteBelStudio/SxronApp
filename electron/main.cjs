const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let apiProcess = null;
let updateCheckStarted = false;
let mainWindow = null;
let updateAvailable = false;
let updateDownloaded = false;
const CURRENT_VERSION = app.getVersion();
const GITHUB_RELEASE_OWNER = 'WhiteBelStudio';
const GITHUB_RELEASE_REPO = 'SxronApp';

function registerWindowsAssociations() {
  if (process.platform !== 'win32' || isDev) return;
  try { app.setAsDefaultProtocolClient('sxron'); } catch (error) {
    console.warn('SXRON protocol registration:', error?.message || error);
  }
}

function getApiExecutable() {
  return process.platform === 'win32'
    ? path.join(process.resourcesPath, 'backend', 'sxron-api', 'sxron-api.exe')
    : path.join(process.resourcesPath, 'backend', 'sxron-api', 'sxron-api');
}

function getApiLogPath() {
  return path.join(app.getPath('userData'), 'sxron-api.log');
}

function appendApiLog(text) {
  try { fs.appendFileSync(getApiLogPath(), text, 'utf8'); }
  catch (error) { console.warn('SXRON API log write:', error?.message || error); }
}

function waitForApi(timeoutMs = 45000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const retry = () => {
      if (settled) return;
      if (Date.now() - started >= timeoutMs) {
        fail(new Error('SXRON API не запустился за 45 секунд. Подробный лог: ' + getApiLogPath()));
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
        } else retry();
      });
      request.on('error', retry);
      request.setTimeout(1000, () => { request.destroy(); retry(); });
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
  appendApiLog(`Executable: ${executable}\nWorking directory: ${apiDirectory}\nData directory: ${dataDir}\n`);

  if (!fs.existsSync(executable)) {
    throw new Error(`Файл SXRON API не найден:\n${executable}`);
  }

  apiProcess = spawn(executable, [], {
    cwd: apiDirectory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SXRON_DATA_DIR: dataDir, SXRON_CORS_ORIGINS: '*', PYTHONUNBUFFERED: '1' },
  });

  let processError = null;
  let processExited = false;
  let exitCode = null;
  let exitSignal = null;
  let stderrText = '';
  let stdoutText = '';

  apiProcess.stdout?.on('data', (data) => {
    const text = data.toString(); stdoutText += text; appendApiLog(`[stdout] ${text}`); console.log(`[SXRON API] ${text.trim()}`);
  });
  apiProcess.stderr?.on('data', (data) => {
    const text = data.toString(); stderrText += text; appendApiLog(`[stderr] ${text}`); console.warn(`[SXRON API] ${text.trim()}`);
  });
  apiProcess.on('error', (error) => { processError = error; appendApiLog(`[process error] ${error.stack || error}\n`); });
  apiProcess.on('exit', (code, signal) => {
    processExited = true; exitCode = code; exitSignal = signal;
    appendApiLog(`[exit] code=${code}, signal=${signal ?? 'none'}\n`); apiProcess = null;
  });

  try {
    await waitForApi();
  } catch (error) {
    const details = stderrText.trim() || stdoutText.trim() || 'API не вернул текст ошибки.';
    if (processError) throw new Error(`Не удалось запустить SXRON API: ${processError.message}\n\nЛог:\n${details}`);
    if (processExited) throw new Error(`SXRON API завершился до запуска: code=${exitCode}, signal=${exitSignal ?? 'none'}.\n\nПричина API:\n${details}\n\nПолный лог:\n${logPath}`);
    throw new Error(`${error.message}\n\nПолный лог:\n${logPath}`);
  }
}

function stopApi() {
  if (!apiProcess || apiProcess.killed) return;
  try { apiProcess.kill(); } catch (error) { console.warn('SXRON API stop:', error?.message || error); }
  apiProcess = null;
}

function sendUpdateUi(event, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const encoded = JSON.stringify({ event, ...payload }).replace(/</g, '\\u003c');
  mainWindow.webContents.executeJavaScript(
    `window.dispatchEvent(new CustomEvent('sxron-updater', { detail: ${encoded}, bubbles: false }));`
  ).catch(() => {});
}

function configureAutoUpdater() {
  if (updateCheckStarted || isDev) return;
  updateCheckStarted = true;

  // Critical fix: never download/install silently. The renderer controls the mandatory update flow.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.fullChangelog = true;

  autoUpdater.on('checking-for-update', () => sendUpdateUi('checking', { version: CURRENT_VERSION }));

  autoUpdater.on('update-available', (info) => {
    updateAvailable = true;
    updateDownloaded = false;
    sendUpdateUi('update-required', {
      currentVersion: CURRENT_VERSION,
      targetVersion: info.version,
      releaseName: info.releaseName || `SXRON Marketplace ${info.version}`,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateUi('download-progress', {
      percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      bytesPerSecond: progress.bytesPerSecond || 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    sendUpdateUi('update-ready', {
      currentVersion: CURRENT_VERSION,
      targetVersion: info.version,
      percent: 100,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateUi('up-to-date', { currentVersion: CURRENT_VERSION, targetVersion: info.version || CURRENT_VERSION });
  });

  autoUpdater.on('error', (error) => {
    console.warn('SXRON updater error:', error?.message || error);
    sendUpdateUi('update-error', { message: error?.message || String(error), currentVersion: CURRENT_VERSION });
  });
}

async function checkForUpdatesManually() {
  if (isDev) {
    sendUpdateUi('update-error', { message: 'Проверка обновлений доступна в установленной версии приложения.' });
    return;
  }
  configureAutoUpdater();
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { sendUpdateUi('update-error', { message: error?.message || String(error) }); }
}

async function startUpdateDownload() {
  if (!updateAvailable || updateDownloaded) {
    if (updateDownloaded) sendUpdateUi('update-ready', { currentVersion: CURRENT_VERSION, percent: 100 });
    return;
  }
  try {
    sendUpdateUi('download-start', { currentVersion: CURRENT_VERSION });
    await autoUpdater.downloadUpdate();
  } catch (error) {
    sendUpdateUi('update-error', { message: error?.message || String(error), currentVersion: CURRENT_VERSION });
  }
}

function installDownloadedUpdate() {
  if (!updateDownloaded) return;
  // v26 API: explicit install after update-downloaded.
  autoUpdater.quitAndInstall(false, true);
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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow = win;

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('SXRON renderer load failed:', errorCode, errorDescription);
  });

  if (isDev) await win.loadURL('http://localhost:5173');
  else await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'sxron://check-updates') { checkForUpdatesManually(); return { action: 'deny' }; }
    if (url === 'sxron://start-update') { startUpdateDownload(); return { action: 'deny' }; }
    if (url === 'sxron://install-update') { installDownloadedUpdate(); return { action: 'deny' }; }
    if (url === 'sxron://repair-current') { startUpdateDownload(); return { action: 'deny' }; }
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-finish-load', () => {
    sendUpdateUi('app-version', { version: CURRENT_VERSION });
    if (updateAvailable) {
      sendUpdateUi('update-required', { currentVersion: CURRENT_VERSION });
    }
  });

  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
}

async function setupAutoUpdater() {
  if (isDev) return;
  configureAutoUpdater();
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { console.warn('SXRON updater check:', error?.message || error); }
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error);
  });
});

app.on('before-quit', () => stopApi());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
