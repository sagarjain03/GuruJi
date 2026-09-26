import { describe, expect, it } from 'vitest'
import {
  binarySearch,
  bubbleSort,
  heapSort,
  insertionSort,
  linearSearch,
  mergeSort,
  quickSort,
  selectionSort,
} from './arrays'
import { VisualizerInputError, type AlgorithmStep, type ArraySnapshot } from './model'

const types = (steps: AlgorithmStep[]) => steps.map((step) => step.type)
const values = (steps: AlgorithmStep[]) => steps.map((step) => (step.state as ArraySnapshot).values)
const last = (steps: AlgorithmStep[]) => {
  const step = steps.at(-1)
  if (step === undefined) throw new Error('Expected at least one step.')
  return step
}

describe('sorting event streams', () => {
  it('bubble sort compares neighbours and swaps the larger right', () => {
    const steps = bubbleSort([3, 1, 2])

    expect(types(steps)).toEqual(['COMPARE', 'SWAP', 'COMPARE', 'SWAP', 'COMPARE', 'DONE'])
    expect(values(steps)).toEqual([
      [3, 1, 2],
      [1, 3, 2],
      [1, 3, 2],
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ])
    expect(last(steps).metrics).toEqual({ comparisons: 3, swaps: 2, visits: 0 })
    expect(last(steps).description).toContain('sorted')
  })

  it('selection sort marks each new minimum before swapping it into place', () => {
    const steps = selectionSort([3, 1, 2])

    expect(types(steps)).toEqual([
      'MARK', 'COMPARE', 'MARK', 'COMPARE', 'SWAP',
      'MARK', 'COMPARE', 'MARK', 'SWAP',
      'DONE',
    ])
    expect(values(steps)[4]).toEqual([1, 3, 2])
    expect(last(steps).metrics).toEqual({ comparisons: 3, swaps: 2, visits: 0 })
  })

  it('insertion sort stops sliding as soon as the prefix is in order', () => {
    const steps = insertionSort([3, 1, 2])

    expect(types(steps)).toEqual(['MARK', 'COMPARE', 'SWAP', 'MARK', 'COMPARE', 'SWAP', 'COMPARE', 'DONE'])
    expect(last(steps).state).toMatchObject({ values: [1, 2, 3] })
    expect(last(steps).metrics).toEqual({ comparisons: 3, swaps: 2, visits: 0 })
  })

  it('merge sort splits, compares the two heads, and writes each value back', () => {
    const steps = mergeSort([2, 1])

    expect(types(steps)).toEqual(['MARK', 'COMPARE', 'UPDATE', 'UPDATE', 'DONE'])
    expect(values(steps)).toEqual([
      [2, 1],
      [2, 1],
      [1, 1],
      [1, 2],
      [1, 2],
    ])
    expect(steps[1]?.values).toEqual([2, 1])
  })

  it('quick sort partitions around the last value and settles the pivot', () => {
    const steps = quickSort([3, 1, 2])

    expect(types(steps)).toEqual(['MARK', 'COMPARE', 'COMPARE', 'SWAP', 'SWAP', 'DONE'])
    expect(steps[0]?.state).toMatchObject({ tags: { 2: 'pivot' } })
    expect(steps[4]?.state).toMatchObject({ values: [1, 2, 3], tags: { 1: 'settled' } })
    expect(last(steps).metrics).toEqual({ comparisons: 2, swaps: 2, visits: 0 })
  })

  it('heap sort builds a max-heap, then moves the maximum to the end', () => {
    const steps = heapSort([1, 3, 2])

    expect(types(steps)).toEqual(['COMPARE', 'COMPARE', 'SWAP', 'MARK', 'SWAP', 'COMPARE', 'SWAP', 'DONE'])
    expect(values(steps)[3]).toEqual([3, 1, 2])
    expect(last(steps).state).toMatchObject({ values: [1, 2, 3] })
  })

  it('sorts every input correctly, duplicates and negatives included', () => {
    const input = [5, -2, 9, 0, 5, 3, -7, 1]
    const sorted = [...input].sort((a, b) => a - b)
    for (const sort of [bubbleSort, selectionSort, insertionSort, mergeSort, quickSort, heapSort]) {
      expect(last(sort(input)).state).toMatchObject({ values: sorted })
    }
  })

  it('records independent snapshots, so a mutated step cannot rewrite another', () => {
    const steps = bubbleSort([3, 1, 2])
    const first = steps[0]?.state as ArraySnapshot
    first.values[0] = 99
    first.tags[0] = 'found'

    expect(values(steps)[1]).toEqual([1, 3, 2])
    expect((steps[1]?.state as ArraySnapshot).tags[0]).toBeUndefined()
  })
})

describe('searching event streams', () => {
  it('linear search visits in order and marks the match', () => {
    const steps = linearSearch([4, 2, 7], 7)

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'VISIT', 'MARK', 'DONE'])
    expect(steps.map((step) => step.indices)).toEqual([[0], [1], [2], [2], [2]])
    expect(last(steps).variables).toEqual({ target: 7, foundIndex: 2 })
    expect(last(steps).metrics).toEqual({ comparisons: 3, swaps: 0, visits: 3 })
  })

  it('linear search says so when the target is missing', () => {
    const steps = linearSearch([1, 2], 9)

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'DONE'])
    expect(last(steps).description).toBe('9 is not in the array.')
  })

  it('binary search halves the range and rules out the discarded half', () => {
    const steps = binarySearch([1, 3, 5, 7, 9], 7)

    expect(types(steps)).toEqual(['COMPARE', 'MARK', 'COMPARE', 'MARK', 'DONE'])
    expect(steps[0]?.variables).toMatchObject({ lo: 0, mid: 2, hi: 4 })
    expect(steps[2]?.variables).toMatchObject({ lo: 3, mid: 3, hi: 4 })
    expect(last(steps).state).toMatchObject({ tags: { 0: 'removed', 1: 'removed', 2: 'removed', 3: 'found' } })
  })

  it('binary search refuses unsorted input with a clear message', () => {
    expect(() => binarySearch([3, 1, 2], 1)).toThrow(VisualizerInputError)
    expect(() => binarySearch([3, 1, 2], 1)).toThrow('sorted in ascending order')
  })
})

describe('array bounds', () => {
  it('refuses arrays over the cap and streams over the step limit', () => {
    const tooLong = Array.from({ length: 51 }, (_, index) => index)
    expect(() => bubbleSort(tooLong)).toThrow('Arrays are limited to 50 values; got 51.')
    expect(() => linearSearch([1], 1, { maxSteps: 0 })).toThrow('This input needs more than 0 steps.')
  })
})
