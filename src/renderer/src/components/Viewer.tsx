import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  LayoutGrid,
  Maximize,
  Expand,
  Shrink,
  ImageOff,
  Loader2
} from 'lucide-react'
import { useStore } from '../store'
import { useUI } from '../useUI'
import { useImageMenu } from '../hooks/useImageMenu'
import { mediaUrl, formatBytes, formatDate } from '../lib/util'
import Filmstrip from './viewer/Filmstrip'
import { useElementSize } from '../hooks/useElementSize'

const MIN_SCALE = 0.02
const MAX_SCALE = 32

interface Transform {
  scale: number
  tx: number
  ty: number
  rot: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

function ToolBtn({
  icon,
  onClick,
  title,
  danger
}: {
  icon: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/15"
      style={danger ? { color: '#ff6b6b' } : undefined}
    >
      {icon}
    </button>
  )
}

function Divider(): React.JSX.Element {
  return <div className="mx-1 h-5 w-px bg-white/15" />
}

export default function Viewer(): React.JSX.Element {
  const images = useStore((s) => s.images)
  const index = useStore((s) => s.index)
  const next = useStore((s) => s.next)
  const prev = useStore((s) => s.prev)
  const setIndex = useStore((s) => s.setIndex)
  const backToBrowser = useStore((s) => s.backToBrowser)
  const removeCurrentFromList = useStore((s) => s.removeCurrentFromList)
  const openMenu = useUI((s) => s.openMenu)
  const slideshow = useUI((s) => s.slideshow)
  const setSlideshow = useUI((s) => s.setSlideshow)
  const fullscreen = useUI((s) => s.fullscreen)
  const buildMenu = useImageMenu()

  const item = images[index]

  const [stageRef, stageSize] = useElementSize<HTMLDivElement>()
  const [t, setT] = useState<Transform>({ scale: 1, tx: 0, ty: 0, rot: 0 })
  const [dispNat, setDispNat] = useState<{ w: number; h: number } | null>(null)
  const [orig, setOrig] = useState<{ w: number; h: number } | null>(null)
  const [placeholder, setPlaceholder] = useState<string | null>(null)
  const [mainSrc, setMainSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)

  const tRef = useRef(t)
  tRef.current = t
  const dispRef = useRef<{ w: number; h: number } | null>(null)
  const sizeRef = useRef(stageSize)
  sizeRef.current = stageSize
  const fitFillRef = useRef(false)

  // ----- fit / zoom helpers (all relative to the displayed image's own pixels) -----
  const rawFit = useCallback(
    (nat: { w: number; h: number }, rot: number, cw: number, ch: number): number => {
      if (!nat.w || !nat.h || !cw || !ch) return 1
      const swap = rot % 180 !== 0
      const ew = swap ? nat.h : nat.w
      const eh = swap ? nat.w : nat.h
      return Math.min(cw / ew, ch / eh)
    },
    []
  )

  const applyFit = useCallback(
    (fill: boolean) => {
      const nat = dispRef.current
      const { width, height } = sizeRef.current
      if (!nat) return
      const raw = rawFit(nat, tRef.current.rot, width, height)
      fitFillRef.current = fill
      setT((p) => ({ ...p, scale: fill ? raw : Math.min(raw, 1), tx: 0, ty: 0 }))
    },
    [rawFit]
  )

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const { width, height } = sizeRef.current
    const p = tRef.current
    const newScale = clamp(p.scale * factor, MIN_SCALE, MAX_SCALE)
    const k = newScale / p.scale
    const ux = (cx ?? width / 2) - width / 2
    const uy = (cy ?? height / 2) - height / 2
    fitFillRef.current = false
    setT({ scale: newScale, tx: ux * (1 - k) + p.tx * k, ty: uy * (1 - k) + p.ty * k, rot: p.rot })
  }, [])

  // Show the original at 100% (scale is relative to the displayed preview).
  const actualSize = useCallback(() => {
    const nat = dispRef.current
    const target = orig && nat ? orig.w / nat.w : 1
    fitFillRef.current = false
    setT((p) => ({ ...p, scale: clamp(target, MIN_SCALE, MAX_SCALE), tx: 0, ty: 0 }))
  }, [orig])

  const rotate = useCallback(
    (dir: 1 | -1) => {
      setT((p) => ({ ...p, rot: (p.rot + dir * 90 + 360) % 360 }))
      requestAnimationFrame(() => applyFit(fitFillRef.current))
    },
    [applyFit]
  )

  const doDelete = useCallback(async () => {
    if (!item) return
    const willEmpty = images.length <= 1
    const r = await window.api.ops.trash(item.path)
    if (r.ok) {
      removeCurrentFromList()
      if (willEmpty) backToBrowser()
    }
  }, [item, images.length, removeCurrentFromList, backToBrowser])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }, [])

  // ----- load pipeline: cheap thumbnail placeholder now, heavy preview deferred -----
  useEffect(() => {
    if (!item) return
    let alive = true
    setLoaded(false)
    setError(false)
    setMainSrc(null)
    setPlaceholder(null)
    setOrig(null)
    dispRef.current = null
    fitFillRef.current = false
    setT({ scale: 1, tx: 0, ty: 0, rot: 0 })

    // Cheap placeholder immediately. Use the SAME size the browser grid caches
    // (384) so opening a photo you already saw in the grid is an instant cache
    // hit — the blurred image shows at once instead of regenerating.
    window.api.image.thumbnail(item.path, 384).then((p) => alive && setPlaceholder(mediaUrl(p)))

    // Fetch the real dimensions right away (cheap — header/EXIF only, no full
    // decode). The placeholder is sized from these so a small image never flashes
    // blown-up-to-fill before snapping to its true (<=100%) size.
    window.api.image.size(item.path).then((s) => alive && setOrig({ w: s.width, h: s.height }))

    // Defer the expensive preview so images you scrub straight past don't flood
    // sharp — only the image you settle on gets a full preview generated.
    const timer = setTimeout(() => {
      if (!alive) return
      window.api.image.preview(item.path).then((p) => alive && setMainSrc(mediaUrl(p)))
      ;[index - 1, index + 1].forEach((i) => {
        const im = images[i]
        if (!im) return
        window.api.image
          .preview(im.path)
          .then((p) => {
            const img = new Image()
            img.src = mediaUrl(p)
          })
          .catch(() => {})
      })
    }, 140)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [item?.path])

  const onMainLoad = (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const img = e.currentTarget
    const nat = { w: img.naturalWidth, h: img.naturalHeight }
    dispRef.current = nat
    setDispNat(nat)
    const { width, height } = sizeRef.current
    const raw = rawFit(nat, 0, width, height)
    fitFillRef.current = false
    setT({ scale: Math.min(raw, 1), tx: 0, ty: 0, rot: 0 })
    setLoaded(true)
    setError(false)
  }

  // Re-fit on stage resize while still fitted.
  useEffect(() => {
    if (loaded) applyFit(fitFillRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSize.width, stageSize.height])

  // Wheel zoom centred on the cursor (native, non-passive).
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [stageRef, zoomAt])

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          prev()
          break
        case '+':
        case '=':
          zoomAt(1.2)
          break
        case '-':
        case '_':
          zoomAt(1 / 1.2)
          break
        case '0':
          applyFit(true)
          break
        case '1':
          actualSize()
          break
        case 'Delete':
          doDelete()
          break
        case 'Escape':
          // During a slideshow, let the slideshow effect handle Escape (stop +
          // leave fullscreen); don't fall through to backToBrowser.
          if (useUI.getState().slideshow) break
          if (document.fullscreenElement) document.exitFullscreen()
          else backToBrowser()
          break
        case 'F11':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, zoomAt, applyFit, actualSize, doDelete, backToBrowser, toggleFullscreen])

  // Slideshow: auto-advance in fullscreen; any key OR leaving fullscreen stops
  // it. Leaving fullscreen is the reliable stop signal: Chromium swallows the
  // Esc keydown that exits fullscreen, so a keydown listener alone left the
  // slideshow running after it had already dropped out of fullscreen.
  useEffect(() => {
    if (!slideshow) return
    document.documentElement.requestFullscreen?.().catch(() => {})
    const id = setInterval(() => useStore.getState().next(), 3000)
    const stop = (): void => {
      setSlideshow(false)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
    const onFsChange = (): void => {
      if (!document.fullscreenElement) setSlideshow(false)
    }
    window.addEventListener('keydown', stop)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      clearInterval(id)
      window.removeEventListener('keydown', stop)
      document.removeEventListener('fullscreenchange', onFsChange)
    }
  }, [slideshow, setSlideshow])

  // Drag-to-pan.
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, tx: tRef.current.tx, ty: tRef.current.ty }
  }
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!drag.current) return
      const d = drag.current
      setT((p) => ({ ...p, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) }))
    }
    const onUp = (): void => {
      drag.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onDoubleClick = (): void => {
    const nat = dispRef.current
    if (!nat) return
    const raw = rawFit(nat, t.rot, stageSize.width, stageSize.height)
    if (Math.abs(t.scale - Math.min(raw, 1)) < 0.01) actualSize()
    else applyFit(false)
  }

  // ----- chrome auto-hide -----
  // Fullscreen: any mouse movement reveals the chrome, which then fades after a
  // beat. Windowed: the chrome only appears while the cursor is down in the
  // bottom strip (where the toolbar + filmstrip live) and hides shortly after
  // the cursor leaves it — so ordinary mousing over the image never pops it up.
  const BOTTOM_ZONE = 170
  const FS_DELAY = 1000
  const WIN_DELAY = 700
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const overChrome = useRef(false)
  const inZone = useRef(false)
  const scheduleHide = useCallback((delay: number) => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!overChrome.current && !drag.current) setChromeVisible(false)
    }, delay)
  }, [])
  const onContainerMove = useCallback(
    (e: React.MouseEvent): void => {
      if (useUI.getState().fullscreen) {
        setChromeVisible(true)
        scheduleHide(FS_DELAY)
        return
      }
      const rect = e.currentTarget.getBoundingClientRect()
      const nowInZone = e.clientY >= rect.bottom - BOTTOM_ZONE
      if (nowInZone) {
        inZone.current = true
        clearTimeout(hideTimer.current)
        setChromeVisible(true)
      } else if (inZone.current) {
        // Cursor just left the bottom strip — start the countdown once.
        inZone.current = false
        scheduleHide(WIN_DELAY)
      }
    },
    [scheduleHide]
  )
  const onContainerLeave = useCallback((): void => {
    inZone.current = false
    if (!overChrome.current) scheduleHide(useUI.getState().fullscreen ? FS_DELAY : WIN_DELAY)
  }, [scheduleHide])
  useEffect(() => {
    // Brief initial reveal for discoverability, then it fades to its resting
    // (hidden) state; thereafter it's summoned by the bottom strip.
    scheduleHide(useUI.getState().fullscreen ? FS_DELAY : WIN_DELAY)
    return () => clearTimeout(hideTimer.current)
  }, [scheduleHide])

  if (!item) return <div className="h-full w-full" style={{ background: 'var(--viewer-bg)' }} />

  const zoomPct =
    orig && dispNat ? Math.round(t.scale * (dispNat.w / orig.w) * 100) : Math.round(t.scale * 100)
  const transform = `translate(-50%, -50%) translate(${t.tx}px, ${t.ty}px) rotate(${t.rot}deg) scale(${t.scale})`
  // Draw the placeholder at exactly where the full image will settle (fit,
  // capped at 100%) so switching to a small image doesn't flash oversized.
  const phFit = orig ? Math.min(rawFit(orig, 0, stageSize.width, stageSize.height), 1) : 1
  // Only hide the cursor in fullscreen; windowed keeps it, since the chrome now
  // rests hidden and we don't want the pointer vanishing over the image.
  const hideCursor = fullscreen && !chromeVisible
  // Windowed: the arrows stay put — they're a primary way to page through, so
  // they don't ride the bottom chrome's auto-hide. Fullscreen: they fade with it.
  const arrowsVisible = !fullscreen || chromeVisible

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--viewer-bg)', cursor: hideCursor ? 'none' : 'default' }}
      onMouseMove={onContainerMove}
      onMouseLeave={onContainerLeave}
    >
      {/* Interaction layer (image + pan/zoom). Sibling of the chrome, so toolbar
          clicks never bubble into the pan/double-click handlers. */}
      <div
        ref={stageRef}
        className="absolute inset-0"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          openMenu(e.clientX, e.clientY, buildMenu(item, index))
        }}
        style={{ cursor: hideCursor ? 'none' : 'grab' }}
      >
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
            <ImageOff size={48} strokeWidth={1.4} />
            <div className="text-[13px]">无法显示此图片</div>
            <button
              onClick={() => window.api.ops.openDefault(item.path)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20"
            >
              用默认程序打开
            </button>
          </div>
        ) : (
          <>
            {!loaded && !(placeholder && orig) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={30} className="animate-spin" style={{ color: 'rgba(255,255,255,.5)' }} />
              </div>
            )}
            {placeholder && orig && !loaded && (
              <img
                src={placeholder}
                alt=""
                draggable={false}
                className="absolute left-1/2 top-1/2 select-none"
                style={{
                  width: orig.w * phFit,
                  height: orig.h * phFit,
                  transform: 'translate(-50%, -50%) scale(1.02)',
                  filter: 'blur(6px)'
                }}
              />
            )}
            {mainSrc && (
              <img
                key={item.path}
                src={mainSrc}
                alt={item.name}
                onLoad={onMainLoad}
                onError={() => {
                  setError(true)
                  setLoaded(true)
                }}
                draggable={false}
                className="absolute left-1/2 top-1/2 select-none will-change-transform"
                style={{
                  transform,
                  opacity: loaded ? 1 : 0,
                  transition: drag.current ? 'none' : 'opacity .15s',
                  maxWidth: 'none',
                  maxHeight: 'none'
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Prev / next. Pointer-events track opacity so a faded-out arrow is never
          invisibly clickable. */}
      {images.length > 1 && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{ opacity: arrowsVisible ? 1 : 0 }}
        >
          <button
            onClick={prev}
            style={{ pointerEvents: arrowsVisible ? 'auto' : 'none' }}
            className="absolute left-0 top-1/2 ml-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            style={{ pointerEvents: arrowsVisible ? 'auto' : 'none' }}
            className="absolute right-0 top-1/2 mr-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}

      {/* Bottom chrome: info + toolbar + filmstrip. Auto-hides. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center transition-all duration-300"
        style={{
          opacity: chromeVisible ? 1 : 0,
          transform: chromeVisible ? 'translateY(0)' : 'translateY(16px)',
          pointerEvents: chromeVisible ? 'auto' : 'none'
        }}
        onMouseEnter={() => {
          overChrome.current = true
          inZone.current = true
          setChromeVisible(true)
          clearTimeout(hideTimer.current)
        }}
        onMouseLeave={() => {
          overChrome.current = false
          scheduleHide(useUI.getState().fullscreen ? FS_DELAY : WIN_DELAY)
        }}
      >
        <div
          className="mb-2 flex items-center gap-2 rounded-full px-3.5 py-1 text-[12px] text-white/85 backdrop-blur"
          style={{ background: 'rgba(0,0,0,.5)' }}
        >
          <span className="max-w-[260px] truncate font-medium text-white">{item.name}</span>
          {orig && <span className="text-white/40">·</span>}
          {orig && <span>{`${orig.w}×${orig.h}`}</span>}
          <span className="text-white/40">·</span>
          <span>{zoomPct}%</span>
          <span className="text-white/40">·</span>
          <span>{formatBytes(item.size)}</span>
          <span className="text-white/40">·</span>
          <span>{formatDate(item.mtime)}</span>
          <span className="text-white/40">·</span>
          <span>
            {index + 1}/{images.length}
          </span>
        </div>

        <div
          className="mb-2 flex items-center gap-0.5 rounded-full px-2 py-1 backdrop-blur"
          style={{ background: 'rgba(0,0,0,.55)', boxShadow: '0 6px 20px rgba(0,0,0,.4)' }}
        >
          <ToolBtn icon={<ZoomOut size={18} />} title="缩小" onClick={() => zoomAt(1 / 1.2)} />
          <button
            onClick={actualSize}
            className="min-w-[48px] rounded-md px-1 text-center text-[12px] text-white/90 hover:bg-white/15"
            title="实际大小 (1:1)"
          >
            {zoomPct}%
          </button>
          <ToolBtn icon={<ZoomIn size={18} />} title="放大" onClick={() => zoomAt(1.2)} />
          <ToolBtn icon={<Maximize size={17} />} title="适应窗口" onClick={() => applyFit(true)} />
          <Divider />
          <ToolBtn icon={<ChevronLeft size={20} />} title="上一张" onClick={prev} />
          <ToolBtn icon={<ChevronRight size={20} />} title="下一张" onClick={next} />
          <Divider />
          <ToolBtn icon={<RotateCcw size={17} />} title="向左旋转" onClick={() => rotate(-1)} />
          <ToolBtn icon={<RotateCw size={17} />} title="向右旋转" onClick={() => rotate(1)} />
          <Divider />
          <ToolBtn
            icon={fullscreen ? <Shrink size={17} /> : <Expand size={17} />}
            title="全屏"
            onClick={toggleFullscreen}
          />
          <ToolBtn icon={<Trash2 size={17} />} title="删除" danger onClick={doDelete} />
          <ToolBtn icon={<LayoutGrid size={17} />} title="管理" onClick={backToBrowser} />
        </div>

        <Filmstrip images={images} index={index} onSelect={setIndex} />
      </div>
    </div>
  )
}
