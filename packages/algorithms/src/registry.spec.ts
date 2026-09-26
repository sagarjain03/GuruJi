import { describe, expect, it } from 'vitest'
import { describeSnapshot } from './describe'
import { VisualizerInputError } from './model'
import { algorithmRegistry, findAlgorithm } from './registry'

function algorithm(id: string) {
  const found = findAlgorithm(id)
  if (found === undefined) throw new Error(`No algorithm ${id}.`)
  return found
}

describe('algorithm registry', () => {
  it('covers the planned set: 6 sorting, 2 searching, 4 list, 6 tree, 5 graph, 4 DP', () => {
    const counts: Record<string, number> = {}
    for (const definition of algorithmRegistry) {
      counts[definition.category] = (counts[definition.category] ?? 0) + 1
    }
    expect(counts).toEqual({ SORTING: 6, SEARCHING: 2, LINKED_LIST: 4, TREE: 6, GRAPH: 5, DP: 4 })
    expect(new Set(algorithmRegistry.map((definition) => definition.id)).size).toBe(algorithmRegistry.length)
  })

  it.each(algorithmRegistry.map((definition) => [definition.id, definition] as const))(
    '%s runs its default input to a DONE step on the structure it declares',
    (_id, definition) => {
      const steps = definition.run(definition.defaultInput)

      expect(steps.length).toBeGreaterThan(1)
      expect(steps.at(-1)?.type).toBe('DONE')
      expect(steps.filter((step) => step.type === 'DONE')).toHaveLength(1)
      for (const step of steps) {
        expect(step.state.kind).toBe(definition.structure)
        expect(step.description.trim()).not.toBe('')
        expect(describeSnapshot(step.state)).not.toBe('')
      }
    },
  )

  it('turns malformed input into a message the person can act on', () => {
    expect(() => algorithm('bubble-sort').run('3, x, 1')).toThrow('Every value in the array must be a whole number, got "x".')
    expect(() => algorithm('linear-search').run('3, 1, 2')).toThrow('Expected input shaped like: 4, 9, 2 | 9')
    expect(() => algorithm('graph-bfs').run('A-B | Z')).toThrow('Start node "Z" is not in the graph.')
    expect(() => algorithm('tree-inorder').run('null, 1')).toThrow('The tree needs a root value.')
    expect(() => algorithm('list-insert').run('1, 2 | 5')).toThrow('The value and position needs at least 2 values.')
  })

  it('reports every size cap as a VisualizerInputError', () => {
    const many = (count: number) => Array.from({ length: count }, (_, index) => index).join(', ')

    expect(() => algorithm('bubble-sort').run(many(51))).toThrow(VisualizerInputError)
    expect(() => algorithm('list-reverse').run(many(21))).toThrow(VisualizerInputError)
    expect(() => algorithm('tree-preorder').run(many(32))).toThrow('Trees are limited to 31 nodes; got 32.')
  })
})
