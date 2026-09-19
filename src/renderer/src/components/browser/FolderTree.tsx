import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Folder, FolderOpen, HardDrive, Star, Monitor } from 'lucide-react'
import type { DirNode } from '@shared/types'
import { useStore } from '../../store'
import { isUnder } from '../../lib/util'

interface TreeNodeProps {
  node: DirNode
  depth: number
  /** The open folder, when it is this node or lies beneath it: the tree opens up to it. */
  reveal: string | null
  /** Called on a click anywhere in this node's tree. */
  onPick: () => void
}

function TreeNode({ node, depth, reveal, onPick }: TreeNodeProps): React.JSX.Element {
  const currentDir = useStore((s) => s.currentDir)
  const go = useStore((s) => s.go)
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<DirNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  const selected = currentDir === node.path
  const leadsToReveal = reveal !== null && isUnder(reveal, node.path)

  const expand = async (relist = false): Promise<void> => {
    if (children === null || relist) {
      setLoading(true)
      setChildren(await window.api.fs.childDirs(node.path))
      setLoading(false)
    }
    setExpanded(true)
  }

  const toggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (expanded) setExpanded(false)
    else void expand()
  }

  // Open the way down to the revealed folder and bring its row into view:
  // centred when it was out of sight, so the folders around it show too, and
  // left put when it's already showing (e.g. just clicked). The children are
  // re-listed when the way on isn't among them: it may be new.
  useEffect(() => {
    if (reveal === null) return
    if (reveal === node.path) {
      // Chromium-only, which is all Electron runs.
      const row = rowRef.current as
        | (HTMLElement & { scrollIntoViewIfNeeded(center: boolean): void })
        | null
      row?.scrollIntoViewIfNeeded(true)
    } else if (isUnder(reveal, node.path)) {
      void expand(!children?.some((c) => c.path === reveal || isUnder(reveal, c.path)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal])

  return (
    <div>
      <div
        ref={rowRef}
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
        onClick={() => {
          onPick()
          go(node.path)
        }}
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
            <TreeNode
              key={c.path}
              node={c}
              depth={depth + 1}
              reveal={leadsToReveal ? reveal : null}
              onPick={onPick}
            />
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
  const currentDir = useStore((s) => s.currentDir)
  const [roots, setRoots] = useState<DirNode[]>([])
  const [quick, setQuick] = useState<DirNode[]>([])
  // The root whose tree the user last clicked in.
  const pickedRoot = useRef<string | null>(null)
  const [reveal, setReveal] = useState<{ root: string; path: string } | null>(null)

  useEffect(() => {
    window.api.fs.treeRoots().then(setRoots)
    window.api.fs.quickAccess().then(setQuick)
  }, [])

  // Reveal the open folder in the tree the user is browsing, while it's inside
  // it — so clicking deep in C: never jumps up to 图片 — else under the closest
  // root that holds it (图片 before 主目录 before C:). Settled only once the
  // folder has changed: a click records its root before the folder arrives.
  useEffect(() => {
    if (currentDir === null) return
    const holds = (root: string): boolean => currentDir === root || isUnder(currentDir, root)
    const root =
      pickedRoot.current !== null && holds(pickedRoot.current)
        ? pickedRoot.current
        : [...quick, ...roots]
            .filter((n) => holds(n.path))
            .sort((a, b) => b.path.length - a.path.length)[0]?.path
    setReveal(root ? { root, path: currentDir } : null)
  }, [currentDir, quick, roots])

  const rootNode = (n: DirNode): React.JSX.Element => (
    <TreeNode
      key={n.path}
      node={n}
      depth={0}
      reveal={reveal?.root === n.path ? reveal.path : null}
      onPick={() => {
        pickedRoot.current = n.path
      }}
    />
  )

  return (
    <div
      className="flex h-full flex-col overflow-y-auto py-2"
      style={{ background: 'var(--app-panel)', borderRight: '1px solid var(--app-border)' }}
    >
      <div className="px-2">
        <SectionHeader icon={<Star size={12} />} label="快速访问" />
        {quick.map(rootNode)}
        <SectionHeader icon={<Monitor size={12} />} label="此电脑" />
        {roots.map(rootNode)}
      </div>
    </div>
  )
}
