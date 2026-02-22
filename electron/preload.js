const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    isPackaged: () => ipcRenderer.invoke('is-packaged'),
    getLocale: () => ipcRenderer.invoke('get-locale'),
    
    // System
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Platform detection
    platform: process.platform,
    isMac: process.platform === 'darwin',
    isWindows: process.platform === 'win32',
    isLinux: process.platform === 'linux',
    
    // Electron version
    versions: process.versions
});

// Log when preload script loads
console.log('[Floyd Desktop] Preload script loaded');
console.log('[Floyd Desktop] Platform:', process.platform);
console.log('[Floyd Desktop] Electron versions:', process.versions);
