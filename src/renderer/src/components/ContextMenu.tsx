import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUI } from '../useUI'

export default function ContextMenu(): React.JSX.Element | null {
  const menu = useUI((s) => s.menu)
  const closeMenu = useUI((s) => s.closeMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!menu) return
    const close = (): void => closeMenu()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, closeMenu])

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const pad = 6
    let x = menu.x
    let y = menu.y
    if (x + rect.width + pad > window.innerWidth) x = window.innerWidth - rect.width - pad
    if (y + rect.height + pad > window.innerHeight) y = window.innerHeight - rect.height - pad
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }, [menu])

  if (!menu) return null

  return (
    <div
      ref={ref}
      className="animate-fade-in fixed z-50 min-w-[176px] overflow-hidden rounded-lg py-1"
      style={{
        left: pos.x,
        top: pos.y,
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
        boxShadow: 'var(--shadow)'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((it, i) =>
        it.type === 'separator' ? (
          <div key={i} className="my-1 h-px" style={{ background: 'var(--app-border)' }} />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              closeMenu()
              it.onClick?.()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors enabled:hover:bg-[var(--app-hover)] disabled:opacity-40"
            style={{ color: it.danger ? '#ff5c5c' : 'var(--app-text)' }}
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center"
              style={{ color: it.danger ? '#ff5c5c' : 'var(--app-muted)' }}
            >
              {it.icon}
            </span>
            {it.label}
          </button>
        )
      )}
    </div>
  )
}
