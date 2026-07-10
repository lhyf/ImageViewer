import { useEffect } from 'react'
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

  const showViewer = mode === 'viewer' && images.length > 0

  return (
    <div className="flex h-full flex-col">
      {!fullscreen && <TitleBar />}
      <div className="relative min-h-0 flex-1">{showViewer ? <Viewer /> : <Browser />}</div>
      <ContextMenu />
      <RenameDialog />
      <InfoDialog />
      <Toast />
    </div>
  )
}
