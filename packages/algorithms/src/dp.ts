import { LIMITS } from './input'
import { VisualizerInputError, type AlgorithmOptions, type AlgorithmStep, type TableCell, type TableSnapshot } from './model'
import { Recorder } from './recorder'

function table(rowLabels: string[], columnLabels: string[]): TableSnapshot {
  return {
    kind: 'table',
    rowLabels,
    columnLabels,
    cells: rowLabels.map(() => columnLabels.map((): TableCell => null)),
  }
}

function set(state: TableSnapshot, row: number, column: number, value: TableCell): void {
  const cells = state.cells[row]
  if (cells === undefined || column < 0 || column >= cells.length) throw new RangeError(`No cell ${row},${column}.`)
  cells[column] = value
}

function read(state: TableSnapshot, row: number, column: number): number {
  const value = state.cells[row]?.[column]
  if (typeof value !== 'number') throw new RangeError(`Cell ${row},${column} is not filled.`)
  return value
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

export function fibonacci(n: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (n < 0 || n > LIMITS.fibonacci) {
    throw new VisualizerInputError(`n must be between 0 and ${LIMITS.fibonacci}.`)
  }
  const recorder = new Recorder(options)
  const state = table(['F(i)'], range(n + 1).map(String))

  for (const index of range(n + 1)) {
    if (index < 2) {
      set(state, 0, index, index)
      recorder.emit('UPDATE', state, {
        cells: [[0, index]],
        variables: { i: index, [`F(${index})`]: index },
        description: `Base case: F(${index}) = ${index}.`,
      })
      continue
    }
    const value = read(state, 0, index - 1) + read(state, 0, index - 2)
    set(state, 0, index, value)
    recorder.emit('UPDATE', state, {
      cells: [
        [0, index],
        [0, index - 1],
        [0, index - 2],
      ],
      variables: { i: index, [`F(${index - 1})`]: read(state, 0, index - 1), [`F(${index - 2})`]: read(state, 0, index - 2) },
      description: `F(${index}) = F(${index - 1}) + F(${index - 2}) = ${value}. Each value is computed once, then reused.`,
    })
  }

  recorder.emit('DONE', state, {
    cells: [[0, n]],
    variables: { answer: read(state, 0, n) },
    description: `F(${n}) = ${read(state, 0, n)}.`,
  })
  return recorder.steps
}

export function knapsack(weights: number[], values: number[], capacity: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (weights.length !== values.length) {
    throw new VisualizerInputError('Weights and values need the same number of items.')
  }
  if (weights.length > LIMITS.knapsackItems) {
    throw new VisualizerInputError(`Knapsack is limited to ${LIMITS.knapsackItems} items.`)
  }
  if (capacity < 0 || capacity > LIMITS.knapsackCapacity) {
    throw new VisualizerInputError(`Capacity must be between 0 and ${LIMITS.knapsackCapacity}.`)
  }
  if (weights.some((weight) => weight <= 0) || values.some((value) => value < 0)) {
    throw new VisualizerInputError('Weights must be positive and values non-negative.')
  }

  const recorder = new Recorder(options)
  const rows = ['none', ...weights.map((weight, index) => `w${weight} v${values[index] ?? 0}`)]
  const state = table(rows, range(capacity + 1).map(String))
  for (const column of range(capacity + 1)) set(state, 0, column, 0)
  recorder.emit('UPDATE', state, {
    cells: range(capacity + 1).map((column): [number, number] => [0, column]),
    variables: { items: 0 },
    description: 'With no items to choose from, every capacity is worth 0.',
  })

  weights.forEach((weight, itemIndex) => {
    const row = itemIndex + 1
    const worth = values[itemIndex] ?? 0
    for (const column of range(capacity + 1)) {
      const skip = read(state, row - 1, column)
      recorder.metrics.comparisons += 1
      if (weight > column) {
        set(state, row, column, skip)
        recorder.emit('UPDATE', state, {
          cells: [
            [row, column],
            [row - 1, column],
          ],
          variables: { item: row, capacity: column, weight, value: worth, skip },
          description: `Weight ${weight} does not fit in ${column}; copy the best without it, ${skip}.`,
        })
        continue
      }
      const take = worth + read(state, row - 1, column - weight)
      set(state, row, column, Math.max(skip, take))
      recorder.emit('UPDATE', state, {
        cells: [
          [row, column],
          [row - 1, column],
          [row - 1, column - weight],
        ],
        variables: { item: row, capacity: column, weight, value: worth, skip, take },
        description: `Skip it: ${skip}. Take it: ${worth} + best for ${column - weight} = ${take}. Keep ${Math.max(skip, take)}.`,
      })
    }
  })

  const answer = read(state, weights.length, capacity)
  recorder.emit('DONE', state, {
    cells: [[weights.length, capacity]],
    variables: { answer },
    description: `The best value that fits in capacity ${capacity} is ${answer}.`,
  })
  return recorder.steps
}

export function longestCommonSubsequence(first: string, second: string, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (first.length > LIMITS.lcsLength || second.length > LIMITS.lcsLength) {
    throw new VisualizerInputError(`Each string is limited to ${LIMITS.lcsLength} characters.`)
  }
  const recorder = new Recorder(options)
  const state = table(['∅', ...first], ['∅', ...second])
  for (const row of range(first.length + 1)) set(state, row, 0, 0)
  for (const column of range(second.length + 1)) set(state, 0, column, 0)
  recorder.emit('UPDATE', state, {
    variables: {},
    description: 'An empty string shares nothing with anything: the first row and column are 0.',
  })

  for (let row = 1; row <= first.length; row += 1) {
    for (let column = 1; column <= second.length; column += 1) {
      const a = first[row - 1] ?? ''
      const b = second[column - 1] ?? ''
      recorder.metrics.comparisons += 1
      if (a === b) {
        const value = read(state, row - 1, column - 1) + 1
        set(state, row, column, value)
        recorder.emit('UPDATE', state, {
          cells: [
            [row, column],
            [row - 1, column - 1],
          ],
          variables: { i: row, j: column, a, b, match: true },
          description: `'${a}' matches: extend the diagonal by one, giving ${value}.`,
        })
      } else {
        const up = read(state, row - 1, column)
        const left = read(state, row, column - 1)
        set(state, row, column, Math.max(up, left))
        recorder.emit('UPDATE', state, {
          cells: [
            [row, column],
            [row - 1, column],
            [row, column - 1],
          ],
          variables: { i: row, j: column, a, b, match: false },
          description: `'${a}' ≠ '${b}': keep the better of dropping one character, max(${up}, ${left}) = ${Math.max(up, left)}.`,
        })
      }
    }
  }

  const answer = read(state, first.length, second.length)
  recorder.emit('DONE', state, {
    cells: [[first.length, second.length]],
    variables: { answer },
    description: `The longest common subsequence has length ${answer}.`,
  })
  return recorder.steps
}

/** Fewest coins to make each amount; `∞` means that amount cannot be made. */
export function coinChange(coins: number[], amount: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (coins.length > LIMITS.coinTypes) {
    throw new VisualizerInputError(`Coin change is limited to ${LIMITS.coinTypes} coin types.`)
  }
  if (coins.some((coin) => coin <= 0)) throw new VisualizerInputError('Coins must be positive.')
  if (amount < 0 || amount > LIMITS.coinAmount) {
    throw new VisualizerInputError(`The amount must be between 0 and ${LIMITS.coinAmount}.`)
  }

  const recorder = new Recorder(options)
  const state = table(['coins'], range(amount + 1).map(String))
  const best: number[] = [0]
  set(state, 0, 0, 0)
  recorder.emit('UPDATE', state, {
    cells: [[0, 0]],
    variables: { amount: 0 },
    description: 'Making 0 takes 0 coins.',
  })

  for (let target = 1; target <= amount; target += 1) {
    let fewest = Number.POSITIVE_INFINITY
    const reads: [number, number][] = []
    const tried: string[] = []
    for (const coin of coins) {
      if (coin > target) continue
      recorder.metrics.comparisons += 1
      const rest = best[target - coin] ?? Number.POSITIVE_INFINITY
      reads.push([0, target - coin])
      tried.push(`${coin}→${Number.isFinite(rest) ? rest + 1 : '∞'}`)
      fewest = Math.min(fewest, rest + 1)
    }
    best[target] = fewest
    set(state, 0, target, Number.isFinite(fewest) ? fewest : '∞')
    recorder.emit('UPDATE', state, {
      cells: [[0, target], ...reads],
      variables: { amount: target, best: Number.isFinite(fewest) ? fewest : '∞' },
      description:
        tried.length === 0
          ? `No coin is small enough to make ${target}.`
          : `To make ${target}, try each last coin (${tried.join(', ')}); the fewest is ${Number.isFinite(fewest) ? fewest : '∞'}.`,
    })
  }

  const answer = best[amount] ?? Number.POSITIVE_INFINITY
  recorder.emit('DONE', state, {
    cells: [[0, amount]],
    variables: { answer: Number.isFinite(answer) ? answer : -1 },
    description: Number.isFinite(answer) ? `${amount} needs at least ${answer} coins.` : `${amount} cannot be made from these coins.`,
  })
  return recorder.steps
}
