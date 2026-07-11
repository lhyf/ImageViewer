import { useEffect, useRef, useState } from 'react'
import type { ImageItem } from '@shared/types'
import { mediaUrl } from '../../lib/util'

const THUMB = 58

function Cell({
  item,
  active,
  onClick
}: {
  item: ImageItem
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  // Lazy-load thumbnails only once the cell scrolls into view.
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { root: null, rootMargin: '300px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  useEffect(() => {
    if (!seen) return
    let alive = true
    window.api.image.thumbnail(item.path, 128).then((p) => alive && setSrc(mediaUrl(p)))
    return () => {
      alive = false
    }
  }, [seen, item.path])

  return (
    <div
      ref={ref}
      onClick={onClick}
      title={item.name}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded transition-all"
      style={{
        width: THUMB,
        height: THUMB,
        background: 'var(--app-hover)',
        outline: active ? '2px solid var(--app-accent)' : '1px solid transparent',
        outlineOffset: -1,
        opacity: active ? 1 : 0.72
      }}
    >
      {src && <img src={src} alt="" draggable={false} className="max-h-full max-w-full object-cover" />}
    </div>
  )
}

export default function Filmstrip({
  images,
  index,
  onSelect
}: {
  images: ImageItem[]
  index: number
  onSelect: (i: number) => void
}): React.JSX.Element {
  const activeRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Left-button drag to pan the strip horizontally. `moved` tells a drag (which
  // must NOT select an image) apart from a plain click (which selects).
  const drag = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null)

  // Keep the current image centered as it changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [index])

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = drag.current
      const el = scrollRef.current
      if (!d || !el) return
      const dx = e.clientX - d.startX
      if (Math.abs(dx) > 4) d.moved = true
      el.scrollLeft = d.startLeft - dx
    }
    const onUp = (): void => {
      if (!drag.current) return
      // Keep the flag alive through the click that follows a drag so it can be
      // swallowed; for a plain click clear now so it selects normally.
      if (drag.current.moved) setTimeout(() => (drag.current = null), 0)
      else drag.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0 || !scrollRef.current) return
    drag.current = { startX: e.clientX, startLeft: scrollRef.current.scrollLeft, moved: false }
  }

  // Swallow the click that ends a drag so it doesn't select an image.
  const onClickCapture = (e: React.MouseEvent): void => {
    if (drag.current?.moved) {
      e.stopPropagation()
      e.preventDefault()
    }
  }

  return (
    <div
      ref={scrollRef}
      onMouseDown={onMouseDown}
      onClickCapture={onClickCapture}
      className="flex h-[74px] w-full shrink-0 cursor-grab select-none items-center gap-1.5 overflow-x-auto px-2 active:cursor-grabbing"
      style={{
        background: 'var(--app-surface)',
        borderTop: '1px solid var(--app-border)',
        scrollbarWidth: 'thin'
      }}
    >
      {images.map((im, i) => (
        <div key={im.path} ref={i === index ? activeRef : undefined} className="shrink-0">
          <Cell item={im} active={i === index} onClick={() => onSelect(i)} />
        </div>
      ))}
    </div>
  )
}
