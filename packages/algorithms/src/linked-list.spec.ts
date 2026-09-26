import { describe, expect, it } from 'vitest'
import { describeSnapshot } from './describe'
import { detectCycle, listDelete, listInsert, listReverse } from './linked-list'
import type { AlgorithmStep, ListSnapshot } from './model'

const types = (steps: AlgorithmStep[]) => steps.map((step) => step.type)
const final = (steps: AlgorithmStep[]) => {
  const step = steps.at(-1)
  if (step === undefined) throw new Error('Expected at least one step.')
  return step
}

describe('linked list event streams', () => {
  it('insert walks to the predecessor, links the new node forward first, then back', () => {
    const steps = listInsert([1, 2], 9, 1)

    expect(types(steps)).toEqual(['VISIT', 'INSERT', 'UPDATE', 'UPDATE', 'DONE'])
    // Between the two UPDATEs the new node already points at 2, so nothing is lost.
    expect((steps[2]?.state as ListSnapshot).nodes.find((node) => node.value === 9)?.next).toBe('n1')
    expect(describeSnapshot(final(steps).state)).toBe('Linked list: 1 → 9 (found) → 2 → null.')
  })

  it('insert at position 0 makes a new head', () => {
    const steps = listInsert([1, 2], 9, 0)

    expect(types(steps)).toEqual(['INSERT', 'UPDATE', 'DONE'])
    expect(describeSnapshot(final(steps).state)).toBe('Linked list: 9 (found) → 1 → 2 → null.')
  })

  it('insert rejects a position past the end', () => {
    expect(() => listInsert([1, 2], 9, 3)).toThrow('Position must be between 0 and 2.')
  })

  it('delete relinks the predecessor, then drops the node', () => {
    const steps = listDelete([1, 2, 3], 2)

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'UPDATE', 'DELETE', 'DONE'])
    expect((final(steps).state as ListSnapshot).nodes.map((node) => node.value)).toEqual([1, 3])
  })

  it('delete of the head moves the head', () => {
    const steps = listDelete([1, 2, 3], 1)

    expect(types(steps)).toEqual(['VISIT', 'UPDATE', 'DELETE', 'DONE'])
    expect(describeSnapshot(final(steps).state)).toBe('Linked list: 2 → 3 → null.')
  })

  it('delete of a missing value walks the whole list and changes nothing', () => {
    const steps = listDelete([1, 2, 3], 7)

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'VISIT', 'DONE'])
    expect(final(steps).description).toContain('not in the list')
  })

  it('reverse turns one arrow per node, keeping the boxes in place', () => {
    const steps = listReverse([1, 2, 3])

    expect(types(steps)).toEqual(['VISIT', 'UPDATE', 'VISIT', 'UPDATE', 'VISIT', 'UPDATE', 'DONE'])
    expect(steps[0]?.variables).toEqual({ prev: 'null', curr: '1', next: '2' })
    const state = final(steps).state as ListSnapshot
    expect(state.nodes.map((node) => node.value)).toEqual([1, 2, 3])
    expect(describeSnapshot(state)).toBe('Linked list: 3 (done) → 2 (done) → 1 (done) → null.')
  })

  it("Floyd's pointers meet inside a cycle", () => {
    const steps = detectCycle([1, 2, 3, 4], 1)

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'VISIT', 'MARK', 'DONE'])
    expect(steps.slice(0, 3).map((step) => step.variables)).toEqual([
      { slow: '2', fast: '3' },
      { slow: '3', fast: '2' },
      { slow: '4', fast: '4' },
    ])
    expect(final(steps).variables).toEqual({ hasCycle: true })
    expect(describeSnapshot(final(steps).state)).toBe('Linked list: 1 → 2 → 3 → 4 (found) → back to 2.')
  })

  it('fast runs off the end of a list without a cycle', () => {
    const steps = detectCycle([1, 2, 3], -1)

    expect(types(steps)).toEqual(['VISIT', 'DONE'])
    expect(final(steps).variables).toEqual({ hasCycle: false })
  })

  it('refuses lists over the cap', () => {
    expect(() => listReverse(Array.from({ length: 21 }, (_, index) => index))).toThrow(
      'Linked lists are limited to 20 nodes; got 21.',
    )
  })
})
