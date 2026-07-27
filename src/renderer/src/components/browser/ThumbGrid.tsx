import { useEffect, useRef } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import type { GridChildComponentProps } from 'react-window'
import type { ImageItem } from '@shared/types'
import { useElementSize } from '../../hooks/useElementSize'
import Thumb from './Thumb'

interface ThumbGridProps {
  items: ImageItem[]
  size: number
  selectedPath: string | null
  onSelect: (index: number) => void
  onOpen: (index: number) => void
  onContext: (index: number, e: React.MouseEvent) => void
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
  const { items, columns, size, selectedPath, onSelect, onOpen, onContext } = data
  const index = rowIndex * columns + columnIndex
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
  const rows = Math.ceil(props.items.length / columns)
  const data: CellData = { ...props, columns }

  // Bring the selected image into view. This matters most when coming back from
  // the viewer: App unmounts the browser while viewing, so the grid remounts
  // with its scroll reset to the top and the image you were just on would
  // otherwise be off-screen. `align: 'smart'` leaves an already-visible cell put
  // (so clicking a thumbnail never yanks the scroll) and centers a far-away one.
  const { selectedPath, items } = props
  useEffect(() => {
    if (!selectedPath) return
    const idx = items.findIndex((im) => im.path === selectedPath)
    if (idx < 0) return
    gridRef.current?.scrollToItem({
      rowIndex: Math.floor(idx / columns),
      columnIndex: idx % columns,
      align: 'smart'
    })
  }, [selectedPath, items, columns])

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
