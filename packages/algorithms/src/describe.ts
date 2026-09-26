import type { StructureSnapshot, Tag } from './model'

/** The words a canvas shows beside a tagged element, so colour is never the only signal. */
export const TAG_LABEL: Record<Tag, string> = {
  visited: 'visited',
  settled: 'done',
  found: 'found',
  pivot: 'pivot',
  queued: 'waiting',
  removed: 'ruled out',
}

function tagged(label: string, tag: Tag | undefined): string {
  return tag === undefined ? label : `${label} (${TAG_LABEL[tag]})`
}

/**
 * A plain-text reading of a structure, for screen readers. Every canvas uses
 * this as its accessible name, so the structure is readable without sight.
 */
export function describeSnapshot(state: StructureSnapshot): string {
  switch (state.kind) {
    case 'array':
      return `Array: ${state.values.map((value, index) => tagged(String(value), state.tags[index])).join(', ')}.`
    case 'list': {
      const byId = new Map(state.nodes.map((node) => [node.id, node]))
      const seen = new Set<string>()
      const chain: string[] = []
      let cursor = state.head
      while (cursor !== null && !seen.has(cursor)) {
        seen.add(cursor)
        const node = byId.get(cursor)
        if (node === undefined) break
        chain.push(tagged(String(node.value), state.tags[node.id]))
        cursor = node.next
      }
      const ending = cursor === null ? 'null' : `back to ${byId.get(cursor)?.value ?? '?'}`
      return `Linked list: ${[...chain, ending].join(' → ')}.`
    }
    case 'tree': {
      if (state.root === null) return 'Empty tree.'
      const lines = state.nodes.map((node) => {
        const child = (id: string | null) => state.nodes.find((candidate) => candidate.id === id)?.value ?? 'none'
        return `${tagged(String(node.value), state.tags[node.id])}: left ${child(node.left)}, right ${child(node.right)}`
      })
      return `Tree. ${lines.join('; ')}.`
    }
    case 'graph': {
      const nodes = state.nodes.map((node) => {
        const label = state.labels[node]
        return tagged(label === undefined ? node : `${node} [${label}]`, state.tags[node])
      })
      const arrow = state.directed ? '→' : '–'
      const edges = state.edges.map((edge) => {
        const weight = edge.weight === undefined ? '' : ` (${edge.weight})`
        const status = edge.state === 'idle' ? '' : ` ${edge.state}`
        return `${edge.from}${arrow}${edge.to}${weight}${status}`
      })
      return `Graph. Nodes: ${nodes.join(', ')}. Edges: ${edges.join(', ')}.`
    }
    case 'table': {
      const rows = state.cells.map(
        (row, index) => `${state.rowLabels[index] ?? index}: ${row.map((cell) => (cell === null ? 'blank' : String(cell))).join(', ')}`,
      )
      return `Table with columns ${state.columnLabels.join(', ')}. ${rows.join('; ')}.`
    }
  }
}
