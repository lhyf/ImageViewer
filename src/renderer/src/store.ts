import { create } from 'zustand'
import type { ImageItem, SortSpec, ThemeName } from '@shared/types'
import { dirName, sortImages } from './lib/util'

export type Mode = 'browser' | 'viewer'

interface AppState {
  mode: Mode
  theme: ThemeName
  currentDir: string | null
  images: ImageItem[]
  index: number
  sort: SortSpec
  loading: boolean

  history: string[]
  histIndex: number

  setTheme: (t: ThemeName) => void
  toggleTheme: () => void
  setMode: (m: Mode) => void
  setSort: (s: SortSpec) => void
  setIndex: (i: number) => void

  openFolderDialog: () => Promise<void>
  openFilesDialog: () => Promise<void>
  loadDir: (dir: string, selectPath?: string, enterViewer?: boolean) => Promise<void>
  go: (dir: string) => Promise<void>
  back: () => Promise<void>
  forward: () => Promise<void>
  up: () => Promise<void>
  reload: () => Promise<void>

  openImageAt: (index: number) => void
  next: () => void
  prev: () => void
  removeCurrentFromList: () => void
  updatePathInList: (oldPath: string, newPath: string) => void
  backToBrowser: () => void
}

const savedTheme = (localStorage.getItem('theme') as ThemeName) || 'dark'

export const useStore = create<AppState>((set, get) => ({
  mode: 'browser',
  theme: savedTheme,
  currentDir: null,
  images: [],
  index: 0,
  sort: { key: 'name', asc: true },
  loading: false,

  history: [],
  histIndex: -1,

  setTheme: (t) => {
    localStorage.setItem('theme', t)
    document.documentElement.dataset.theme = t
    set({ theme: t })
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setMode: (mode) => set({ mode }),
  setSort: (sort) => set({ sort, images: sortImages(get().images, sort) }),
  setIndex: (index) => set({ index }),

  openFolderDialog: async () => {
    const dir = await window.api.dialog.openFolder()
    if (dir) await get().go(dir)
  },

  openFilesDialog: async () => {
    const files = await window.api.dialog.openFiles()
    if (files.length) {
      const first = files[0]
      const dir = dirName(first)
      await get().loadDir(dir, first, true)
      set({ history: [dir], histIndex: 0 })
    }
  },

  loadDir: async (dir, selectPath, enterViewer = false) => {
    set({ loading: true })
    const res = await window.api.fs.scanDir(dir)
    const images = sortImages(res.images, get().sort)
    let index = 0
    if (selectPath) {
      const i = images.findIndex((im) => im.path === selectPath)
      if (i >= 0) index = i
    }
    set({
      currentDir: dir,
      images,
      index,
      loading: false,
      mode: enterViewer ? 'viewer' : get().mode
    })
  },

  go: async (dir) => {
    await get().loadDir(dir)
    const { history, histIndex } = get()
    const trimmed = history.slice(0, histIndex + 1)
    if (trimmed[trimmed.length - 1] !== dir) trimmed.push(dir)
    set({ history: trimmed, histIndex: trimmed.length - 1 })
  },

  back: async () => {
    const { history, histIndex } = get()
    if (histIndex > 0) {
      const i = histIndex - 1
      set({ histIndex: i })
      await get().loadDir(history[i])
    }
  },
  forward: async () => {
    const { history, histIndex } = get()
    if (histIndex < history.length - 1) {
      const i = histIndex + 1
      set({ histIndex: i })
      await get().loadDir(history[i])
    }
  },
  up: async () => {
    const { currentDir } = get()
    if (!currentDir) return
    const p = await window.api.fs.parent(currentDir)
    if (p) await get().go(p)
  },

  reload: async () => {
    const { currentDir, images, index } = get()
    if (!currentDir) return
    const selected = images[index]?.path
    await get().loadDir(currentDir, selected, false)
  },

  openImageAt: (index) => set({ index, mode: 'viewer' }),

  next: () => {
    const { index, images } = get()
    if (images.length) set({ index: (index + 1) % images.length })
  },
  prev: () => {
    const { index, images } = get()
    if (images.length) set({ index: (index - 1 + images.length) % images.length })
  },

  removeCurrentFromList: () => {
    const { images, index } = get()
    if (!images.length) return
    const next = images.filter((_, i) => i !== index)
    set({ images: next, index: Math.min(index, Math.max(0, next.length - 1)) })
  },

  updatePathInList: (oldPath, newPath) => {
    set({
      images: get().images.map((im) =>
        im.path === oldPath
          ? { ...im, path: newPath, name: newPath.replace(/^.*[\\/]/, '') }
          : im
      )
    })
  },

  backToBrowser: () => set({ mode: 'browser' })
}))
