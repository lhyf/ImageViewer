import { useEffect, useRef } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import type { GridChildComponentProps } from 'react-window'
import type { FolderItem, ImageItem } from '@shared/types'
import { useElementSize } from '../../hooks/useElementSize'
import FolderThumb from './FolderThumb'
import Thumb from './Thumb'

interface ThumbGridProps {
  /** Sub-folders, laid out ahead of the images. */
  folders: FolderItem[]
  items: ImageItem[]
  size: number
  /** The highlighted cell: a folder's or an image's path. */
  selectedPath: string | null
  /** A cell to bring into view, if any. */
  revealPath: string | null
  onSelect: (index: number) => void
  onOpen: (index: number) => void
  onContext: (index: number, e: React.MouseEvent) => void
  onSelectFolder: (folder: FolderItem) => void
  onOpenFolder: (folder: FolderItem) => void
}

interface CellData extends ThumbGridProps {
  columns: number
}

function Cell({
  columnIndex,
  rowIndex,
  style,
  data
}: GridChildComponentProps<CellData>): React.JSX.Element | null {
  const { folders, items, columns, size, selectedPath } = data
  const { onSelect, onOpen, onContext, onSelectFolder, onOpenFolder } = data
  const cell = rowIndex * columns + columnIndex
  if (cell < folders.length) {
    const folder = folders[cell]
    return (
      <div style={style} className="flex items-start justify-center">
        <FolderThumb
          folder={folder}
          size={size}
          selected={folder.path === selectedPath}
          onSelect={() => onSelectFolder(folder)}
          onOpen={() => onOpenFolder(folder)}
        />
      </div>
    )
  }
  const index = cell - folders.length
  if (index >= items.length) return null
  const item = items[index]
  return (
    <div style={style} className="flex items-start justify-center">
      <Thumb
        item={item}
        size={size}
        selected={item.path === selectedPath}
        onSelect={() => onSelect(index)}
        onOpen={() => onOpen(index)}
        onContextMenu={(e) => onContext(index, e)}
      />
    </div>
  )
}

export default function ThumbGrid(props: ThumbGridProps): React.JSX.Element {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>()
  const gridRef = useRef<Grid>(null)
  const cellW = props.size + 28
  const cellH = props.size + 48
  const columns = Math.max(1, Math.floor(width / cellW))
  const rows = Math.ceil((props.folders.length + props.items.length) / columns)
  const data: CellData = { ...props, columns }

  // Bring the reveal cell into view. This matters most when coming back from
  // the viewer: App unmounts the browser while viewing, so the grid remounts
  // with its scroll reset to the top and the image you were just on would
  // otherwise be off-screen. `align: 'smart'` leaves an already-visible cell put
  // (so clicking a thumbnail never yanks the scroll) and centers a far-away one.
  const { revealPath, folders, items } = props
  useEffect(() => {
    if (!revealPath) return
    let cell = folders.findIndex((f) => f.path === revealPath)
    if (cell < 0) {
      const i = items.findIndex((im) => im.path === revealPath)
      if (i < 0) return
      cell = folders.length + i
    }
    gridRef.current?.scrollToItem({
      rowIndex: Math.floor(cell / columns),
      columnIndex: cell % columns,
      align: 'smart'
    })
  }, [revealPath, folders, items, columns])

  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && height > 0 && (
        <Grid
          ref={gridRef}
          className="thumb-grid"
          columnCount={columns}
          rowCount={rows}
          columnWidth={cellW}
          rowHeight={cellH}
          width={width}
          height={height}
          itemData={data}
          overscanRowCount={2}
        >
          {Cell}
        </Grid>
      )}
    </div>
  )
}
