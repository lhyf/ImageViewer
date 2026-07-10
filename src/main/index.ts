import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { registerFileHandlers } from './ipc'

const isMac = process.platform === 'darwin'
const isDev = !!process.env['ELECTRON_RENDERER_URL']

// The custom scheme must be registered as privileged before the app is ready so
// that <img src="media://..."> is treated as a secure, fetch-capable source.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const common = {
    width: 1200,
    height: 800,
    minWidth: 820,
    minHeight: 560,
    show: false,
    backgroundColor: '#17181b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  } as const

  mainWindow = new BrowserWindow(
    isMac
      ? { ...common, titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 20 } }
      : { ...common, frame: false }
  )

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  const emitMaximized = (): void =>
    mainWindow?.webContents.send('window:maximized', mainWindow.isMaximized())
  mainWindow.on('maximize', emitMaximized)
  mainWindow.on('unmaximize', emitMaximized)

  // Open target=_blank / external links in the OS browser instead of a new window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Serve local image / thumbnail files through a controlled scheme:
//   media://get/?p=<encodeURIComponent(absolutePath)>
function registerMediaProtocol(): void {
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url)
      const p = url.searchParams.get('p')
      if (!p) return new Response('missing path', { status: 400 })
      return await net.fetch(pathToFileURL(p).toString())
    } catch (err) {
      return new Response(String(err), { status: 404 })
    }
  })
}

function registerWindowControls(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
}

app.whenReady().then(() => {
  registerMediaProtocol()
  registerWindowControls()
  registerFileHandlers(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
