import { FolderOpen, ImageIcon } from 'lucide-react'
import { useStore } from '../store'

export default function EmptyState(): React.JSX.Element {
  const openFolder = useStore((s) => s.openFolderDialog)
  const openFiles = useStore((s) => s.openFilesDialog)

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-6"
      style={{ background: 'var(--app-bg)' }}
    >
      <div
        className="flex h-24 w-24 items-center justify-center rounded-3xl"
        style={{ background: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
      >
        <ImageIcon size={46} strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">ImageViewer</div>
        <div className="mt-1 text-[13px]" style={{ color: 'var(--app-muted)' }}>
          打开一张图片或一个文件夹开始浏览
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={openFiles}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-medium text-white transition-transform active:scale-95"
          style={{ background: 'var(--app-accent)' }}
        >
          <ImageIcon size={16} />
          打开图片
        </button>
        <button
          onClick={openFolder}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-[var(--app-hover)]"
          style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
        >
          <FolderOpen size={16} />
          打开文件夹
        </button>
      </div>
      <div className="mt-2 text-[12px]" style={{ color: 'var(--app-muted)' }}>
        支持 JPG · PNG · GIF · WebP · BMP · TIFF · AVIF 等格式
      </div>
    </div>
  )
}
