const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // You can add IPC channels here to communicate between React and Electron if needed in the future
    // e.g., getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
