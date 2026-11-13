// ============================================================================
// Scope Opera Joe - Main Process
// One window, sandboxed page, context isolation, camera access granted to our own page only.
// ============================================================================

const { app, BrowserWindow, ipcMain, protocol, net, screen, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Single instance: a second launch exits immediately and focuses the running window,
// so two copies can't fight over the capture card (only one app can open it at a time).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.exit(0);
}

app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

const APP_ICON = path.join(__dirname, 'icon.png');
const APP_ORIGIN = 'app://scope-opera-joe';

let mainWindow = null;

// The page is served from app://scope-opera-joe/ rather than file://. A file:// page has an opaque
// origin, which in Chromium means empty device IDs, no device names and camera permission that never
// sticks (all the trouble the browser version had). A standard, secure scheme behaves like a website.
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

function serveAppFiles() {
    protocol.handle('app', (request) => {
        const { host, pathname } = new URL(request.url);
        const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
        const file = path.normalize(path.join(__dirname, relative));
        // Only files inside the app folder, nothing above it
        if (host !== 'scope-opera-joe' || !file.startsWith(__dirname + path.sep)) {
            return new Response('Not found', { status: 404 });
        }
        return net.fetch(pathToFileURL(file).toString());
    });
}

// Camera (video only), fullscreen and clipboard are allowed for our own page; everything else is refused.
function setPermissions() {
    const allowed = ['media', 'fullscreen', 'clipboard-sanitized-write'];
    const fromApp = (url) => typeof url === 'string' && url.startsWith(APP_ORIGIN);

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        if (!fromApp(details.requestingUrl) || !allowed.includes(permission)) return callback(false);
        if (permission === 'media' && (details.mediaTypes || []).includes('audio')) return callback(false);
        callback(true);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        return requestingOrigin.startsWith(APP_ORIGIN) && allowed.includes(permission);
    });
}

function createWindow() {
    const workArea = screen.getPrimaryDisplay().workArea;

    mainWindow = new BrowserWindow({
        title: 'SCOPE OPERA JOE ' + app.getVersion(),
        icon: APP_ICON,
        autoHideMenuBar: true,
        backgroundColor: '#121212',
        x: workArea.x,
        y: workArea.y,
        width: Math.min(1500, workArea.width),
        height: Math.min(950, workArea.height),
        // Same minimum as PLAYBACK JOE (1100 x 900), or the whole screen if it is smaller
        minWidth: Math.min(1100, workArea.width),
        minHeight: Math.min(900, workArea.height),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // The window never navigates away from the app; links open in the system browser
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https:\/\//.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.loadURL(APP_ORIGIN + '/index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-runtime-info', () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform + ' ' + process.getSystemVersion() + ' ' + process.arch
}));

if (gotSingleInstanceLock) {
    app.whenReady().then(() => {
        serveAppFiles();
        setPermissions();
        createWindow();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
