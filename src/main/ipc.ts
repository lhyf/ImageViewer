import { app, ipcMain, dialog, shell, clipboard, nativeImage, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname, basename, extname, parse as parsePath } from 'path'
import { pathToFileURL } from 'url'
import { createHash } from 'crypto'
import { exec } from 'child_process'
import os from 'os'
import sharp from 'sharp'
import exifr from 'exifr'
import { loadImage, imageSize, exifToolTags, needsDecode, RAW_EXTS, HEIC_EXTS } from './decode'
import type {
  ImageItem,
  DirNode,
  ScanResult,
  ImageMeta,
  ExifInfo,
  OpResult,
  RenameResult
} from '../shared/types'

const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'

/** Extensions we treat as viewable images. */
const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'jpe', 'jfif', 'png', 'gif', 'bmp', 'webp', 'avif', 'tif', 'tiff', 'ico', 'svg',
  ...RAW_EXTS, ...HEIC_EXTS
])

function extOf(name: string): string {
  return extname(name).slice(1).toLowerCase()
}

function isImage(name: string): boolean {
  return IMAGE_EXTS.has(extOf(name))
}

type GetWindow = () => BrowserWindow | null

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

async function scanDir(dir: string): Promise<ScanResult> {
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return { dir, images: [] }
  }

  const files = entries.filter((e) => e.isFile() && isImage(e.name))
  const images: ImageItem[] = await Promise.all(
    files.map(async (e) => {
      const full = join(dir, e.name)
      let size = 0
      let mtime = 0
      try {
        const st = await fs.stat(full)
        size = st.size
        mtime = st.mtimeMs
      } catch {
        /* ignore unreadable */
      }
      return { path: full, name: e.name, ext: extOf(e.name), size, mtime }
    })
  )
  return { dir, images }
}

async function hasSubDir(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.some((e) => e.isDirectory() && !e.name.startsWith('.'))
  } catch {
    return false
  }
}

async function childDirs(dir: string): Promise<DirNode[]> {
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const dirs = entries.filter(
    (e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$')
  )
  const nodes = await Promise.all(
    dirs.map(async (e) => {
      const full = join(dir, e.name)
      return { path: full, name: e.name, hasChildren: await hasSubDir(full) } as DirNode
    })
  )
  return nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

async function treeRoots(): Promise<DirNode[]> {
  if (isWin) {
    // Enumerate drive letters by probing A: - Z:.
    const roots: DirNode[] = []
    for (let c = 65; c <= 90; c++) {
      const letter = String.fromCharCode(c)
      const root = `${letter}:\\`
      try {
        await fs.access(root)
        roots.push({ path: root, name: `${letter}:`, hasChildren: true, isDrive: true })
      } catch {
        /* drive not present */
      }
    }
    return roots
  }
  // macOS / Linux: filesystem root plus mounted volumes.
  const roots: DirNode[] = [{ path: '/', name: '/', hasChildren: true, isDrive: true }]
  if (isMac) {
    try {
      const vols = await childDirs('/Volumes')
      roots.push(...vols.map((v) => ({ ...v, isDrive: true })))
    } catch {
      /* ignore */
    }
  }
  return roots
}

function quickAccess(): DirNode[] {
  const names: Array<[Parameters<typeof app.getPath>[0], string]> = [
    ['home', '主目录'],
    ['desktop', '桌面'],
    ['pictures', '图片'],
    ['downloads', '下载'],
    ['documents', '文档']
  ]
  const nodes: DirNode[] = []
  for (const [key, label] of names) {
    try {
      const p = app.getPath(key)
      nodes.push({ path: p, name: label, hasChildren: true })
    } catch {
      /* some paths may be unavailable */
    }
  }
  return nodes
}

// ---------------------------------------------------------------------------
// Thumbnails + metadata
// ---------------------------------------------------------------------------

function thumbCacheDir(): string {
  return join(app.getPath('userData'), 'thumbnails')
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

// Generation runs on TWO independent concurrency lanes so that a full-screen
// PREVIEW (the image the user is actually staring at) never has to wait behind
// a backlog of THUMBNAIL jobs. They used to share one FIFO queue, so opening a
// big folder of RAW/JPEG files left the main image spinning until every visible
// thumbnail had finished generating. Each sharp op is kept single-threaded
// (concurrency 1) so at most (thumb + preview) lane slots are busy at once.
sharp.concurrency(1)

interface Lane {
  run<T>(task: () => Promise<T>): Promise<T>
}
function makeLane(limit: number): Lane {
  let active = 0
  const waiters: Array<() => void> = []
  const acquire = (): Promise<void> => {
    if (active < limit) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => waiters.push(resolve)).then(() => {
      active++
    })
  }
  const release = (): void => {
    active--
    waiters.shift()?.()
  }
  return {
    async run(task) {
      await acquire()
      try {
        return await task()
      } finally {
        release()
      }
    }
  }
}

const cpuBudget = Math.max(2, Math.min(4, (os.cpus().length || 4) - 2))
// Background thumbnails get the bigger share; previews get a small dedicated
// lane so the current (and neighbouring) images always have a free slot to
// start on immediately, independent of how many thumbnails are queued.
const thumbLane = makeLane(cpuBudget)
const previewLane = makeLane(2)

// Coalesce concurrent generation of the same cache file and write atomically
// (temp file + rename) so a reader never sees a half-written image — which was
// corrupting previews when display + neighbour-preload raced on one path.
let tmpCounter = 0
const inflight = new Map<string, Promise<string>>()

function cached(
  out: string,
  lane: Lane,
  produce: (tmpPath: string) => Promise<unknown>
): Promise<string> {
  const existing = inflight.get(out)
  if (existing) return existing
  const task = (async () => {
    try {
      await fs.access(out)
      return out // cache hit
    } catch {
      /* generate */
    }
    const tmp = `${out}.${process.pid}.${tmpCounter++}.tmp`
    await lane.run(() => produce(tmp))
    await fs.rename(tmp, out).catch(async (err) => {
      // A concurrent producer may have won the rename; tolerate that.
      await fs.unlink(tmp).catch(() => {})
      if (!(await fs.access(out).then(() => true).catch(() => false))) throw err
    })
    return out
  })().finally(() => inflight.delete(out))
  inflight.set(out, task)
  return task
}

async function fileMtime(path: string): Promise<number> {
  try {
    return (await fs.stat(path)).mtimeMs
  } catch {
    return 0
  }
}

async function thumbnail(path: string, size = 256): Promise<string> {
  const cacheDir = thumbCacheDir()
  await ensureDir(cacheDir)
  const key = createHash('md5').update(`${path}|${await fileMtime(path)}|${size}`).digest('hex')
  const out = join(cacheDir, `${key}.jpg`)
  try {
    return await cached(out, thumbLane, async (tmp) => {
      const img = await loadImage(path)
      await img
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(tmp)
    })
  } catch {
    return path // fall back to the original if it can't be decoded
  }
}

/** A multi-frame GIF / animated WebP that should play rather than freeze. */
async function isAnimated(path: string): Promise<boolean> {
  const ext = extOf(path)
  if (ext === 'gif') {
    // libvips reports the frame count as `pages` for GIF.
    try {
      const m = await sharp(path, { animated: true }).metadata()
      return (m.pages ?? 1) > 1
    } catch {
      return false
    }
  }
  if (ext === 'webp') {
    // Read the RIFF/VP8X header directly: an animated WebP has an extended
    // (VP8X) header whose flags byte sets the animation bit (0x02). This is
    // authoritative and avoids sharp's flaky `pages` reporting for WebP.
    try {
      const fd = await fs.open(path, 'r')
      try {
        const buf = Buffer.alloc(21)
        await fd.read(buf, 0, 21, 0)
        return (
          buf.toString('ascii', 0, 4) === 'RIFF' &&
          buf.toString('ascii', 8, 12) === 'WEBP' &&
          buf.toString('ascii', 12, 16) === 'VP8X' &&
          (buf[20] & 0x02) !== 0
        )
      } finally {
        await fd.close()
      }
    } catch {
      return false
    }
  }
  return false
}

// A downscaled, EXIF-oriented preview for fast display of huge camera photos.
async function preview(path: string, max = 3840): Promise<string> {
  // Animated images must keep playing: hand the ORIGINAL file straight to the
  // renderer's <img>, which Chromium animates natively. A downscaled still would
  // freeze GIFs / animated WebP on their first frame.
  if (await isAnimated(path)) return path

  const cacheDir = join(app.getPath('userData'), 'previews')
  await ensureDir(cacheDir)
  const ext = extOf(path)
  // Photos (jpeg + RAW + HEIC) → JPEG; formats that may carry alpha → PNG.
  const useJpeg =
    ext === 'jpg' || ext === 'jpeg' || ext === 'jpe' || ext === 'jfif' ||
    RAW_EXTS.has(ext) || HEIC_EXTS.has(ext)
  const outExt = useJpeg ? 'jpg' : 'png'
  const key = createHash('md5').update(`${path}|${await fileMtime(path)}|${max}`).digest('hex')
  const out = join(cacheDir, `${key}.${outExt}`)
  try {
    return await cached(out, previewLane, async (tmp) => {
      const pipeline = (await loadImage(path)).resize(max, max, {
        fit: 'inside',
        withoutEnlargement: true
      })
      await (useJpeg ? pipeline.jpeg({ quality: 88 }) : pipeline.png({ compressionLevel: 6 })).toFile(
        tmp
      )
    })
  } catch {
    return path // fall back to the original if it can't be transcoded
  }
}

function mapExif(raw: Record<string, unknown> | undefined): ExifInfo | undefined {
  if (!raw) return undefined
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && isFinite(v) ? v : undefined
  const str = (v: unknown): string | undefined => (v == null ? undefined : String(v))
  const exposure = num(raw.ExposureTime)
  const info: ExifInfo = {
    make: str(raw.Make),
    model: str(raw.Model),
    lensModel: str(raw.LensModel),
    dateTimeOriginal: raw.DateTimeOriginal ? String(raw.DateTimeOriginal) : undefined,
    exposureTime:
      exposure && exposure > 0 && exposure < 1
        ? `1/${Math.round(1 / exposure)}s`
        : exposure
          ? `${exposure}s`
          : undefined,
    fNumber: num(raw.FNumber) ? `f/${num(raw.FNumber)}` : undefined,
    iso: num(raw.ISO),
    focalLength: num(raw.FocalLength) ? `${num(raw.FocalLength)}mm` : undefined,
    orientation: num(raw.Orientation),
    gpsLatitude: num(raw.latitude),
    gpsLongitude: num(raw.longitude)
  }
  return info
}

// exiftool tags (RAW/HEIC) → ExifInfo, since exifr can't read those formats.
function mapExifToolTags(t: Record<string, unknown> | undefined): ExifInfo | undefined {
  if (!t) return undefined
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && isFinite(v) ? v : undefined
  const str = (v: unknown): string | undefined => (v == null ? undefined : String(v))
  const fnum = num(t.FNumber) ?? num(t.Aperture)
  let exposure: string | undefined
  if (typeof t.ShutterSpeed === 'string') {
    exposure = /s$/.test(t.ShutterSpeed) ? t.ShutterSpeed : `${t.ShutterSpeed}s`
  } else if (typeof t.ExposureTime === 'string') {
    exposure = /s$/.test(t.ExposureTime) ? t.ExposureTime : `${t.ExposureTime}s`
  } else if (typeof t.ExposureTime === 'number') {
    const e = t.ExposureTime
    exposure = e > 0 && e < 1 ? `1/${Math.round(1 / e)}s` : `${e}s`
  }
  return {
    make: str(t.Make),
    model: str(t.Model),
    lensModel: str(t.LensModel ?? t.LensID ?? t.Lens),
    dateTimeOriginal: t.DateTimeOriginal ? String(t.DateTimeOriginal) : undefined,
    exposureTime: exposure,
    fNumber: fnum ? `f/${fnum}` : undefined,
    iso: num(t.ISO),
    focalLength: t.FocalLength != null ? String(t.FocalLength).replace(/\s+/g, '') : undefined,
    orientation: num(t.Orientation),
    gpsLatitude: num(t.GPSLatitude),
    gpsLongitude: num(t.GPSLongitude)
  }
}

async function getMeta(path: string): Promise<ImageMeta> {
  const st = await fs.stat(path)
  const ext = extOf(path)
  const { width, height } = await imageSize(path).catch(() => ({ width: 0, height: 0 }))
  let exif: ExifInfo | undefined
  if (RAW_EXTS.has(ext) || HEIC_EXTS.has(ext)) {
    exif = mapExifToolTags(await exifToolTags(path))
  } else {
    try {
      const raw = await exifr.parse(path, { gps: true }).catch(() => undefined)
      exif = mapExif(raw as Record<string, unknown> | undefined)
    } catch {
      /* ignore */
    }
  }
  return {
    path,
    name: basename(path),
    ext,
    size: st.size,
    mtime: st.mtimeMs,
    width,
    height,
    exif
  }
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

async function trashItem(path: string): Promise<OpResult> {
  try {
    await shell.trashItem(path)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function rename(path: string, newBase: string): Promise<RenameResult> {
  const clean = newBase.trim()
  if (!clean || /[\\/:*?"<>|]/.test(clean)) {
    return { ok: false, error: '文件名包含非法字符' }
  }
  const dir = dirname(path)
  // Preserve the original extension if the user didn't type one.
  const typedExt = extname(clean)
  const finalName = typedExt ? clean : clean + extname(path)
  const newPath = join(dir, finalName)
  try {
    await fs.access(newPath)
    return { ok: false, error: '同名文件已存在' }
  } catch {
    /* good, target free */
  }
  try {
    await fs.rename(path, newPath)
    return { ok: true, newPath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function saveAsCopy(win: BrowserWindow | null, path: string): Promise<OpResult> {
  const info = parsePath(path)
  const target = await dialog.showSaveDialog(win ?? undefined!, {
    title: '另存为',
    defaultPath: join(info.dir, `${info.name}${info.ext}`)
  })
  if (target.canceled || !target.filePath) return { ok: false, error: 'canceled' }
  try {
    await fs.copyFile(path, target.filePath)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function copyImage(path: string): Promise<OpResult> {
  try {
    // nativeImage can't decode RAW/HEIC — copy the generated preview instead.
    const src = needsDecode(path) ? await preview(path) : path
    const img = nativeImage.createFromPath(src)
    if (img.isEmpty()) return { ok: false, error: '无法读取图片' }
    clipboard.writeImage(img)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function showInFolder(path: string): OpResult {
  shell.showItemInFolder(path)
  return { ok: true }
}

async function openDefault(path: string): Promise<OpResult> {
  const err = await shell.openPath(path)
  return err ? { ok: false, error: err } : { ok: true }
}

function openWith(path: string): OpResult {
  // Native "Open with" chooser.
  if (isWin) {
    exec(`rundll32.exe shell32.dll,OpenAs_RunDLL "${path}"`)
    return { ok: true }
  }
  if (isMac) {
    exec(`open -R "${path}"`) // reveal; macOS has no direct open-with dialog via CLI
    return { ok: true }
  }
  return { ok: false, error: 'unsupported' }
}

function setWallpaper(path: string): OpResult {
  try {
    if (isWin) {
      const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport("user32.dll",CharSet=CharSet.Auto)]public static extern int SystemParametersInfo(int u,int p,string f,int w);}'; [W]::SystemParametersInfo(20,0,'${path.replace(/'/g, "''")}',3)`
      exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`)
      return { ok: true }
    }
    if (isMac) {
      exec(`osascript -e 'tell application "Finder" to set desktop picture to POSIX file "${path}"'`)
      return { ok: true }
    }
    return { ok: false, error: 'unsupported' }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function printImage(path: string): OpResult {
  try {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    const url = `data:text/html,${encodeURIComponent(
      `<html><body style="margin:0"><img src="${pathToFileURL(path)}" style="max-width:100%"/></body></html>`
    )}`
    win.loadURL(url)
    win.webContents.once('did-finish-load', () => {
      win.webContents.print({ silent: false }, () => win.close())
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFileHandlers(getWindow: GetWindow): void {
  ipcMain.handle('dialog:openFolder', async () => {
    const win = getWindow()
    const r = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openDirectory']
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('dialog:openFiles', async () => {
    const win = getWindow()
    const r = await dialog.showOpenDialog(win ?? undefined!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: [...IMAGE_EXTS] }]
    })
    return r.canceled ? [] : r.filePaths
  })

  ipcMain.handle('fs:scanDir', (_e, dir: string) => scanDir(dir))
  ipcMain.handle('fs:treeRoots', () => treeRoots())
  ipcMain.handle('fs:childDirs', (_e, dir: string) => childDirs(dir))
  ipcMain.handle('fs:quickAccess', () => quickAccess())
  ipcMain.handle('fs:parent', (_e, dir: string) => {
    const p = dirname(dir)
    return p === dir ? null : p
  })
  // Is a dropped path a folder or a file? (drives drag-and-drop behaviour)
  ipcMain.handle('fs:pathKind', async (_e, p: string) => {
    try {
      const st = await fs.stat(p)
      return st.isDirectory() ? 'dir' : st.isFile() ? 'file' : null
    } catch {
      return null
    }
  })

  ipcMain.handle('img:thumbnail', (_e, path: string, size?: number) => thumbnail(path, size))
  ipcMain.handle('img:preview', (_e, path: string, max?: number) => preview(path, max))
  // Just the display dimensions — cheap (header/EXIF, no decode), used to size
  // the viewer placeholder before the full preview arrives.
  ipcMain.handle('img:size', (_e, path: string) => imageSize(path))
  ipcMain.handle('img:meta', (_e, path: string) => getMeta(path))

  ipcMain.handle('op:trash', (_e, path: string) => trashItem(path))
  ipcMain.handle('op:rename', (_e, path: string, newBase: string) => rename(path, newBase))
  ipcMain.handle('op:saveAs', (_e, path: string) => saveAsCopy(getWindow(), path))
  ipcMain.handle('op:copyImage', (_e, path: string) => copyImage(path))
  ipcMain.handle('op:showInFolder', (_e, path: string) => showInFolder(path))
  ipcMain.handle('op:openDefault', (_e, path: string) => openDefault(path))
  ipcMain.handle('op:openWith', (_e, path: string) => openWith(path))
  ipcMain.handle('op:setWallpaper', (_e, path: string) => setWallpaper(path))
  ipcMain.handle('op:print', (_e, path: string) => printImage(path))
}
