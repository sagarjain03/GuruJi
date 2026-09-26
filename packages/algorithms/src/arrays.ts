import { LIMITS } from './input'
import { VisualizerInputError, type AlgorithmOptions, type AlgorithmStep, type ArraySnapshot } from './model'
import { Recorder } from './recorder'

function capArray(input: number[]): void {
  if (input.length > LIMITS.array) {
    throw new VisualizerInputError(`Arrays are limited to ${LIMITS.array} values; got ${input.length}.`)
  }
}

function arrayState(values: number[]): ArraySnapshot {
  return { kind: 'array', values: [...values], tags: {}, pointers: {} }
}

function at(values: number[], index: number): number {
  const value = values[index]
  if (value === undefined) throw new RangeError(`Index ${index} is outside the array.`)
  return value
}

function swap(values: number[], left: number, right: number): void {
  const held = at(values, left)
  values[left] = at(values, right)
  values[right] = held
}

function finish(recorder: Recorder, state: ArraySnapshot): AlgorithmStep[] {
  state.pointers = {}
  state.values.forEach((_, index) => {
    state.tags[index] = 'settled'
  })
  recorder.emit('DONE', state, { description: 'The array is sorted.' })
  return recorder.steps
}

export function bubbleSort(input: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values

  for (let end = values.length - 1; end > 0; end -= 1) {
    for (let index = 0; index < end; index += 1) {
      recorder.metrics.comparisons += 1
      state.pointers = { j: index, end }
      recorder.emit('COMPARE', state, {
        indices: [index, index + 1],
        values: [at(values, index), at(values, index + 1)],
        variables: { j: index, end },
        description: `Compare ${at(values, index)} and ${at(values, index + 1)}: the larger one should move right.`,
      })

      if (at(values, index) > at(values, index + 1)) {
        swap(values, index, index + 1)
        recorder.metrics.swaps += 1
        recorder.emit('SWAP', state, {
          indices: [index, index + 1],
          values: [at(values, index), at(values, index + 1)],
          variables: { j: index, end },
          description: `${at(values, index + 1)} is larger, so it swaps one place right.`,
        })
      }
    }
    state.tags[end] = 'settled'
  }

  return finish(recorder, state)
}

export function selectionSort(input: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values

  for (let start = 0; start < values.length - 1; start += 1) {
    let smallest = start
    state.pointers = { i: start, min: smallest }
    recorder.emit('MARK', state, {
      indices: [start],
      variables: { i: start, min: smallest },
      description: `Find the smallest value from position ${start} onward; start by assuming it is ${at(values, start)}.`,
    })

    for (let index = start + 1; index < values.length; index += 1) {
      recorder.metrics.comparisons += 1
      state.pointers = { i: start, min: smallest, j: index }
      recorder.emit('COMPARE', state, {
        indices: [index, smallest],
        values: [at(values, index), at(values, smallest)],
        variables: { i: start, j: index, min: smallest },
        description: `Is ${at(values, index)} smaller than the current minimum ${at(values, smallest)}?`,
      })
      if (at(values, index) < at(values, smallest)) {
        smallest = index
        state.pointers = { i: start, min: smallest }
        recorder.emit('MARK', state, {
          indices: [smallest],
          variables: { i: start, j: index, min: smallest },
          description: `Yes — ${at(values, smallest)} is the new minimum.`,
        })
      }
    }

    if (smallest !== start) {
      swap(values, start, smallest)
      recorder.metrics.swaps += 1
      recorder.emit('SWAP', state, {
        indices: [start, smallest],
        variables: { i: start, min: smallest },
        description: `Move the minimum ${at(values, start)} into position ${start}.`,
      })
    }
    state.tags[start] = 'settled'
  }

  return finish(recorder, state)
}

export function insertionSort(input: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values

  for (let next = 1; next < values.length; next += 1) {
    state.pointers = { i: next }
    recorder.emit('MARK', state, {
      indices: [next],
      variables: { i: next, key: at(values, next) },
      description: `Take ${at(values, next)} and slide it left into the sorted prefix.`,
    })

    for (let index = next - 1; index >= 0; index -= 1) {
      recorder.metrics.comparisons += 1
      state.pointers = { i: next, j: index }
      recorder.emit('COMPARE', state, {
        indices: [index, index + 1],
        values: [at(values, index), at(values, index + 1)],
        variables: { i: next, j: index, key: at(values, index + 1) },
        description: `Is ${at(values, index)} larger than ${at(values, index + 1)}?`,
      })
      if (at(values, index) <= at(values, index + 1)) break
      swap(values, index, index + 1)
      recorder.metrics.swaps += 1
      recorder.emit('SWAP', state, {
        indices: [index, index + 1],
        variables: { i: next, j: index, key: at(values, index) },
        description: `Yes — shift ${at(values, index + 1)} right to make room.`,
      })
    }
  }

  return finish(recorder, state)
}

export function mergeSort(input: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values

  const merge = (low: number, middle: number, high: number): void => {
    const left = values.slice(low, middle + 1)
    const right = values.slice(middle + 1, high + 1)
    let leftIndex = 0
    let rightIndex = 0
    let write = low

    while (leftIndex < left.length || rightIndex < right.length) {
      const fromLeft = left[leftIndex]
      const fromRight = right[rightIndex]
      let take: number
      if (fromLeft !== undefined && fromRight !== undefined) {
        recorder.metrics.comparisons += 1
        state.pointers = { lo: low, mid: middle, hi: high, k: write }
        recorder.emit('COMPARE', state, {
          indices: [write],
          values: [fromLeft, fromRight],
          variables: { lo: low, mid: middle, hi: high, k: write, left: fromLeft, right: fromRight },
          description: `Compare the next left value ${fromLeft} with the next right value ${fromRight}.`,
        })
        take = fromLeft <= fromRight ? fromLeft : fromRight
        if (fromLeft <= fromRight) leftIndex += 1
        else rightIndex += 1
      } else if (fromLeft !== undefined) {
        take = fromLeft
        leftIndex += 1
      } else {
        take = fromRight ?? 0
        rightIndex += 1
      }

      values[write] = take
      recorder.emit('UPDATE', state, {
        indices: [write],
        values: [take],
        variables: { lo: low, mid: middle, hi: high, k: write },
        description: `Write ${take} into position ${write}.`,
      })
      write += 1
    }
  }

  const sort = (low: number, high: number): void => {
    if (low >= high) return
    const middle = Math.floor((low + high) / 2)
    state.pointers = { lo: low, mid: middle, hi: high }
    recorder.emit('MARK', state, {
      indices: [low, high],
      variables: { lo: low, mid: middle, hi: high },
      description: `Split positions ${low}–${high} into ${low}–${middle} and ${middle + 1}–${high}.`,
    })
    sort(low, middle)
    sort(middle + 1, high)
    merge(low, middle, high)
  }

  sort(0, values.length - 1)
  return finish(recorder, state)
}

export function quickSort(input: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values

  const partition = (low: number, high: number): number => {
    const pivot = at(values, high)
    state.tags[high] = 'pivot'
    let boundary = low - 1
    state.pointers = { lo: low, hi: high }
    recorder.emit('MARK', state, {
      indices: [high],
      variables: { lo: low, hi: high, pivot },
      description: `Use the last value, ${pivot}, as the pivot for positions ${low}–${high}.`,
    })

    for (let index = low; index < high; index += 1) {
      recorder.metrics.comparisons += 1
      state.pointers = { i: boundary, j: index }
      recorder.emit('COMPARE', state, {
        indices: [index, high],
        values: [at(values, index), pivot],
        variables: { lo: low, hi: high, pivot, i: boundary, j: index },
        description: `Is ${at(values, index)} smaller than the pivot ${pivot}?`,
      })
      if (at(values, index) < pivot) {
        boundary += 1
        if (boundary !== index) {
          swap(values, boundary, index)
          recorder.metrics.swaps += 1
          state.pointers = { i: boundary, j: index }
          recorder.emit('SWAP', state, {
            indices: [boundary, index],
            variables: { lo: low, hi: high, pivot, i: boundary, j: index },
            description: `Yes — move ${at(values, boundary)} into the smaller-than-pivot side.`,
          })
        }
      }
    }

    const final = boundary + 1
    delete state.tags[high]
    if (final !== high) {
      swap(values, final, high)
      recorder.metrics.swaps += 1
    }
    state.tags[final] = 'settled'
    state.pointers = { pivot: final }
    recorder.emit('SWAP', state, {
      indices: [final, high],
      variables: { lo: low, hi: high, pivot },
      description: `Place the pivot ${pivot} at position ${final}; it is now in its final place.`,
    })
    return final
  }

  const sort = (low: number, high: number): void => {
    if (low > high) return
    if (low === high) {
      state.tags[low] = 'settled'
      return
    }
    const pivotIndex = partition(low, high)
    sort(low, pivotIndex - 1)
    sort(pivotIndex + 1, high)
  }

  sort(0, values.length - 1)
  return finish(recorder, state)
}

export function heapSort(input: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values

  const siftDown = (root: number, size: number): void => {
    let parent = root
    for (;;) {
      let largest = parent
      for (const child of [2 * parent + 1, 2 * parent + 2]) {
        if (child >= size) continue
        recorder.metrics.comparisons += 1
        state.pointers = { parent, child }
        recorder.emit('COMPARE', state, {
          indices: [child, largest],
          values: [at(values, child), at(values, largest)],
          variables: { parent, child, largest, heapSize: size },
          description: `Is child ${at(values, child)} larger than ${at(values, largest)}?`,
        })
        if (at(values, child) > at(values, largest)) largest = child
      }
      if (largest === parent) return
      swap(values, parent, largest)
      recorder.metrics.swaps += 1
      recorder.emit('SWAP', state, {
        indices: [parent, largest],
        variables: { parent, largest, heapSize: size },
        description: `Swap ${at(values, parent)} up so the parent is the larger value.`,
      })
      parent = largest
    }
  }

  for (let index = Math.floor(values.length / 2) - 1; index >= 0; index -= 1) {
    siftDown(index, values.length)
  }
  state.pointers = {}
  recorder.emit('MARK', state, {
    indices: [0],
    variables: { heapSize: values.length },
    description: 'The array is now a max-heap: the largest value sits at position 0.',
  })

  for (let end = values.length - 1; end > 0; end -= 1) {
    swap(values, 0, end)
    recorder.metrics.swaps += 1
    state.tags[end] = 'settled'
    state.pointers = { end }
    recorder.emit('SWAP', state, {
      indices: [0, end],
      variables: { heapSize: end },
      description: `Move the largest value ${at(values, end)} to position ${end}, its final place.`,
    })
    siftDown(0, end)
  }

  return finish(recorder, state)
}

export function linearSearch(input: number[], target: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values
  let foundIndex = -1

  for (let index = 0; index < values.length; index += 1) {
    recorder.metrics.visits += 1
    recorder.metrics.comparisons += 1
    state.pointers = { i: index }
    recorder.emit('VISIT', state, {
      indices: [index],
      values: [at(values, index)],
      variables: { i: index, target },
      description: `Is ${at(values, index)} at position ${index} equal to ${target}?`,
    })
    if (at(values, index) === target) {
      foundIndex = index
      state.tags[index] = 'found'
      recorder.emit('MARK', state, {
        indices: [index],
        variables: { target, foundIndex },
        description: `Yes — found ${target} at position ${index}.`,
      })
      break
    }
    state.tags[index] = 'visited'
  }

  state.pointers = {}
  recorder.emit('DONE', state, {
    indices: foundIndex < 0 ? [] : [foundIndex],
    variables: { target, foundIndex },
    description:
      foundIndex < 0 ? `${target} is not in the array.` : `Search complete: ${target} is at position ${foundIndex}.`,
  })
  return recorder.steps
}

export function binarySearch(input: number[], target: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  capArray(input)
  for (let index = 1; index < input.length; index += 1) {
    if (at(input, index) < at(input, index - 1)) {
      throw new VisualizerInputError('Binary search needs the array sorted in ascending order.')
    }
  }
  const recorder = new Recorder(options)
  const state = arrayState(input)
  const values = state.values
  let low = 0
  let high = values.length - 1
  let foundIndex = -1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    recorder.metrics.visits += 1
    recorder.metrics.comparisons += 1
    state.pointers = { lo: low, mid: middle, hi: high }
    recorder.emit('COMPARE', state, {
      indices: [middle],
      values: [at(values, middle), target],
      variables: { lo: low, mid: middle, hi: high, target },
      description: `The middle of ${low}–${high} is ${at(values, middle)}. Compare it with ${target}.`,
    })

    if (at(values, middle) === target) {
      foundIndex = middle
      state.tags[middle] = 'found'
      recorder.emit('MARK', state, {
        indices: [middle],
        variables: { lo: low, mid: middle, hi: high, target },
        description: `Found ${target} at position ${middle}.`,
      })
      break
    }

    const goRight = at(values, middle) < target
    const [discardFrom, discardTo] = goRight ? [low, middle] : [middle, high]
    for (let index = discardFrom; index <= discardTo; index += 1) state.tags[index] = 'removed'
    if (goRight) low = middle + 1
    else high = middle - 1
    state.pointers = { lo: low, hi: high }
    recorder.emit('MARK', state, {
      indices: [],
      variables: { lo: low, hi: high, target },
      description: goRight
        ? `${at(values, middle)} < ${target}, so the target can only be to the right.`
        : `${at(values, middle)} > ${target}, so the target can only be to the left.`,
    })
  }

  state.pointers = {}
  recorder.emit('DONE', state, {
    indices: foundIndex < 0 ? [] : [foundIndex],
    variables: { target, foundIndex },
    description:
      foundIndex < 0 ? `${target} is not in the array.` : `Search complete: ${target} is at position ${foundIndex}.`,
  })
  return recorder.steps
}
