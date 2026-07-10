import { useEffect } from 'react'

export default function Modal({
  title,
  onClose,
  children,
  width = 420
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,.45)' }}
      onMouseDown={onClose}
    >
      <div
        className="animate-fade-in overflow-hidden rounded-xl"
        style={{
          width,
          maxWidth: '90vw',
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          boxShadow: 'var(--shadow)'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex h-11 items-center px-4 text-[13px] font-semibold"
          style={{ borderBottom: '1px solid var(--app-border)' }}
        >
          {title}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
