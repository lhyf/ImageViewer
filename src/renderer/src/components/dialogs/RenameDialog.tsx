import { useEffect, useRef, useState } from 'react'
import Modal from '../Modal'
import { useUI } from '../../useUI'
import { useStore } from '../../store'

export default function RenameDialog(): React.JSX.Element | null {
  const target = useUI((s) => s.renameTarget)
  const close = useUI((s) => s.setRenameTarget)
  const showToast = useUI((s) => s.showToast)
  const updatePathInList = useStore((s) => s.updatePathInList)

  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (target) {
      setValue(target.name)
      setError('')
      // Select the name without extension.
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (!el) return
        el.focus()
        const dot = target.name.lastIndexOf('.')
        el.setSelectionRange(0, dot > 0 ? dot : target.name.length)
      })
    }
  }, [target])

  if (!target) return null

  const submit = async (): Promise<void> => {
    const r = await window.api.ops.rename(target.path, value)
    if (r.ok && r.newPath) {
      updatePathInList(target.path, r.newPath)
      showToast('已重命名')
      close(null)
    } else {
      setError(r.error ?? '重命名失败')
    }
  }

  return (
    <Modal title="重命名" onClose={() => close(null)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        className="w-full rounded-md px-3 py-2 text-[13px] outline-none"
        style={{
          background: 'var(--app-panel)',
          border: `1px solid ${error ? '#ff5c5c' : 'var(--app-border)'}`,
          color: 'var(--app-text)'
        }}
      />
      {error && (
        <div className="mt-1.5 text-[12px]" style={{ color: '#ff5c5c' }}>
          {error}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => close(null)}
          className="rounded-md px-4 py-1.5 text-[13px] transition-colors hover:bg-[var(--app-hover)]"
          style={{ border: '1px solid var(--app-border)' }}
        >
          取消
        </button>
        <button
          onClick={submit}
          className="rounded-md px-4 py-1.5 text-[13px] font-medium text-white transition-transform active:scale-95"
          style={{ background: 'var(--app-accent)' }}
        >
          确定
        </button>
      </div>
    </Modal>
  )
}
