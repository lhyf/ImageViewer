import { promises as fs } from 'fs'
import { extname } from 'path'
import sharp from 'sharp'

// ---------------------------------------------------------------------------
// Decoding for formats the prebuilt `sharp` cannot handle on its own:
//   • Camera RAW (CR3, NEF, ARW, …) — sharp/libvips has no RAW support at all.
//   • HEIC/HEIF — sharp reads the container metadata but the prebuilt binary
//     ships without the HEVC decoder plugin, so it can't decode the pixels.
//
// Strategy (viewer, not editor): we never demosaic RAW. Instead we pull the
// full-size JPEG the camera already embedded (JpgFromRaw), which is the true
// resolution. HEIC is decoded to RGBA via libheif (WASM) and re-oriented from
// its EXIF tag (exifr can't parse HEIC, so orientation comes from exiftool).
// ---------------------------------------------------------------------------

/** Camera RAW extensions — decoded via their embedded JPEG preview. */
export const RAW_EXTS = new Set([
  'cr3', 'cr2', 'crw', 'nef', 'nrw', 'arw', 'sr2', 'srf', 'raf', 'dng', 'orf',
  'rw2', 'pef', 'srw', 'raw', 'rwl', '3fr', 'iiq', 'x3f', 'mrw', 'dcr', 'kdc',
  'erf', 'mef', 'mos', 'nrw'
])

/** HEIF-family extensions decoded via libheif (WASM). AVIF stays on sharp. */
export const HEIC_EXTS = new Set(['heic', 'heif', 'hif'])

/** Formats that need this module instead of a plain `sharp(path)`. */
export const DECODE_EXTS = new Set<string>([...RAW_EXTS, ...HEIC_EXTS])

export function extOf(p: string): string {
  return extname(p).slice(1).toLowerCase()
}

export function needsDecode(p: string): boolean {
  return DECODE_EXTS.has(extOf(p))
}

// --- lazy singletons (heic-decode is ESM-only; exiftool keeps a live process) ---

type HeicDecode = typeof import('heic-decode').default
let heicDecodeFn: HeicDecode | null = null
async function heicDecoder(): Promise<HeicDecode> {
  if (!heicDecodeFn) {
    heicDecodeFn = (await import('heic-decode')).default
  }
  return heicDecodeFn
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exiftoolInst: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exif(): Promise<any> {
  if (!exiftoolInst) {
    const mod = await import('exiftool-vendored')
    exiftoolInst = mod.exiftool
  }
  return exiftoolInst
}

/** Shut the persistent exiftool process down on app quit. */
export async function endDecode(): Promise<void> {
  if (exiftoolInst) {
    try {
      await exiftoolInst.end()
    } catch {
      /* ignore */
    }
    exiftoolInst = null
  }
}

// --- helpers ---

/** Normalise an EXIF Orientation value (number or exiftool's text) to 1..8. */
function orientationNum(v: unknown): number {
  if (typeof v === 'number' && v >= 1 && v <= 8) return v
  if (typeof v === 'string') {
    const s = v.toLowerCase()
    if (s.includes('mirror horizontal') && s.includes('270')) return 5
    if (s.includes('mirror horizontal') && s.includes('90')) return 7
    if (s.includes('mirror horizontal')) return 2
    if (s.includes('mirror vertical')) return 4
    if (s.includes('90 cw')) return 6
    if (s.includes('270 cw') || s.includes('90 ccw')) return 8
    if (s.includes('180')) return 3
  }
  return 1
}

/** Apply an EXIF orientation to a raw (metadata-less) sharp pipeline. */
function applyOrientation(p: sharp.Sharp, o: number): sharp.Sharp {
  switch (o) {
    case 2: return p.flop()
    case 3: return p.rotate(180)
    case 4: return p.flip()
    case 5: return p.rotate(90).flop()
    case 6: return p.rotate(90)
    case 7: return p.rotate(270).flop()
    case 8: return p.rotate(270)
    default: return p
  }
}

async function exifOrientation(path: string): Promise<number> {
  try {
    const et = await exif()
    const tags = await et.read(path)
    return orientationNum(tags.Orientation)
  } catch {
    return 1
  }
}

/** Pull the largest JPEG the camera embedded in a RAW file. */
async function rawEmbeddedJpeg(path: string): Promise<Buffer> {
  const et = await exif()
  for (const tag of ['JpgFromRaw', 'PreviewImage', 'ThumbnailImage']) {
    try {
      const buf: Buffer = await et.extractBinaryTagToBuffer(tag, path)
      if (buf && buf.length > 0) return buf
    } catch {
      /* try the next tag */
    }
  }
  throw new Error(`No embedded preview found in ${path}`)
}

// --- public API ---

/**
 * A sharp pipeline for the fully decoded, upright image — ready to `.resize()`
 * / `.toFile()`. Standard formats and RAW previews auto-orient from EXIF via
 * `.rotate()`; HEIC is oriented explicitly since its buffer carries no EXIF.
 */
export async function loadImage(path: string): Promise<sharp.Sharp> {
  const ext = extOf(path)

  if (HEIC_EXTS.has(ext)) {
    const buf = await fs.readFile(path)
    const decode = await heicDecoder()
    const { width, height, data } = await decode({ buffer: buf })
    const base = sharp(Buffer.from(data as ArrayBuffer), {
      raw: { width, height, channels: 4 },
      limitInputPixels: false
    })
    return applyOrientation(base, await exifOrientation(path))
  }

  if (RAW_EXTS.has(ext)) {
    const jpg = await rawEmbeddedJpeg(path)
    // Embedded RAW previews usually carry NO EXIF orientation of their own
    // (Canon/Nikon/Sony all extract as orientation-less JPEGs), so `.rotate()`
    // is a no-op and a portrait shot comes out sideways. Prefer the preview's
    // own orientation when present, else fall back to the RAW's Orientation tag.
    const meta = await sharp(jpg).metadata()
    const base = sharp(jpg, { failOn: 'none', limitInputPixels: false })
    if (meta.orientation && meta.orientation !== 1) return base.rotate()
    return applyOrientation(base, await exifOrientation(path))
  }

  return sharp(path, { failOn: 'none', limitInputPixels: false, animated: false }).rotate()
}

/** Display dimensions (accounting for orientation) without a full decode. */
export async function imageSize(path: string): Promise<{ width: number; height: number }> {
  const ext = extOf(path)

  if (RAW_EXTS.has(ext)) {
    try {
      const et = await exif()
      const t = await et.read(path)
      let w = Number(t.ImageWidth) || 0
      let h = Number(t.ImageHeight) || 0
      if (orientationNum(t.Orientation) >= 5) [w, h] = [h, w]
      if (w && h) return { width: w, height: h }
    } catch {
      /* fall through to a decode-based measure */
    }
    try {
      const meta = await (await loadImage(path)).metadata()
      return { width: meta.width ?? 0, height: meta.height ?? 0 }
    } catch {
      return { width: 0, height: 0 }
    }
  }

  // HEIC + standard: sharp can read container metadata even when it can't decode.
  try {
    const m = await sharp(path, { failOn: 'none' }).metadata()
    let w = m.width ?? 0
    let h = m.height ?? 0
    let o = m.orientation
    if (HEIC_EXTS.has(ext)) o = await exifOrientation(path)
    if (o && o >= 5) [w, h] = [h, w]
    return { width: w, height: h }
  } catch {
    return { width: 0, height: 0 }
  }
}

/**
 * Rich EXIF for RAW/HEIC via exiftool (exifr can't read either). Returns a
 * plain tag object; the caller maps it into ExifInfo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exifToolTags(path: string): Promise<Record<string, any> | undefined> {
  try {
    const et = await exif()
    return await et.read(path)
  } catch {
    return undefined
  }
}
