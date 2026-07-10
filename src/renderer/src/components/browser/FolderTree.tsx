import { useEffect, useState } from 'react'
import { ChevronRight, Folder, FolderOpen, HardDrive, Star, Monitor } from 'lucide-react'
import type { DirNode } from '@shared/types'
import { useStore } from '../../store'

function TreeNode({ node, depth }: { node: DirNode; depth: number }): React.JSX.Element {
  const currentDir = useStore((s) => s.currentDir)
  const go = useStore((s) => s.go)
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirNode[] | null>(null)
  const [loading, setLoading] = useState(false)

  const selected = currentDir === node.path

  const toggle = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!expanded && children === null) {
      setLoading(true)
      const kids = await window.api.fs.childDirs(node.path)
      setChildren(kids)
      setLoading(false)
    }
    setExpanded((v) => !v)
  }

  return (
    <div>
      <div
        className="group flex h-[26px] cursor-default items-center rounded-md pr-2 transition-colors"
        style={{
          paddingLeft: depth * 12 + 4,
          background: selected ? 'var(--app-accent-soft)' : 'transparent',
          color: selected ? 'var(--app-accent)' : 'var(--app-text)'
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = 'var(--app-hover)'
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = 'transparent'
        }}
        onClick={() => go(node.path)}
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          onClick={node.hasChildren ? toggle : undefined}
          style={{ visibility: node.hasChildren ? 'visible' : 'hidden' }}
        >
          <ChevronRight
            size={13}
            style={{
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform .12s',
              color: 'var(--app-muted)'
            }}
          />
        </span>
        <span className="mr-1.5 flex shrink-0 items-center">
          {node.isDrive ? (
            <HardDrive size={15} style={{ color: 'var(--app-muted)' }} />
          ) : expanded ? (
            <FolderOpen size={15} style={{ color: 'var(--app-accent)' }} />
          ) : (
            <Folder size={15} style={{ color: '#e8b339' }} />
          )}
        </span>
        <span className="truncate text-[13px]">{node.name}</span>
      </div>

      {expanded && (
        <div>
          {loading && (
            <div
              className="py-1 text-[12px]"
              style={{ paddingLeft: (depth + 1) * 12 + 24, color: 'var(--app-muted)' }}
            >
              加载中…
            </div>
          )}
          {children?.map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  label
}: {
  icon: React.ReactNode
  label: string
}): React.JSX.Element {
  return (
    <div
      className="mb-1 mt-2 flex items-center gap-1.5 px-2 text-[11px] font-medium uppercase tracking-wider"
      style={{ color: 'var(--app-muted)' }}
    >
      {icon}
      {label}
    </div>
  )
}

export default function FolderTree(): React.JSX.Element {
  const [roots, setRoots] = useState<DirNode[]>([])
  const [quick, setQuick] = useState<DirNode[]>([])

  useEffect(() => {
    window.api.fs.treeRoots().then(setRoots)
    window.api.fs.quickAccess().then(setQuick)
  }, [])

  return (
    <div
      className="flex h-full flex-col overflow-y-auto py-2"
      style={{ background: 'var(--app-panel)', borderRight: '1px solid var(--app-border)' }}
    >
      <div className="px-2">
        <SectionHeader icon={<Star size={12} />} label="快速访问" />
        {quick.map((n) => (
          <TreeNode key={n.path} node={n} depth={0} />
        ))}
        <SectionHeader icon={<Monitor size={12} />} label="此电脑" />
        {roots.map((n) => (
          <TreeNode key={n.path} node={n} depth={0} />
        ))}
      </div>
    </div>
  )
}
