import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X, Sun, Moon, Images } from 'lucide-react'
import { useStore } from '../store'

const isMac = window.api.platform === 'darwin'

function ControlButton({
  onClick,
  danger,
  children,
  title
}: {
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
  title: string
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className="no-drag flex h-full w-[46px] items-center justify-center transition-colors"
      style={{ color: 'var(--app-text)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#e81123' : 'var(--app-hover)'
        if (danger) e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--app-text)'
      }}
    >
      {children}
    </button>
  )
}

export default function TitleBar(): React.JSX.Element {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizeChange(setMaximized)
  }, [])

  return (
    <div
      className="drag-region flex h-10 shrink-0 items-center"
      style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}
      onDoubleClick={() => window.api.window.toggleMaximize()}
    >
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: isMac ? 78 : 12, paddingRight: 12 }}
      >
        <Images size={16} style={{ color: 'var(--app-accent)' }} />
        <span className="text-[13px] font-semibold tracking-wide">ImageViewer</span>
      </div>

      <div className="h-full flex-1" />

      <div className="no-drag flex h-full items-center">
        <button
          title="切换主题"
          onClick={toggleTheme}
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--app-hover)]"
          style={{ color: 'var(--app-muted)' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {!isMac && (
          <div className="ml-1 flex h-full">
            <ControlButton title="最小化" onClick={() => window.api.window.minimize()}>
              <Minus size={16} />
            </ControlButton>
            <ControlButton title="最大化" onClick={() => window.api.window.toggleMaximize()}>
              {maximized ? <Copy size={13} /> : <Square size={13} />}
            </ControlButton>
            <ControlButton title="关闭" danger onClick={() => window.api.window.close()}>
              <X size={17} />
            </ControlButton>
          </div>
        )}
      </div>
    </div>
  )
}
