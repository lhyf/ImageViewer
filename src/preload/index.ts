import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  ScanResult,
  DirNode,
  ImageMeta,
  OpResult,
  RenameResult
} from '../shared/types'

const api = {
  platform: process.platform,

  // Resolve the absolute path of a dropped/selected File (Electron 33 removed
  // File.path, so this must go through webUtils).
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  app: {
    // Path the OS launched us with ("Open with" / double-click), pulled once on boot.
    getInitialFile: (): Promise<string | null> => ipcRenderer.invoke('app:getInitialFile'),
    // Fired when the app is already running and the OS hands it another file.
    onOpenFile: (cb: (path: string) => void): (() => void) => {
      const handler = (_e: unknown, p: string): void => cb(p)
      ipcRenderer.on('app:openFile', handler)
      return () => ipcRenderer.removeListener('app:openFile', handler)
    }
  },

  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
      const handler = (_e: unknown, v: boolean): void => cb(v)
      ipcRenderer.on('window:maximized', handler)
      return () => ipcRenderer.removeListener('window:maximized', handler)
    }
  },

  dialog: {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
    openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles')
  },

  fs: {
    scanDir: (dir: string): Promise<ScanResult> => ipcRenderer.invoke('fs:scanDir', dir),
    treeRoots: (): Promise<DirNode[]> => ipcRenderer.invoke('fs:treeRoots'),
    childDirs: (dir: string): Promise<DirNode[]> => ipcRenderer.invoke('fs:childDirs', dir),
    quickAccess: (): Promise<DirNode[]> => ipcRenderer.invoke('fs:quickAccess'),
    parent: (dir: string): Promise<string | null> => ipcRenderer.invoke('fs:parent', dir),
    pathKind: (path: string): Promise<'dir' | 'file' | null> =>
      ipcRenderer.invoke('fs:pathKind', path)
  },

  image: {
    thumbnail: (path: string, size?: number): Promise<string> =>
      ipcRenderer.invoke('img:thumbnail', path, size),
    preview: (path: string, max?: number): Promise<string> =>
      ipcRenderer.invoke('img:preview', path, max),
    meta: (path: string): Promise<ImageMeta> => ipcRenderer.invoke('img:meta', path)
  },

  ops: {
    trash: (path: string): Promise<OpResult> => ipcRenderer.invoke('op:trash', path),
    rename: (path: string, newBase: string): Promise<RenameResult> =>
      ipcRenderer.invoke('op:rename', path, newBase),
    saveAs: (path: string): Promise<OpResult> => ipcRenderer.invoke('op:saveAs', path),
    copyImage: (path: string): Promise<OpResult> => ipcRenderer.invoke('op:copyImage', path),
    showInFolder: (path: string): Promise<OpResult> =>
      ipcRenderer.invoke('op:showInFolder', path),
    openDefault: (path: string): Promise<OpResult> => ipcRenderer.invoke('op:openDefault', path),
    openWith: (path: string): Promise<OpResult> => ipcRenderer.invoke('op:openWith', path),
    setWallpaper: (path: string): Promise<OpResult> =>
      ipcRenderer.invoke('op:setWallpaper', path),
    print: (path: string): Promise<OpResult> => ipcRenderer.invoke('op:print', path)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
