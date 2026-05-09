interface ElectronAPI {
  onSendToOCR: (callback: (dataURL: string) => void) => void
  removeSendToOCR: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
