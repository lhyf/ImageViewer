import { useEffect, useRef, useState } from 'react'

/** Track an element's content-box size via ResizeObserver. */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T>,
  { width: number; height: number }
] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setSize({ width: Math.round(cr.width), height: Math.round(cr.height) })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  return [ref, size]
}
