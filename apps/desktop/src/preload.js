const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (_, filePath) => callback(filePath)),
});
