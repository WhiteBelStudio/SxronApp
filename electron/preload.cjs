const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sxronWindowControls', {
  minimize: () => ipcRenderer.send('sxron-window-action', 'minimize'),
  toggleMaximize: () => ipcRenderer.send('sxron-window-action', 'maximize'),
  close: () => ipcRenderer.send('sxron-window-action', 'close'),
});
