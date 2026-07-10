import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join, resolve } from 'path'
import { existsSync, statSync } from 'fs'
import { pathToFileURL } from 'url'
import { registerFileHandlers } from './ipc'

const isMac = process.platform === 'darwin'
const isDev = !!process.env['ELECTRON_RENDERER_URL']

// Extensions we accept when the OS launches us with a file ("Open with" /
// double-click on an associated image).
const IMAGE_ARG_RE = /\.(jpe?g|png|gif|webp|bmp|tiff?|avif|ico|svg|heic|heif)$/i

// The custom scheme must be registered as privileged before the app is ready so
// that <img src="media://..."> is treated as a secure, fetch-capable source.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let mainWindow: BrowserWindow | null = null
// A file path the OS asked us to open, waiting to be consumed by the renderer
// once it has finished mounting (see the 'app:getInitialFile' handler).
let pendingFile: string | null = null

/** Pull the first real image-file path out of a process argv list. */
function imagePathFromArgv(argv: string[]): string | null {
  for (const a of argv) {
    if (!a || a.startsWith('-')) continue
    if (!IMAGE_ARG_RE.test(a)) continue
    try {
      const full = resolve(a)
      if (existsSync(full) && statSync(full).isFile()) return full
    } catch {
      // not a usable path — keep looking
    }
  }
  return null
}

function focusMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

/**
 * Deliver a file to the renderer. If the window is up and loaded we push it
 * straight away; otherwise we stash it and let the renderer pull it on boot.
 */
function openFileInRenderer(p: string): void {
  const wc = mainWindow?.webContents
  if (mainWindow && wc && !wc.isLoading()) {
    wc.send('app:openFile', p)
    focusMainWindow()
  } else {
    pendingFile = p
  }
}

// macOS delivers "open with" through this event (can fire before app is ready).
app.on('open-file', (event, p) => {
  event.preventDefault()
  if (app.isReady()) openFileInRenderer(p)
  else pendingFile = p
})

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
  mainWindow.on('closed', () => {
    mainWindow = null
  })

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

  // The renderer calls this once on boot to pick up a file the OS launched us
  // with (consumed exactly once).
  ipcMain.handle('app:getInitialFile', () => {
    const p = pendingFile
    pendingFile = null
    return p
  })
}

// A single running instance owns the window; a second launch (e.g. double-click
// another image) forwards its file here instead of spawning a new process.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const p = imagePathFromArgv(argv.slice(1))
    if (p) openFileInRenderer(p)
    else focusMainWindow()
  })

  app.whenReady().then(() => {
    // On Windows/Linux the "open with" path arrives as a launch argument.
    if (!pendingFile) pendingFile = imagePathFromArgv(process.argv.slice(1))

    registerMediaProtocol()
    registerWindowControls()
    registerFileHandlers(() => mainWindow)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
