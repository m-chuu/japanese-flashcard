const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onScreenshot: (callback) => {
    ipcRenderer.on('screenshot', (_, dataURL) => callback(dataURL))
  },
  cropSelected: (rect) => ipcRenderer.send('crop-selected', rect),
  cropCancelled: () => ipcRenderer.send('crop-cancelled'),
})
