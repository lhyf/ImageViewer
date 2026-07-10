import { useEffect, useRef, useState } from 'react'
import { ArrowDownUp, Check, ArrowUp, ArrowDown } from 'lucide-react'
import type { SortKey } from '@shared/types'
import { useStore } from '../../store'

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '名称' },
  { key: 'date', label: '修改日期' },
  { key: 'size', label: '大小' },
  { key: 'type', label: '类型' }
]

export default function SortMenu(): React.JSX.Element {
  const sort = useStore((s) => s.sort)
  const setSort = useStore((s) => s.setSort)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = OPTIONS.find((o) => o.key === sort.key)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors hover:bg-[var(--app-hover)]"
        style={{ color: 'var(--app-text)' }}
        title="排序方式"
      >
        <ArrowDownUp size={14} />
        <span>{current?.label}</span>
        {sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      </button>
      {open && (
        <div
          className="animate-fade-in absolute right-0 top-8 z-30 w-36 overflow-hidden rounded-lg py-1 shadow-lg"
          style={{
            background: 'var(--app-surface)',
            border: '1px solid var(--app-border)',
            boxShadow: 'var(--shadow)'
          }}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setSort({ key: o.key, asc: sort.key === o.key ? sort.asc : true })}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--app-hover)]"
            >
              <Check
                size={13}
                style={{ opacity: sort.key === o.key ? 1 : 0, color: 'var(--app-accent)' }}
              />
              {o.label}
            </button>
          ))}
          <div className="my-1 h-px" style={{ background: 'var(--app-border)' }} />
          <button
            onClick={() => setSort({ key: sort.key, asc: true })}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--app-hover)]"
          >
            <Check size={13} style={{ opacity: sort.asc ? 1 : 0, color: 'var(--app-accent)' }} />
            升序
          </button>
          <button
            onClick={() => setSort({ key: sort.key, asc: false })}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--app-hover)]"
          >
            <Check size={13} style={{ opacity: !sort.asc ? 1 : 0, color: 'var(--app-accent)' }} />
            降序
          </button>
        </div>
      )}
    </div>
  )
}
