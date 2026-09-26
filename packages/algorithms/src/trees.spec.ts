import { describe, expect, it } from 'vitest'
import type { AlgorithmStep, TreeSnapshot } from './model'
import { buildTree, levelOrder, traverse, treeBfs, treeDfs } from './trees'

const types = (steps: AlgorithmStep[]) => steps.map((step) => step.type)
const popped = (steps: AlgorithmStep[]) =>
  steps
    .filter((step) => step.type === 'POP')
    .map((step) => (step.state as TreeSnapshot).nodes.find((node) => node.id === step.nodeIds?.[0])?.value)

describe('tree construction', () => {
  it('reads LeetCode level order, skipping null children', () => {
    const tree = buildTree([1, null, 2, 3])

    expect(tree.nodes).toEqual([
      { id: 't0', value: 1, left: null, right: 't2' },
      { id: 't2', value: 2, left: 't3', right: null },
      { id: 't3', value: 3, left: null, right: null },
    ])
  })
})

describe('tree event streams', () => {
  it('BFS takes nodes off a queue level by level', () => {
    const steps = treeBfs([1, 2, 3, 4], 3)

    expect(types(steps)).toEqual(['PUSH', 'POP', 'PUSH', 'POP', 'PUSH', 'POP', 'MARK', 'DONE'])
    expect(popped(steps)).toEqual([1, 2, 3])
    expect(steps[4]?.variables).toMatchObject({ queue: '[3, 4]' })
  })

  it('DFS takes nodes off a stack, finishing a branch first', () => {
    const steps = treeDfs([1, 2, 3, 4], 3)

    expect(types(steps)).toEqual(['PUSH', 'POP', 'PUSH', 'POP', 'PUSH', 'POP', 'POP', 'MARK', 'DONE'])
    expect(popped(steps)).toEqual([1, 2, 4, 3])
  })

  it('a search for a missing value visits everything and says so', () => {
    const steps = treeBfs([1, 2, 3], 9)

    expect(popped(steps)).toEqual([1, 2, 3])
    expect(steps.at(-1)?.description).toBe('9 is not in the tree.')
  })

  it('in-order outputs between the two subtrees', () => {
    const steps = traverse('inorder', [2, 1, 3])

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'MARK', 'MARK', 'VISIT', 'MARK', 'DONE'])
    expect(steps.at(-1)?.variables).toMatchObject({ output: '1, 2, 3' })
  })

  it('pre-order outputs on arrival', () => {
    const steps = traverse('preorder', [2, 1, 3])

    expect(types(steps)).toEqual(['VISIT', 'MARK', 'VISIT', 'MARK', 'VISIT', 'MARK', 'DONE'])
    expect(steps.at(-1)?.variables).toMatchObject({ output: '2, 1, 3' })
  })

  it('post-order outputs on the way back up', () => {
    const steps = traverse('postorder', [2, 1, 3])

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'MARK', 'VISIT', 'MARK', 'MARK', 'DONE'])
    expect(steps.at(-1)?.variables).toMatchObject({ output: '1, 3, 2' })
    expect(steps[3]?.variables).toMatchObject({ callStack: '2 → 3' })
  })

  it('level order processes one level-width of the queue at a time', () => {
    const steps = levelOrder([3, 9, 20, null, null, 15, 7])

    expect(types(steps)).toEqual(['PUSH', 'POP', 'PUSH', 'POP', 'POP', 'PUSH', 'POP', 'POP', 'DONE'])
    expect(steps.at(-1)?.variables).toEqual({ levels: '[3] [9, 20] [15, 7]' })
  })
})
