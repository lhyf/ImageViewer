import { useUI } from '../useUI'

export default function Toast(): React.JSX.Element | null {
  const toast = useUI((s) => s.toast)
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center">
      <div
        className="animate-fade-in rounded-full px-4 py-2 text-[13px] text-white"
        style={{ background: 'rgba(0,0,0,.8)', boxShadow: 'var(--shadow)' }}
      >
        {toast}
      </div>
    </div>
  )
}
