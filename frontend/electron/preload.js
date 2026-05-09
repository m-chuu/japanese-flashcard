const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onSendToOCR: (callback) => {
    ipcRenderer.removeAllListeners('send-to-ocr')
    ipcRenderer.on('send-to-ocr', (_, dataURL) => callback(dataURL))
  },
  removeSendToOCR: () => {
    ipcRenderer.removeAllListeners('send-to-ocr')
  },
})
