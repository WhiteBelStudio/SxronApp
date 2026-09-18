const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const isDev = !app.isPackaged;
let apiProcess = null;
let mainWindow = null;
let updateCheckInProgress = false;
let latestRelease = null;

const CURRENT_VERSION = app.getVersion();
const GITHUB_OWNER = 'WhiteBelStudio';
const GITHUB_REPO = 'SxronApp';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

function readBuildInfo() {
  try {
    const file = path.join(app.getAppPath(), 'dist', 'build-info.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.warn('SXRON build-info:', error?.message || error);
  }
  return { version: CURRENT_VERSION, build: CURRENT_VERSION, commit: 'unknown', releaseTag: `v${CURRENT_VERSION}` };
}

const BUILD_INFO = readBuildInfo();

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

function getApiLogPath() { return path.join(app.getPath('userData'), 'sxron-api.log'); }
function appendApiLog(text) {
  try { fs.appendFileSync(getApiLogPath(), text, 'utf8'); }
  catch (error) { console.warn('SXRON API log write:', error?.message || error); }
}

function waitForApi(timeoutMs = 45000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error(String(error))); } };
    const retry = () => {
      if (settled) return;
      if (Date.now() - started >= timeoutMs) { fail(new Error('SXRON API не запустился за 45 секунд. Подробный лог: ' + getApiLogPath())); return; }
      setTimeout(check, 300);
    };
    const check = () => {
      if (settled) return;
      const request = http.get('http://127.0.0.1:8000/health', (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) { settled = true; resolve(); } else retry();
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
  if (!fs.existsSync(executable)) throw new Error(`Файл SXRON API не найден:\n${executable}`);

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
  apiProcess.stdout?.on('data', (data) => { const text = data.toString(); stdoutText += text; appendApiLog(`[stdout] ${text}`); });
  apiProcess.stderr?.on('data', (data) => { const text = data.toString(); stderrText += text; appendApiLog(`[stderr] ${text}`); });
  apiProcess.on('error', (error) => { processError = error; appendApiLog(`[process error] ${error.stack || error}\n`); });
  apiProcess.on('exit', (code, signal) => { processExited = true; exitCode = code; exitSignal = signal; appendApiLog(`[exit] code=${code}, signal=${signal ?? 'none'}\n`); apiProcess = null; });

  try { await waitForApi(); }
  catch (error) {
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
  mainWindow.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('sxron-updater', { detail: ${encoded}, bubbles: false }));`).catch(() => {});
}

function githubRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'SXRON-Marketplace-Updater',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          githubRequest(response.headers.location).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) { reject(new Error(`GitHub HTTP ${response.statusCode}`)); return; }
        try { resolve(JSON.parse(body)); } catch { reject(new Error('GitHub вернул некорректный JSON.')); }
      });
    });
    request.on('error', reject);
    request.setTimeout(15000, () => { request.destroy(new Error('Истекло время ожидания GitHub.')); });
  });
}

function parseVersion(version) {
  const match = String(version || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return String(left || '') === String(right || '') ? 0 : null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function findInstallerAsset(release, targetVersion) {
  const expected = `SXRON-Marketplace-Setup-${targetVersion}-x64.exe`;
  return (release.assets || []).find((asset) => asset.name === expected)
    || (release.assets || []).find((asset) => /^SXRON-Marketplace-Setup-\d+\.\d+\.\d+-x64\.exe$/i.test(asset.name));
}

async function checkForGitHubUpdate() {
  if (isDev) throw new Error('Проверка обновлений доступна в установленной версии приложения.');
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  sendUpdateUi('checking', { currentVersion: CURRENT_VERSION });
  try {
    const release = await githubRequest(GITHUB_LATEST_RELEASE_URL);
    const releaseVersion = String(release.tag_name || '').replace(/^v/i, '').trim();
    const comparison = compareVersions(releaseVersion, CURRENT_VERSION);
    if (comparison === null) throw new Error(`GitHub вернул некорректную версию релиза: ${releaseVersion || 'неизвестно'}.`);
    const asset = findInstallerAsset(release, releaseVersion);
    if (!asset) throw new Error(`В релизе ${releaseVersion} не найден Windows-установщик SXRON.`);

    const available = comparison > 0;
    latestRelease = { release, asset, targetVersion: releaseVersion };
    sendUpdateUi(available ? 'update-required' : 'up-to-date', {
      currentVersion: CURRENT_VERSION,
      targetVersion: releaseVersion,
      releaseName: release.name || `SXRON Marketplace v${releaseVersion}`,
      releaseNotes: release.body || '',
      available,
    });
  } finally {
    updateCheckInProgress = false;
  }
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'SXRON-Marketplace-Updater', Accept: 'application/octet-stream' },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadFile(response.headers.location, destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`GitHub download HTTP ${response.statusCode}`)); return; }
      const output = fs.createWriteStream(destination);
      let received = 0;
      const total = Number(response.headers['content-length'] || 0);
      response.on('data', (chunk) => {
        received += chunk.length;
        sendUpdateUi('download-progress', { percent: total ? (received / total) * 100 : 0, received, total });
      });
      response.pipe(output);
      output.on('finish', () => output.close(resolve));
      output.on('error', (error) => { output.destroy(); reject(error); });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(120000, () => { request.destroy(new Error('Истекло время загрузки установщика.')); });
  });
}

async function downloadAndInstallGitHubUpdate() {
  if (!latestRelease?.asset) await checkForGitHubUpdate();
  if (!latestRelease?.asset) throw new Error('Обновление не найдено.');
  const asset = latestRelease.asset;
  const updateDir = path.join(app.getPath('userData'), 'updates');
  fs.mkdirSync(updateDir, { recursive: true });
  const installerPath = path.join(updateDir, asset.name);
  sendUpdateUi('download-start', { targetVersion: latestRelease.targetVersion });
  await downloadFile(asset.browser_download_url, installerPath);
  const expectedDigest = String(asset.digest || '').replace(/^sha256:/i, '').toLowerCase();
  if (expectedDigest) {
    const actualDigest = crypto.createHash('sha256').update(fs.readFileSync(installerPath)).digest('hex').toLowerCase();
    if (actualDigest !== expectedDigest) { fs.rmSync(installerPath, { force: true }); throw new Error('Проверка SHA-256 установщика не прошла. Установка отменена.'); }
  }
  if (process.platform !== 'win32') { await shell.openPath(installerPath); return; }
  const installDir = path.dirname(app.getPath('exe'));
  sendUpdateUi('update-ready', { currentVersion: CURRENT_VERSION, targetVersion: latestRelease.targetVersion, percent: 100 });
  const child = spawn(installerPath, ['--updated', '/S', `/D=${installDir}`, '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  setTimeout(() => app.quit(), 250);
}

function installWindowChrome(win) {
  win.webContents.executeJavaScript(`(() => {
    if (document.getElementById('sxron-window-chrome')) return;
    const style = document.createElement('style');
    style.id = 'sxron-window-chrome-style';
    style.textContent = \`#sxron-window-chrome{position:fixed;top:10px;right:12px;height:34px;z-index:2147483647;display:flex;align-items:center;justify-content:flex-end;padding:0 4px 0 8px;gap:3px;background:rgba(7,10,15,.88);border:1px solid rgba(255,255,255,.075);border-radius:11px;box-shadow:0 10px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035);backdrop-filter:blur(18px);-webkit-app-region:drag;font-family:Inter,system-ui,sans-serif}#sxron-window-chrome .sxron-chrome-title{display:flex;align-items:center;gap:7px;margin-right:4px;color:#8f9aae;font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}#sxron-window-chrome .sxron-chrome-mark{width:18px;height:18px;border-radius:6px;display:grid;place-items:center;color:#071016;font-size:9px;font-weight:950;background:linear-gradient(135deg,#29e0cc,#8b72ff);box-shadow:0 3px 14px rgba(41,224,204,.16)}#sxron-window-chrome .sxron-chrome-actions{height:100%;display:flex;align-items:center;-webkit-app-region:no-drag}#sxron-window-chrome button{width:30px;height:26px;margin-left:1px;border:0;border-radius:7px;background:transparent;color:#7e8ba0;font-size:12px;cursor:pointer;display:grid;place-items:center}#sxron-window-chrome button:hover{background:rgba(255,255,255,.07);color:#fff}#sxron-window-chrome button.sxron-close:hover{background:#e5484d;color:#fff}\`; 
    document.head.appendChild(style);
    const bar = document.createElement('div');
    bar.id = 'sxron-window-chrome';
    bar.innerHTML = '<div class="sxron-chrome-title"><span class="sxron-chrome-mark">S</span><span>SXRON MARKETPLACE</span></div><div class="sxron-chrome-actions"><button data-action="minimize" aria-label="Свернуть">−</button><button data-action="maximize" aria-label="Развернуть">□</button><button data-action="close" class="sxron-close" aria-label="Закрыть">×</button></div>';
    bar.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => window.open('sxron://' + button.dataset.action)));
    document.body.appendChild(bar);
  })()` ).catch(() => {});
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 700,
    title: `SXRON Marketplace ${CURRENT_VERSION}`,
    backgroundColor: '#07090f',
    autoHideMenuBar: true,
    frame: false,
    roundedCorners: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow = win;
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => console.error('SXRON renderer load failed:', errorCode, errorDescription));
  if (isDev) await win.loadURL('http://localhost:5173');
  else await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'sxron://check-updates') {
      checkForGitHubUpdate().catch((error) => sendUpdateUi('update-error', { message: error?.message || String(error) }));
      return { action: 'deny' };
    }
    if (url === 'sxron://start-update') {
      downloadAndInstallGitHubUpdate().catch((error) => sendUpdateUi('update-error', { message: error?.message || String(error) }));
      return { action: 'deny' };
    }
    if (url === 'sxron://minimize') {
      win.minimize();
      return { action: 'deny' };
    }
    if (url === 'sxron://maximize') {
      if (win.isMaximized()) win.unmaximize(); else win.maximize();
      return { action: 'deny' };
    }
    if (url === 'sxron://close') {
      win.close();
      return { action: 'deny' };
    }
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-finish-load', () => {
    installWindowChrome(win);
    sendUpdateUi('app-version', { version: CURRENT_VERSION });
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
}

app.whenReady().then(async () => {
  registerWindowsAssociations();
  try {
    await startApi();
    await createWindow();
  } catch (error) {
    console.error('SXRON startup failed:', error);
    await dialog.showMessageBox({ type: 'error', title: 'SXRON Marketplace', message: 'Не удалось запустить SXRON Marketplace.', detail: error?.message || String(error) });
    app.quit();
    return;
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error); });
});
app.on('before-quit', () => stopApi());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
