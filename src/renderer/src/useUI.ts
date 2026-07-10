import { create } from 'zustand'
import type { ReactNode } from 'react'
import type { ImageItem } from '@shared/types'

export interface MenuItem {
  type?: 'item' | 'separator'
  label?: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

interface UIState {
  menu: MenuState | null
  openMenu: (x: number, y: number, items: MenuItem[]) => void
  closeMenu: () => void

  renameTarget: ImageItem | null
  setRenameTarget: (item: ImageItem | null) => void

  infoPath: string | null
  setInfoPath: (path: string | null) => void

  slideshow: boolean
  setSlideshow: (v: boolean) => void

  fullscreen: boolean
  setFullscreen: (v: boolean) => void

  toast: string | null
  showToast: (msg: string) => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUI = create<UIState>((set) => ({
  menu: null,
  openMenu: (x, y, items) => set({ menu: { x, y, items } }),
  closeMenu: () => set({ menu: null }),

  renameTarget: null,
  setRenameTarget: (renameTarget) => set({ renameTarget }),

  infoPath: null,
  setInfoPath: (infoPath) => set({ infoPath }),

  slideshow: false,
  setSlideshow: (slideshow) => set({ slideshow }),

  fullscreen: false,
  setFullscreen: (fullscreen) => set({ fullscreen }),

  toast: null,
  showToast: (toast) => {
    set({ toast })
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 2200)
  }
}))
