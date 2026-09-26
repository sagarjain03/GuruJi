import { describe, expect, it } from 'vitest'
import { coinChange, fibonacci, knapsack, longestCommonSubsequence } from './dp'
import type { AlgorithmStep, TableSnapshot } from './model'

const types = (steps: AlgorithmStep[]) => steps.map((step) => step.type)
const cells = (steps: AlgorithmStep[]) => (steps.at(-1)?.state as TableSnapshot).cells

describe('DP table event streams', () => {
  it('Fibonacci fills left to right, each cell reading the two before it', () => {
    const steps = fibonacci(5)

    expect(types(steps)).toEqual(['UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'DONE'])
    expect(cells(steps)).toEqual([[0, 1, 1, 2, 3, 5]])
    expect(steps[2]?.cells).toEqual([
      [0, 2],
      [0, 1],
      [0, 0],
    ])
    // Cells not yet computed are blank, not zero.
    expect((steps[0]?.state as TableSnapshot).cells).toEqual([[0, null, null, null, null, null]])
  })

  it('knapsack keeps the better of skipping or taking each item', () => {
    const steps = knapsack([1, 2], [1, 3], 3)

    expect(steps).toHaveLength(10)
    expect(cells(steps)).toEqual([
      [0, 0, 0, 0],
      [0, 1, 1, 1],
      [0, 1, 3, 4],
    ])
    expect(steps.at(-1)?.variables).toEqual({ answer: 4 })
    // Row 2, capacity 3 reads the row above at 3 (skip) and at 3 - 2 (take).
    expect(steps[8]?.cells).toEqual([
      [2, 3],
      [1, 3],
      [1, 1],
    ])
  })

  it('knapsack refuses mismatched items', () => {
    expect(() => knapsack([1, 2], [1], 3)).toThrow('same number of items')
  })

  it('LCS extends the diagonal on a match and takes the better neighbour otherwise', () => {
    const steps = longestCommonSubsequence('AB', 'B')

    expect(types(steps)).toEqual(['UPDATE', 'UPDATE', 'UPDATE', 'DONE'])
    expect(steps[1]?.variables).toMatchObject({ match: false })
    expect(steps[2]?.variables).toMatchObject({ match: true })
    expect(cells(steps)).toEqual([
      [0, 0],
      [0, 0],
      [0, 1],
    ])
  })

  it('LCS matches the textbook answer', () => {
    expect(longestCommonSubsequence('ABCBDAB', 'BDCABA').at(-1)?.variables).toEqual({ answer: 4 })
  })

  it('coin change marks unreachable amounts as ∞', () => {
    const steps = coinChange([2], 3)

    expect(cells(steps)).toEqual([[0, '∞', 1, '∞']])
    expect(steps.at(-1)?.description).toBe('3 cannot be made from these coins.')
  })

  it('coin change finds the fewest coins', () => {
    expect(coinChange([1, 2, 5], 11).at(-1)?.variables).toEqual({ answer: 3 })
  })

  it('refuses inputs over the table caps', () => {
    expect(() => fibonacci(31)).toThrow('n must be between 0 and 30.')
    expect(() => longestCommonSubsequence('ABCDEFGHIJKLM', 'A')).toThrow('limited to 12 characters')
    expect(() => coinChange([1], 51)).toThrow('between 0 and 50')
  })
})
