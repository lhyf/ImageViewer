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
      className="flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded transition-all"
      style={{
        width: THUMB,
        height: THUMB,
        background: 'var(--app-hover)',
        outline: active ? '2px solid var(--app-accent)' : '1px solid transparent',
        outlineOffset: -1,
        opacity: active ? 1 : 0.72
      }}
    >
      {src && <img src={src} alt="" className="max-h-full max-w-full object-cover" />}
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

  // Keep the current image centered as it changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [index])

  return (
    <div
      className="flex h-[74px] w-full shrink-0 items-center gap-1.5 overflow-x-auto px-2"
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
