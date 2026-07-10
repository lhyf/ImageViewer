import { useEffect, useState } from 'react'
import Modal from '../Modal'
import { useUI } from '../../useUI'
import type { ImageMeta } from '@shared/types'
import { baseName, formatBytes, formatDate } from '../../lib/util'

function Row({ label, value }: { label: string; value?: string | number }): React.JSX.Element | null {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex gap-3 py-1 text-[12.5px]">
      <div className="w-20 shrink-0" style={{ color: 'var(--app-muted)' }}>
        {label}
      </div>
      <div className="min-w-0 break-all" style={{ color: 'var(--app-text)' }}>
        {value}
      </div>
    </div>
  )
}

export default function InfoDialog(): React.JSX.Element | null {
  const path = useUI((s) => s.infoPath)
  const close = useUI((s) => s.setInfoPath)
  const [meta, setMeta] = useState<ImageMeta | null>(null)

  useEffect(() => {
    setMeta(null)
    if (!path) return
    let alive = true
    window.api.image.meta(path).then((m) => alive && setMeta(m))
    return () => {
      alive = false
    }
  }, [path])

  if (!path) return null
  const ex = meta?.exif

  return (
    <Modal title="图片信息" onClose={() => close(null)} width={460}>
      {!meta ? (
        <div className="py-8 text-center text-[13px]" style={{ color: 'var(--app-muted)' }}>
          读取中…
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <Row label="名称" value={baseName(meta.path)} />
          <Row label="路径" value={meta.path} />
          <Row label="格式" value={meta.ext.toUpperCase()} />
          <Row label="尺寸" value={`${meta.width} × ${meta.height}`} />
          <Row label="大小" value={formatBytes(meta.size)} />
          <Row label="修改日期" value={formatDate(meta.mtime)} />
          {ex && (ex.make || ex.model || ex.dateTimeOriginal) && (
            <>
              <div className="my-2 h-px" style={{ background: 'var(--app-border)' }} />
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>
                EXIF
              </div>
              <Row label="相机" value={[ex.make, ex.model].filter(Boolean).join(' ')} />
              <Row label="镜头" value={ex.lensModel} />
              <Row label="拍摄时间" value={ex.dateTimeOriginal} />
              <Row label="光圈" value={ex.fNumber} />
              <Row label="快门" value={ex.exposureTime} />
              <Row label="ISO" value={ex.iso} />
              <Row label="焦距" value={ex.focalLength} />
              {ex.gpsLatitude !== undefined && ex.gpsLongitude !== undefined && (
                <Row
                  label="GPS"
                  value={`${ex.gpsLatitude.toFixed(5)}, ${ex.gpsLongitude.toFixed(5)}`}
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
