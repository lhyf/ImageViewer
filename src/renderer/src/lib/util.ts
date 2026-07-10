import type { ImageItem, SortSpec } from '@shared/types'

/** Build a URL the custom `media://` protocol can serve. */
export function mediaUrl(path: string): string {
  return `media://get/?p=${encodeURIComponent(path)}`
}

/** Cross-platform dirname that tolerates both separators. */
export function dirName(p: string): string {
  const norm = p.replace(/[\\/]+$/, '')
  const i = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  return i > 0 ? norm.slice(0, i) : norm
}

export function baseName(p: string): string {
  const norm = p.replace(/[\\/]+$/, '')
  const i = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  return i >= 0 ? norm.slice(i + 1) : norm
}

export function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const v = n / Math.pow(1024, i)
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(2)} ${units[i]}`
}

export function formatDate(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (x: number): string => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Split an absolute directory into clickable breadcrumb segments. */
export function breadcrumbSegments(dir: string): { name: string; path: string }[] {
  const isWin = /^[a-zA-Z]:/.test(dir) || dir.includes('\\')
  if (isWin) {
    const clean = dir.replace(/[\\]+$/, '')
    const parts = clean.split('\\').filter(Boolean)
    let acc = ''
    return parts.map((p, i) => {
      acc = i === 0 ? p + '\\' : acc + (acc.endsWith('\\') ? '' : '\\') + p
      return { name: p, path: acc }
    })
  }
  const parts = dir.split('/').filter(Boolean)
  let acc = ''
  const segs = [{ name: '/', path: '/' }]
  parts.forEach((p) => {
    acc += '/' + p
    segs.push({ name: p, path: acc })
  })
  return segs
}

export function sortImages(images: ImageItem[], sort: SortSpec): ImageItem[] {
  const dir = sort.asc ? 1 : -1
  const arr = [...images]
  arr.sort((a, b) => {
    let r = 0
    switch (sort.key) {
      case 'name':
        r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        break
      case 'date':
        r = a.mtime - b.mtime
        break
      case 'size':
        r = a.size - b.size
        break
      case 'type':
        r =
          a.ext.localeCompare(b.ext) ||
          a.name.localeCompare(b.name, undefined, { numeric: true })
        break
    }
    return r * dir
  })
  return arr
}
