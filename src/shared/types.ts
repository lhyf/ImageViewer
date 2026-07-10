// Shared data contracts between the main process, preload bridge and renderer.

/** A single image file discovered inside a folder. */
export interface ImageItem {
  /** Absolute path on disk. */
  path: string
  /** File name including extension. */
  name: string
  /** Lower-case extension without the dot, e.g. "jpg". */
  ext: string
  /** Size in bytes. */
  size: number
  /** Last-modified time in epoch milliseconds. */
  mtime: number
}

/** A folder node for the left-hand directory tree. */
export interface DirNode {
  path: string
  name: string
  /** Whether the folder contains sub-folders (drives the expand arrow). */
  hasChildren: boolean
  /** True for a drive root such as C:\. */
  isDrive?: boolean
}

/** Result of scanning a folder for images. */
export interface ScanResult {
  dir: string
  images: ImageItem[]
}

/** Full metadata for a single image, including decoded dimensions and EXIF. */
export interface ImageMeta {
  path: string
  name: string
  ext: string
  size: number
  mtime: number
  width: number
  height: number
  /** Selected, human-friendly EXIF fields (camera, exposure, GPS, ...). */
  exif?: ExifInfo
}

export interface ExifInfo {
  make?: string
  model?: string
  lensModel?: string
  dateTimeOriginal?: string
  exposureTime?: string
  fNumber?: string
  iso?: number
  focalLength?: string
  orientation?: number
  gpsLatitude?: number
  gpsLongitude?: number
  [key: string]: unknown
}

export type SortKey = 'name' | 'date' | 'size' | 'type'

export interface SortSpec {
  key: SortKey
  asc: boolean
}

/** File operations the renderer can request from the main process. */
export interface RenameResult {
  ok: boolean
  newPath?: string
  error?: string
}

export interface OpResult {
  ok: boolean
  error?: string
}

export type ThemeName = 'dark' | 'light'
export type Platform = 'win32' | 'darwin' | 'linux'
