// ============================================================================
// Scope Opera Joe - Preload Script (Security Bridge)
// The page gets only what it needs from the main process, nothing else.
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scopeAPI', {
    // The one version number (package.json), for the title, the header badge and diagnostics
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    // Electron, Chromium and OS versions for the diagnostics report
    getRuntimeInfo: () => ipcRenderer.invoke('get-runtime-info'),
    // COPY LOGS / COPY DIAGNOSTICS: through the app, so it works even when the page's own clipboard
    // access is refused (it needs the window to have focus)
    copyText: (text) => ipcRenderer.invoke('copy-text', String(text))
});
