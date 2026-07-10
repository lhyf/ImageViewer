import { useEffect, useState } from 'react'
import { ImageDown } from 'lucide-react'
import TitleBar from './components/TitleBar'
import Browser from './components/Browser'
import Viewer from './components/Viewer'
import ContextMenu from './components/ContextMenu'
import Toast from './components/Toast'
import RenameDialog from './components/dialogs/RenameDialog'
import InfoDialog from './components/dialogs/InfoDialog'
import { useStore } from './store'
import { useUI } from './useUI'

export default function App(): React.JSX.Element {
  const theme = useStore((s) => s.theme)
  const mode = useStore((s) => s.mode)
  const images = useStore((s) => s.images)
  const fullscreen = useUI((s) => s.fullscreen)
  const setFullscreen = useUI((s) => s.setFullscreen)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const onFs = (): void => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [setFullscreen])

  // Open a file the OS launched us with, and any handed over while running.
  useEffect(() => {
    window.api.app.getInitialFile().then((p) => {
      if (p) useStore.getState().openPath(p)
    })
    return window.api.app.onOpenFile((p) => useStore.getState().openPath(p))
  }, [])

  // Drag a photo (or folder) onto the window: open it and load its folder.
  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
    const onOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragActive(true)
    }
    const onLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null) setDragActive(false)
    }
    const onDrop = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      const path = window.api.getPathForFile(file)
      if (path) useStore.getState().openDropped(path)
    }
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const showViewer = mode === 'viewer' && images.length > 0

  return (
    <div className="flex h-full flex-col">
      {!fullscreen && <TitleBar />}
      <div className="relative min-h-0 flex-1">{showViewer ? <Viewer /> : <Browser />}</div>
      <ContextMenu />
      <RenameDialog />
      <InfoDialog />
      <Toast />
      {dragActive && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)' }}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-2xl px-12 py-9"
            style={{
              border: '2px dashed var(--app-accent)',
              background: 'var(--app-surface)',
              color: 'var(--app-accent)'
            }}
          >
            <ImageDown size={44} strokeWidth={1.5} />
            <div className="text-[13px] font-medium">拖放到此处打开</div>
          </div>
        </div>
      )}
    </div>
  )
}
