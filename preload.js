// ============================================================================
// Scope Opera Joe - Preload Script (Security Bridge)
// The page gets only what it needs from the main process, nothing else.
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scopeAPI', {
    // The one version number (package.json), for the title, the header badge and diagnostics
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    // Electron, Chromium and OS versions for the diagnostics report
    getRuntimeInfo: () => ipcRenderer.invoke('get-runtime-info')
});
