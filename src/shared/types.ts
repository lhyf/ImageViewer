// Shared data contracts between the main process, preload bridge and renderer.

/**
 * Edge length of the thumbnail the grid, folder covers and the viewer's
 * placeholder all share, so each image has a single cached one.
 */
export const THUMB_SIZE = 384

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

/** A sub-folder, listed in the grid ahead of the images so it can be entered. */
export interface FolderItem {
  path: string
  name: string
  /** Last-modified time in epoch milliseconds. */
  mtime: number
}

/** What a sub-folder directly holds, for its grid tile. */
export interface FolderPeek {
  /** Number of images directly inside it. */
  count: number
  /** Its first image by name, shown as the folder's cover. */
  cover: string | null
}

/** Result of scanning a folder: its sub-folders and its images. */
export interface ScanResult {
  dir: string
  folders: FolderItem[]
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
