const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  screen,
} = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let cropWindow = null
let capturedScreenshot = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function startScreenshot() {
  // Make main window invisible instantly (no hide animation = cleaner capture)
  if (mainWindow) mainWindow.setOpacity(0)
  await new Promise((resolve) => setTimeout(resolve, 150))

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size
  const scaleFactor = primaryDisplay.scaleFactor

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
    },
  })

  if (!sources.length) {
    if (mainWindow) mainWindow.show()
    return
  }
  capturedScreenshot = sources[0].thumbnail

  cropWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'cropPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  cropWindow.loadFile(path.join(__dirname, 'crop.html'))

  cropWindow.webContents.on('did-finish-load', () => {
    cropWindow.webContents.send('screenshot', capturedScreenshot.toDataURL())
  })

  cropWindow.on('closed', () => {
    cropWindow = null
  })
}

ipcMain.on('crop-selected', (_, rect) => {
  if (!capturedScreenshot) return

  const scaleFactor = screen.getPrimaryDisplay().scaleFactor
  const scaledRect = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    width: Math.round(rect.width * scaleFactor),
    height: Math.round(rect.height * scaleFactor),
  }

  const cropped = capturedScreenshot.crop(scaledRect)
  const dataURL = cropped.toDataURL()
  capturedScreenshot = null

  if (cropWindow) {
    cropWindow.close()
    cropWindow = null
  }

  if (mainWindow) {
    mainWindow.setOpacity(1)
    mainWindow.focus()
    mainWindow.webContents.send('send-to-ocr', dataURL)
  }
})

ipcMain.on('crop-cancelled', () => {
  capturedScreenshot = null
  if (cropWindow) {
    cropWindow.close()
    cropWindow = null
  }
  if (mainWindow) mainWindow.setOpacity(1)
})

app.whenReady().then(() => {
  createMainWindow()

  app.on('activate', () => {
    if (!mainWindow) createMainWindow()
  })

  // Option+Cmd+1 (Mac) / Ctrl+Alt+1 (Win/Linux) — system-wide screenshot
  const registered = globalShortcut.register('CommandOrControl+Alt+1', () => {
    startScreenshot()
  })
  if (!registered) {
    console.error('Failed to register global shortcut CommandOrControl+Alt+1')
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
