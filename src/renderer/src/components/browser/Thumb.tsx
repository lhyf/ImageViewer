import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { ImageItem } from '@shared/types'
import { mediaUrl } from '../../lib/util'

interface ThumbProps {
  item: ImageItem
  size: number
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

/** A single grid cell: thumbnail image + file name, lazily generated. */
export default function Thumb({
  item,
  size,
  selected,
  onSelect,
  onOpen,
  onContextMenu
}: ThumbProps): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const alive = useRef(true)

  // Thumbnails are generated at ONE fixed resolution and only scaled with CSS to
  // fit the cell. This keeps the size slider free (pure re-layout) instead of
  // regenerating every thumbnail at each intermediate slider value.
  useEffect(() => {
    alive.current = true
    setSrc(null)
    setError(false)
    window.api.image
      .thumbnail(item.path, 384)
      .then((cachePath) => {
        if (alive.current) setSrc(mediaUrl(cachePath))
      })
      .catch(() => alive.current && setError(true))
    return () => {
      alive.current = false
    }
  }, [item.path, item.mtime])

  const pad = 10
  return (
    <div
      className="flex cursor-default flex-col items-center"
      style={{ width: size + pad * 2, padding: pad }}
      onMouseDown={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        onSelect()
        onContextMenu(e)
      }}
      title={item.name}
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-md transition-all"
        style={{
          width: size,
          height: size,
          background: selected ? 'var(--app-accent-soft)' : 'var(--app-hover)',
          outline: selected ? '2px solid var(--app-accent)' : '1px solid var(--app-border)',
          outlineOffset: selected ? 0 : -1
        }}
      >
        {src && !error ? (
          <img
            src={src}
            alt={item.name}
            className="max-h-full max-w-full object-contain"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,.35)' }}
            onError={() => setError(true)}
          />
        ) : error ? (
          <ImageOff size={24} style={{ color: 'var(--app-muted)' }} />
        ) : (
          <div className="h-6 w-6 animate-pulse rounded-full" style={{ background: 'var(--app-border)' }} />
        )}
      </div>
      <div
        className="mt-1.5 w-full truncate px-1 text-center text-[12px] leading-tight"
        style={{
          maxWidth: size + pad,
          color: selected ? 'var(--app-accent)' : 'var(--app-text)'
        }}
      >
        {item.name}
      </div>
    </div>
  )
}
