import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCw,
  Search,
  ChevronRight,
  Images as ImagesIcon
} from 'lucide-react'
import { useStore } from '../store'
import { useUI } from '../useUI'
import { useImageMenu } from '../hooks/useImageMenu'
import { breadcrumbSegments, baseName, formatBytes, formatDate } from '../lib/util'
import FolderTree from './browser/FolderTree'
import ThumbGrid from './browser/ThumbGrid'
import SortMenu from './browser/SortMenu'
import EmptyState from './EmptyState'

function NavBtn({
  icon,
  onClick,
  disabled,
  title
}: {
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors enabled:hover:bg-[var(--app-hover)] disabled:opacity-30"
      style={{ color: 'var(--app-text)' }}
    >
      {icon}
    </button>
  )
}

export default function Browser(): React.JSX.Element {
  const currentDir = useStore((s) => s.currentDir)
  const images = useStore((s) => s.images)
  const index = useStore((s) => s.index)
  const history = useStore((s) => s.history)
  const histIndex = useStore((s) => s.histIndex)
  const go = useStore((s) => s.go)
  const back = useStore((s) => s.back)
  const forward = useStore((s) => s.forward)
  const up = useStore((s) => s.up)
  const reload = useStore((s) => s.reload)
  const setIndex = useStore((s) => s.setIndex)
  const openImageAt = useStore((s) => s.openImageAt)
  const openMenu = useUI((s) => s.openMenu)
  const buildMenu = useImageMenu()

  const [query, setQuery] = useState('')
  const [thumbSize, setThumbSize] = useState(132)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  const segments = currentDir ? breadcrumbSegments(currentDir) : []
  const selected = images[index]

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? images.filter((im) => im.name.toLowerCase().includes(q)) : images
  }, [images, query])

  // Fetch dimensions for the selected image (for the status bar).
  useEffect(() => {
    setDims(null)
    if (!selected) return
    let alive = true
    window.api.image.meta(selected.path).then((m) => {
      if (alive) setDims({ w: m.width, h: m.height })
    })
    return () => {
      alive = false
    }
  }, [selected?.path])

  const toReal = (visIndex: number): number =>
    images.findIndex((im) => im.path === visible[visIndex].path)

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--app-bg)' }}>
      <div className="flex min-h-0 flex-1">
        <div className="w-[220px] shrink-0">
          <FolderTree />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top: nav + breadcrumb + search */}
          <div
            className="flex h-11 shrink-0 items-center gap-1 px-2"
            style={{ borderBottom: '1px solid var(--app-border)' }}
          >
            <NavBtn
              icon={<ArrowLeft size={17} />}
              title="后退"
              onClick={back}
              disabled={histIndex <= 0}
            />
            <NavBtn
              icon={<ArrowRight size={17} />}
              title="前进"
              onClick={forward}
              disabled={histIndex >= history.length - 1}
            />
            <NavBtn icon={<ArrowUp size={17} />} title="上一级" onClick={up} />
            <NavBtn icon={<RotateCw size={15} />} title="刷新" onClick={reload} />

            <div
              className="mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden rounded-md px-2 py-1"
              style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)' }}
            >
              {segments.map((seg, i) => (
                <div key={seg.path} className="flex min-w-0 items-center">
                  {i > 0 && (
                    <ChevronRight
                      size={13}
                      className="mx-0.5 shrink-0"
                      style={{ color: 'var(--app-muted)' }}
                    />
                  )}
                  <button
                    onClick={() => go(seg.path)}
                    className="truncate rounded px-1 py-0.5 text-[12px] transition-colors hover:bg-[var(--app-hover)]"
                    style={{ color: 'var(--app-text)' }}
                  >
                    {seg.name}
                  </button>
                </div>
              ))}
            </div>

            <div
              className="flex h-7 w-48 items-center gap-1.5 rounded-md px-2"
              style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)' }}
            >
              <Search size={14} style={{ color: 'var(--app-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索图片"
                className="w-full bg-transparent text-[12px] outline-none"
                style={{ color: 'var(--app-text)' }}
              />
            </div>
          </div>

          {/* Sub-bar: folder name + count + sort + size slider */}
          <div
            className="flex h-9 shrink-0 items-center px-3"
            style={{ borderBottom: '1px solid var(--app-border)' }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-semibold">
                {currentDir ? baseName(currentDir) : ''}
              </span>
              <span className="shrink-0 text-[12px]" style={{ color: 'var(--app-muted)' }}>
                {images.length} 张图片{query && ` · 匹配 ${visible.length}`}
              </span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={90}
                max={240}
                value={thumbSize}
                onChange={(e) => setThumbSize(Number(e.target.value))}
                className="accent-[var(--app-accent)]"
                style={{ width: 96 }}
                title="缩略图大小"
              />
              <SortMenu />
            </div>
          </div>

          {/* Grid */}
          <div className="min-h-0 flex-1">
            {!currentDir ? (
              <EmptyState />
            ) : visible.length ? (
              <ThumbGrid
                items={visible}
                size={thumbSize}
                selectedPath={selected?.path ?? null}
                onSelect={(i) => setIndex(toReal(i))}
                onOpen={(i) => openImageAt(toReal(i))}
                onContext={(i, e) => {
                  e.preventDefault()
                  const real = toReal(i)
                  setIndex(real)
                  openMenu(e.clientX, e.clientY, buildMenu(images[real], real))
                }}
              />
            ) : (
              <div
                className="flex h-full flex-col items-center justify-center gap-3"
                style={{ color: 'var(--app-muted)' }}
              >
                <ImagesIcon size={40} strokeWidth={1.5} />
                <span className="text-[13px]">
                  {images.length ? '没有匹配的图片' : '此文件夹中没有图片'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex h-6 shrink-0 items-center gap-3 px-3 text-[12px]"
        style={{
          background: 'var(--app-surface)',
          borderTop: '1px solid var(--app-border)',
          color: 'var(--app-muted)'
        }}
      >
        {selected ? (
          <>
            <span className="truncate" style={{ maxWidth: 320, color: 'var(--app-text)' }}>
              {selected.name}
            </span>
            {dims && <span>{`${dims.w} × ${dims.h}`}</span>}
            <span>{formatBytes(selected.size)}</span>
            <span>{formatDate(selected.mtime)}</span>
            <div className="flex-1" />
            <span>
              {index + 1} / {images.length}
            </span>
          </>
        ) : (
          <span>{images.length} 张图片</span>
        )}
      </div>
    </div>
  )
}
