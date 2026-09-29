/**
 * The dry-run board's data. Plain JSON, so a whole board is one value that
 * undo can snapshot and localStorage can hold.
 */

export type BlockKind =
  | 'array'
  | 'stack'
  | 'queue'
  | 'list'
  | 'map'
  | 'tree'
  | 'graph'
  | 'grid'
  | 'variable'
  | 'note'

interface BlockBase {
  id: string
  x: number
  y: number
}

export type Block = BlockBase &
  (
    | { kind: 'array'; cells: string[]; marks: Record<string, string> }
    | { kind: 'stack'; items: string[] }
    | { kind: 'queue'; items: string[] }
    | { kind: 'list'; items: string[] }
    | { kind: 'map'; rows: [string, string][] }
    | { kind: 'tree'; source: string; marked: number[] }
    | { kind: 'graph'; source: string; marked: string[] }
    | { kind: 'grid'; cells: string[][] }
    | { kind: 'variable'; name: string; value: string }
    | { kind: 'note'; text: string }
  )

export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>

export interface Stroke {
  id: string
  color: string
  /** Flat world coordinates: x0, y0, x1, y1, … */
  points: number[]
  /** A straight arrow from the first point to the last. */
  arrow: boolean
}

export interface BoardState {
  version: 1
  blocks: Block[]
  strokes: Stroke[]
}

export const EMPTY_BOARD: BoardState = { version: 1, blocks: [], strokes: [] }

export const BLOCK_LABEL: Record<BlockKind, string> = {
  array: 'Array',
  stack: 'Stack',
  queue: 'Queue',
  list: 'Linked list',
  map: 'Hash map',
  tree: 'Tree',
  graph: 'Graph',
  grid: 'Grid',
  variable: 'Variable',
  note: 'Note',
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** A fresh block with something in it, so it reads as what it is the moment it lands. */
export function createBlock(kind: BlockKind, x: number, y: number): Block {
  const base = { id: newId(), x, y }
  switch (kind) {
    case 'array':
      return { ...base, kind, cells: ['', '', '', '', ''], marks: {} }
    case 'stack':
      return { ...base, kind, items: [] }
    case 'queue':
      return { ...base, kind, items: [] }
    case 'list':
      return { ...base, kind, items: ['1', '2', '3'] }
    case 'map':
      return { ...base, kind, rows: [['', '']] }
    case 'tree':
      return { ...base, kind, source: '1,2,3', marked: [] }
    case 'graph':
      return { ...base, kind, source: 'A-B, B-C, A-C', marked: [] }
    case 'grid':
      return { ...base, kind, cells: Array.from({ length: 3 }, () => ['', '', '', '']) }
    case 'variable':
      return { ...base, kind, name: 'sum', value: '0' }
    case 'note':
      return { ...base, kind, text: '' }
  }
}

/* ---------------------------------------------------------------- trees -- */

export interface TreeLayout {
  /** `x` is the in-order position, `y` the depth — both in whole steps. */
  nodes: { id: number; value: string; x: number; y: number }[]
  edges: [number, number][]
}

const TREE_CAP = 63

/**
 * LeetCode-style level order: `1,2,3,null,5` — a `null` leaves a gap, and the
 * children of a missing node are not listed at all.
 */
export function layoutTree(source: string): TreeLayout {
  const tokens = source
    .split(/[\s,]+/)
    .map((token) => token.replace(/^\[|\]$/g, ''))
    .filter((token) => token.length > 0)
  const isGap = (token: string) => /^(null|#|nil|none)$/i.test(token)
  const first = tokens[0]
  if (first === undefined || isGap(first)) return { nodes: [], edges: [] }

  interface Node {
    id: number
    value: string
    depth: number
    left?: Node
    right?: Node
  }
  const root: Node = { id: 0, value: first, depth: 0 }
  const all: Node[] = [root]
  const edges: [number, number][] = []
  const queue: Node[] = [root]
  let next = 1
  while (queue.length > 0 && next < tokens.length && all.length < TREE_CAP) {
    const node = queue.shift() as Node
    for (const side of ['left', 'right'] as const) {
      const token = tokens[next++]
      if (token === undefined) break
      if (isGap(token)) continue
      const child: Node = { id: all.length, value: token, depth: node.depth + 1 }
      node[side] = child
      all.push(child)
      edges.push([node.id, child.id])
      queue.push(child)
    }
  }

  const column = new Map<number, number>()
  let order = 0
  const walk = (node: Node | undefined): void => {
    if (node === undefined) return
    walk(node.left)
    column.set(node.id, order++)
    walk(node.right)
  }
  walk(root)

  return {
    nodes: all.map((node) => ({ id: node.id, value: node.value, x: column.get(node.id) ?? 0, y: node.depth })),
    edges,
  }
}

/* --------------------------------------------------------------- graphs -- */

export interface GraphLayout {
  nodes: string[]
  edges: { from: string; to: string; directed: boolean; weight: string | null }[]
}

/** `A-B, B->C, C-D:4` — `-` undirected, `->` directed, `:w` a weight; a lone name adds a node. */
export function parseGraph(source: string): GraphLayout {
  const nodes: string[] = []
  const add = (name: string) => {
    if (!nodes.includes(name)) nodes.push(name)
  }
  const edges: GraphLayout['edges'] = []
  for (const raw of source.split(/[,;\n]+/)) {
    const part = raw.trim()
    if (part.length === 0) continue
    const match = /^(.+?)\s*(->|-|>)\s*(.+?)(?:\s*:\s*(.+))?$/.exec(part)
    if (match === null) {
      add(part)
      continue
    }
    const [, from = '', arrow, to = '', weight] = match
    add(from)
    add(to)
    edges.push({ from, to, directed: arrow !== '-', weight: weight ?? null })
  }
  // Capped so a pasted edge list cannot turn the circle into a smear.
  const kept = nodes.slice(0, 26)
  return { nodes: kept, edges: edges.filter((edge) => kept.includes(edge.from) && kept.includes(edge.to)) }
}

/* ---------------------------------------------------------- persistence -- */

const key = (slug: string) => `guruji:board:${slug}`

function isBoard(value: unknown): value is BoardState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as BoardState).version === 1 &&
    Array.isArray((value as BoardState).blocks) &&
    Array.isArray((value as BoardState).strokes)
  )
}

/** A board kept in this browser. Storage can be blocked or full; a fresh board is always a valid answer. */
export function loadBoard(slug: string): BoardState {
  try {
    const raw = window.localStorage.getItem(key(slug))
    if (raw === null) return EMPTY_BOARD
    const value: unknown = JSON.parse(raw)
    return isBoard(value) ? value : EMPTY_BOARD
  } catch {
    return EMPTY_BOARD
  }
}

export function saveBoard(slug: string, board: BoardState): void {
  try {
    if (board.blocks.length === 0 && board.strokes.length === 0) {
      window.localStorage.removeItem(key(slug))
    } else {
      window.localStorage.setItem(key(slug), JSON.stringify(board))
    }
  } catch {
    // Full or blocked storage: the board still works for this visit.
  }
}
