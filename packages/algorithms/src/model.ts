/**
 * The event model shared by every algorithm and every canvas.
 *
 * An algorithm is a pure function from input text to `AlgorithmStep[]`. Each
 * step carries a full snapshot of the structure *after* that step, so playback
 * is array indexing: "previous" is `index - 1`, never a re-run.
 */

export type StepType =
  | 'COMPARE'
  | 'SWAP'
  | 'VISIT'
  | 'INSERT'
  | 'DELETE'
  | 'UPDATE'
  | 'PUSH'
  | 'POP'
  | 'MARK'
  | 'DONE'

/**
 * A lasting status on one element, as opposed to the step's momentary focus.
 * Canvases render each tag as a colour *and* a glyph, never colour alone.
 */
export type Tag = 'visited' | 'settled' | 'found' | 'pivot' | 'queued' | 'removed'

export interface ArraySnapshot {
  kind: 'array'
  values: number[]
  /** Keyed by index. */
  tags: Record<number, Tag>
  /** Named positions shown under the bars: `lo`, `hi`, `mid`, `pivot`, … */
  pointers: Record<string, number>
}

export interface ListNode {
  id: string
  value: number
  next: string | null
}

export interface ListSnapshot {
  kind: 'list'
  head: string | null
  nodes: ListNode[]
  tags: Record<string, Tag>
  /** Named references into the chain: `prev`, `curr`, `slow`, `fast`, … */
  pointers: Record<string, string | null>
}

export interface TreeNode {
  id: string
  value: number
  left: string | null
  right: string | null
}

export interface TreeSnapshot {
  kind: 'tree'
  root: string | null
  nodes: TreeNode[]
  tags: Record<string, Tag>
}

export type EdgeState = 'idle' | 'active' | 'used' | 'rejected'

export interface GraphEdge {
  from: string
  to: string
  weight?: number
  state: EdgeState
}

export interface GraphSnapshot {
  kind: 'graph'
  directed: boolean
  weighted: boolean
  nodes: string[]
  edges: GraphEdge[]
  tags: Record<string, Tag>
  /** A short per-node annotation: a distance, a parent, an in-degree. */
  labels: Record<string, string>
}

export type TableCell = number | string | null

export interface TableSnapshot {
  kind: 'table'
  rowLabels: string[]
  columnLabels: string[]
  cells: TableCell[][]
}

export type StructureSnapshot = ArraySnapshot | ListSnapshot | TreeSnapshot | GraphSnapshot | TableSnapshot

export type StructureKind = StructureSnapshot['kind']

export interface AlgorithmMetrics {
  comparisons: number
  swaps: number
  visits: number
}

export type VariableValue = number | string | boolean | null

export interface AlgorithmStep {
  type: StepType
  /** Array positions in focus. */
  indices?: number[]
  /** List, tree or graph nodes in focus. */
  nodeIds?: string[]
  /**
   * Table cells in focus as `[row, column]`. The first is the cell being
   * written; any others are the cells it reads — the dependency arrows.
   */
  cells?: [number, number][]
  values?: number[]
  state: StructureSnapshot
  variables: Record<string, VariableValue>
  /** One plain sentence, authored by the algorithm, shown to the user. */
  description: string
  metrics: AlgorithmMetrics
}

export type AlgorithmCategory = 'SORTING' | 'SEARCHING' | 'LINKED_LIST' | 'TREE' | 'GRAPH' | 'DP'

export interface AlgorithmOptions {
  maxSteps?: number
}

export interface AlgorithmDefinition {
  id: string
  name: string
  category: AlgorithmCategory
  structure: StructureKind
  complexity: string
  summary: string
  /** How to write the input, shown next to the input box. */
  inputHint: string
  defaultInput: string
  run: (input: string, options?: AlgorithmOptions) => AlgorithmStep[]
}

/**
 * Input the visualiser refuses: malformed, or over a size cap. The message is
 * written for the person who typed the input and is shown to them verbatim.
 */
export class VisualizerInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VisualizerInputError'
  }
}
