const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printPDF: (options) => ipcRenderer.invoke('print-pdf', options),
    printInvoice: (options) => ipcRenderer.invoke('print-invoice', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    savePDFFile: (filePath, buffer) => ipcRenderer.invoke('save-pdf-file', filePath, buffer),
    getLogoPath: () => ipcRenderer.sendSync('get-logo-path')
});
