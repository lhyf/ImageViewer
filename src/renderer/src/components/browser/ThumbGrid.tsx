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
  const cellW = props.size + 28
  const cellH = props.size + 48
  const columns = Math.max(1, Math.floor(width / cellW))
  const rows = Math.ceil(props.items.length / columns)
  const data: CellData = { ...props, columns }

  return (
    <div ref={ref} className="h-full w-full">
      {width > 0 && height > 0 && (
        <Grid
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
