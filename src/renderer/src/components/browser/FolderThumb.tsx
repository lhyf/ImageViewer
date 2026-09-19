import { useEffect, useState } from 'react'
import { Folder } from 'lucide-react'
import { THUMB_SIZE, type FolderItem } from '@shared/types'
import { mediaUrl } from '../../lib/util'

interface FolderThumbProps {
  folder: FolderItem
  size: number
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}

/** A sub-folder grid cell: a folder with its first image as the cover. Double-click enters it. */
export default function FolderThumb({
  folder,
  size,
  selected,
  onSelect,
  onOpen
}: FolderThumbProps): React.JSX.Element {
  const [count, setCount] = useState(0)
  const [cover, setCover] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setCount(0)
    setCover(null)
    window.api.fs.peekDir(folder.path).then((p) => {
      if (!alive) return
      setCount(p.count)
      // Same size the grid caches, so the cover is already there on opening the folder.
      if (p.cover) {
        window.api.image
          .thumbnail(p.cover, THUMB_SIZE)
          .then((c) => alive && setCover(mediaUrl(c)))
      }
    })
    return () => {
      alive = false
    }
  }, [folder.path, folder.mtime])

  const pad = 10
  const icon = Math.round(size * 0.8)
  const u = icon / 24 // one unit of lucide's 24-unit icon grid
  return (
    <div
      className="flex cursor-default flex-col items-center"
      style={{ width: size + pad * 2, padding: pad }}
      onMouseDown={onSelect}
      onDoubleClick={onOpen}
      title={folder.name}
    >
      <div
        className="relative flex items-center justify-center rounded-md transition-all"
        style={{
          width: size,
          height: size,
          background: selected ? 'var(--app-accent-soft)' : 'var(--app-hover)',
          outline: selected ? '2px solid var(--app-accent)' : '1px solid var(--app-border)',
          outlineOffset: selected ? 0 : -1
        }}
      >
        <div className="relative" style={{ width: icon, height: icon }}>
          <Folder size={icon} strokeWidth={1.5} color="#e8b339" fill="#e8b339" />
          {cover && (
            // Laid inside the folder's body, which spans x 2–22, y 6–20 of the icon grid.
            <img
              src={cover}
              alt=""
              className="absolute rounded-sm object-cover"
              style={{ left: 3.5 * u, top: 7.5 * u, width: 17 * u, height: 11 * u }}
              onError={() => setCover(null)}
            />
          )}
        </div>
        {count > 0 && (
          <span
            className="absolute bottom-1.5 right-1.5 rounded-full px-1.5 text-[11px] leading-[18px] text-white"
            style={{ background: 'rgba(0,0,0,.55)' }}
          >
            {count} 张
          </span>
        )}
      </div>
      <div
        className="mt-1.5 w-full truncate px-1 text-center text-[12px] leading-tight"
        style={{
          maxWidth: size + pad,
          color: selected ? 'var(--app-accent)' : 'var(--app-text)'
        }}
      >
        {folder.name}
      </div>
    </div>
  )
}
