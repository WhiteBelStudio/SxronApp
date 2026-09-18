const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const isDev = !app.isPackaged;
const IS_SMOKE_TEST = process.argv.includes('--sxron-smoke-test') || process.env.SXRON_SMOKE_TEST === '1';
let apiProcess = null;
let mainWindow = null;
let updateCheckInProgress = false;
let latestRelease = null;

const CURRENT_VERSION = app.getVersion();
const GITHUB_OWNER = 'WhiteBelStudio';
const GITHUB_REPO = 'SxronApp';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const GOT_SINGLE_INSTANCE_LOCK = app.requestSingleInstanceLock();
if (!GOT_SINGLE_INSTANCE_LOCK) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

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
    if (actualDigest !== expectedDigest) {
      fs.rmSync(installerPath, { force: true });
      throw new Error('Проверка SHA-256 установщика не прошла. Установка отменена.');
    }
  }

  if (process.platform !== 'win32') {
    await shell.openPath(installerPath);
    return;
  }

  const installDir = path.dirname(app.getPath('exe'));
  const apiPid = apiProcess?.pid || 0;
  const currentPid = process.pid;
  const targetVersion = latestRelease.targetVersion;

  sendUpdateUi('update-ready', {
    currentVersion: CURRENT_VERSION,
    targetVersion,
    percent: 100,
  });

  // The updater runs outside Electron. It waits for BOTH Electron and the
  // bundled API process to disappear, then waits a little longer for Windows
  // file handles to settle, and only then starts NSIS.
  const helperPath = path.join(updateDir, 'sxron-apply-update.ps1');
  const installerLiteral = JSON.stringify(installerPath);
  const installDirLiteral = JSON.stringify(installDir);

  const helperScript = [
    'param(',
    '  [int]$ElectronPid,',
    '  [int]$ApiPid,',
    '  [string]$Installer,',
    '  [string]$InstallDir',
    ')',
    '',
    '$deadline = (Get-Date).AddSeconds(60)',
    '$electronExe = Join-Path $InstallDir "SXRON Marketplace.exe"',
    '$apiExe = Join-Path $InstallDir "resources\\backend\\sxron-api\\sxron-api.exe"',
    '',
    'function Stop-SxronProcesses {',
    '  $targets = @($electronExe, $apiExe) | ForEach-Object { [IO.Path]::GetFullPath($_) }',
    '  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue',
    '  foreach ($process in $processes) {',
    '    $path = $process.ExecutablePath',
    '    if (-not $path) { continue }',
    '    $normalized = [IO.Path]::GetFullPath($path)',
    '    if ($targets -contains $normalized) {',
    '      try { Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue } catch {}',
    '    }',
    '  }',
    '}',
    '',
    'function Test-FileFree([string]$Path) {',
    '  if (-not (Test-Path -LiteralPath $Path)) { return $true }',
    '  try {',
    '    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)',
    '    $stream.Dispose()',
    '    return $true',
    '  } catch {',
    '    return $false',
    '  }',
    '}',
    '',
    'Start-Sleep -Seconds 2',
    'Stop-SxronProcesses',
    '',
    'while ((Get-Date) -lt $deadline) {',
    '  Stop-SxronProcesses',
    '  $electronAlive = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.TrimEnd('\\').ToLowerInvariant() -eq $electronExe.TrimEnd('\\').ToLowerInvariant() }',
    '  $apiAlive = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.TrimEnd('\\').ToLowerInvariant() -eq $apiExe.TrimEnd('\\').ToLowerInvariant() }',
    '  $exeFree = Test-FileFree $electronExe',
    '  if (-not $electronAlive -and -not $apiAlive -and $exeFree) { break }',
    '  Start-Sleep -Milliseconds 300',
    '}',
    '',
    'Start-Sleep -Seconds 2',
    'Stop-SxronProcesses',
    '',
    'if (-not (Test-Path -LiteralPath $Installer)) { exit 2 }',
    '',
    'try {',
    '  $proc = Start-Process -FilePath $Installer -ArgumentList @(',
    '    "/S",',
    '    "/D=$InstallDir"',
    '  ) -WorkingDirectory (Split-Path -Parent $Installer) -PassThru',
    '  if ($proc) { exit 0 }',
    '} catch {',
    '  exit 3',
    '}',
    'exit 4',
  ].join('\n');



  fs.writeFileSync(helperPath, helperScript, 'utf8');

  // Stop the API ourselves before Electron exits, then let the external
  // PowerShell helper wait for both PIDs.
  stopApi();

  const helper = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    helperPath,
    '-ElectronPid',
    String(currentPid),
    '-ApiPid',
    String(apiPid),
    '-Installer',
    installerPath,
    '-InstallDir',
    installDir,
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  helper.unref();

  // Exit immediately so NSIS can replace the installed EXE/DLL files.
  app.exit(0);
}


function installWindowChrome(win) {
  win.webContents.executeJavaScript(`(() => {
    if (document.getElementById('sxron-window-chrome')) return;
    const style = document.createElement('style');
    style.id = 'sxron-window-chrome-style';
    style.textContent = \`#sxron-window-chrome{position:fixed;top:10px;right:12px;height:36px;z-index:2147483647;display:flex;align-items:center;justify-content:flex-end;padding:3px;background:rgba(7,10,17,.9);border:1px solid rgba(255,255,255,.08);border-radius:11px;box-shadow:0 10px 30px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.035);backdrop-filter:blur(20px);-webkit-app-region:drag;font-family:Inter,system-ui,sans-serif}#sxron-window-chrome .sxron-chrome-actions{height:100%;display:flex;align-items:center;gap:2px;-webkit-app-region:no-drag}#sxron-window-chrome button{position:relative;width:36px;height:30px;border:0;border-radius:8px;background:transparent;color:#8c98aa;font-size:16px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:background .16s ease,color .16s ease,transform .16s ease}#sxron-window-chrome button:hover{background:rgba(255,255,255,.075);color:#fff}#sxron-window-chrome button:active{transform:scale(.94)}#sxron-window-chrome button.sxron-maximize{font-size:13px}#sxron-window-chrome button.sxron-close:hover{background:#e45159;color:#fff}#sxron-window-chrome button::after{content:attr(data-tooltip);position:absolute;right:0;top:36px;white-space:nowrap;padding:6px 8px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:#0b1019;color:#dbe2ec;font-size:10px;font-weight:700;opacity:0;pointer-events:none;transform:translateY(-3px);transition:opacity .14s ease,transform .14s ease;box-shadow:0 8px 20px rgba(0,0,0,.3)}#sxron-window-chrome button:hover::after{opacity:1;transform:translateY(0)}\`;
    document.head.appendChild(style);
    const bar = document.createElement('div');
    bar.id = 'sxron-window-chrome';
    bar.innerHTML = '<div class="sxron-chrome-actions"><button data-action="minimize" data-tooltip="Свернуть" aria-label="Свернуть">−</button><button class="sxron-maximize" data-action="maximize" data-tooltip="Развернуть" aria-label="Развернуть">□</button><button data-action="close" data-tooltip="Закрыть" class="sxron-close" aria-label="Закрыть">×</button></div>';
    bar.addEventListener('dblclick', (event) => {
      if (!event.target.closest('button')) window.sxronWindowControls?.toggleMaximize();
    });
    bar.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'minimize') window.sxronWindowControls?.minimize();
      if (action === 'maximize') window.sxronWindowControls?.toggleMaximize();
      if (action === 'close') window.sxronWindowControls?.close();
    }));
    document.body.appendChild(bar);
  })()`).catch(() => {});
}

function updateWindowChromeState(win) {
  if (!win || win.isDestroyed()) return;
  const maximized = win.isMaximized();
  const icon = maximized ? '❐' : '□';
  const tooltip = maximized ? 'Восстановить' : 'Развернуть';
  const script = `(() => {
    const button = document.querySelector('#sxron-window-chrome .sxron-maximize');
    if (!button) return;
    button.textContent = ${JSON.stringify(icon)};
    button.dataset.tooltip = ${JSON.stringify(tooltip)};
    button.setAttribute('aria-label', ${JSON.stringify(tooltip)});
  })()`;
  win.webContents.executeJavaScript(script).catch(() => {});
}


ipcMain.on('sxron-window-action', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (action === 'minimize') {
    win.minimize();
  } else if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  } else if (action === 'close') {
    win.close();
  }
});

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  if (!fs.existsSync(preloadPath)) {
    throw new Error(`Файл Electron preload не найден:\n${preloadPath}`);
  }

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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath,
    },
  });
  mainWindow = win;
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => console.error('SXRON renderer load failed:', errorCode, errorDescription));
  win.on('maximize', () => updateWindowChromeState(win));
  win.on('unmaximize', () => updateWindowChromeState(win));
  const loadPromise = isDev
    ? win.loadURL('http://localhost:5173')
    : win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  if (IS_SMOKE_TEST) {
    loadPromise.catch((error) => console.error('SXRON smoke renderer load:', error?.message || error));
  } else {
    await loadPromise;
  }

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
    updateWindowChromeState(win);
    sendUpdateUi('app-version', { version: CURRENT_VERSION });
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
}

app.whenReady().then(async () => {
  if (!GOT_SINGLE_INSTANCE_LOCK) return;

  if (IS_SMOKE_TEST) {
    try {
      const preloadPath = path.join(__dirname, 'preload.cjs');
      const rendererPath = path.join(app.getAppPath(), 'dist', 'index.html');
      const apiExecutable = getApiExecutable();
      const checks = [
        ['Electron preload', preloadPath],
        ['SXRON renderer', rendererPath],
        ['Bundled SXRON API', apiExecutable],
      ];

      for (const [label, filePath] of checks) {
        if (!fs.existsSync(filePath)) {
          throw new Error(`${label} не найден: ${filePath}`);
        }
      }

      console.log('SXRON packaged bootstrap smoke: OK');
      app.exit(0);
    } catch (error) {
      console.error('SXRON packaged bootstrap smoke failed:', error);
      app.exit(1);
    }
    return;
  }

  registerWindowsAssociations();
  try {
    appendApiLog(`SXRON Electron start ${new Date().toISOString()} | version=${CURRENT_VERSION} | packaged=${app.isPackaged}\\n`);
  } catch (error) {
    console.warn('SXRON Electron startup log:', error?.message || error);
  }

  try {
    await startApi();
    await createWindow();
  } catch (error) {
    console.error('SXRON startup failed:', error);
    await dialog.showMessageBox({
      type: 'error',
      title: 'SXRON Marketplace',
      message: 'Не удалось запустить SXRON Marketplace.',
      detail: error?.message || String(error),
    });
    stopApi();
    app.exit(1);
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error);
  });
});

app.on('before-quit', () => stopApi());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
