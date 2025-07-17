const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    startCopy: (data) => ipcRenderer.invoke('start-copy', data),
    onLogMessage: (callback) => ipcRenderer.on('log-message', callback),
    onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),
    onCopyCompleted: (callback) => ipcRenderer.on('copy-completed', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
