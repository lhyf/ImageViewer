import {
  Play,
  Copy,
  Save,
  FolderOpen,
  ExternalLink,
  Monitor,
  Printer,
  Trash2,
  Pencil,
  Info
} from 'lucide-react'
import type { ImageItem } from '@shared/types'
import { useStore } from '../store'
import { useUI, type MenuItem } from '../useUI'

/** Returns a builder that produces the right-click menu for a given image. */
export function useImageMenu(): (item: ImageItem, index: number) => MenuItem[] {
  const openImageAt = useStore((s) => s.openImageAt)
  const removeCurrentFromList = useStore((s) => s.removeCurrentFromList)
  const backToBrowser = useStore((s) => s.backToBrowser)
  const setIndex = useStore((s) => s.setIndex)

  const setSlideshow = useUI((s) => s.setSlideshow)
  const setRenameTarget = useUI((s) => s.setRenameTarget)
  const setInfoPath = useUI((s) => s.setInfoPath)
  const showToast = useUI((s) => s.showToast)

  const sz = 15

  return (item, index) => {
    const run = async (
      fn: () => Promise<{ ok: boolean; error?: string }>,
      okMsg: string,
      failMsg: string
    ): Promise<void> => {
      const r = await fn()
      showToast(r.ok ? okMsg : `${failMsg}${r.error ? ':' + r.error : ''}`)
    }

    return [
      {
        label: '播放幻灯片',
        icon: <Play size={sz} />,
        onClick: () => {
          openImageAt(index)
          setSlideshow(true)
        }
      },
      { type: 'separator' },
      {
        label: '复制',
        icon: <Copy size={sz} />,
        onClick: () => run(() => window.api.ops.copyImage(item.path), '已复制到剪贴板', '复制失败')
      },
      {
        label: '另存为…',
        icon: <Save size={sz} />,
        onClick: () => window.api.ops.saveAs(item.path)
      },
      { type: 'separator' },
      {
        label: '打开所在文件夹',
        icon: <FolderOpen size={sz} />,
        onClick: () => window.api.ops.showInFolder(item.path)
      },
      {
        label: '打开方式…',
        icon: <ExternalLink size={sz} />,
        onClick: () => window.api.ops.openWith(item.path)
      },
      {
        label: '设为桌面背景',
        icon: <Monitor size={sz} />,
        onClick: () => run(() => window.api.ops.setWallpaper(item.path), '已设为桌面背景', '设置失败')
      },
      {
        label: '打印',
        icon: <Printer size={sz} />,
        onClick: () => window.api.ops.print(item.path)
      },
      { type: 'separator' },
      {
        label: '重命名',
        icon: <Pencil size={sz} />,
        onClick: () => setRenameTarget(item)
      },
      {
        label: '删除',
        icon: <Trash2 size={sz} />,
        danger: true,
        onClick: async () => {
          setIndex(index)
          const r = await window.api.ops.trash(item.path)
          if (r.ok) {
            const empty = useStore.getState().images.length <= 1
            removeCurrentFromList()
            if (empty && useStore.getState().mode === 'viewer') backToBrowser()
            showToast('已删除到回收站')
          } else {
            showToast('删除失败:' + (r.error ?? ''))
          }
        }
      },
      { type: 'separator' },
      {
        label: '图片信息',
        icon: <Info size={sz} />,
        onClick: () => setInfoPath(item.path)
      }
    ]
  }
}
