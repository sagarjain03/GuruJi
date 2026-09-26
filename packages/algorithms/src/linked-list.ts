import { LIMITS } from './input'
import { VisualizerInputError, type AlgorithmOptions, type AlgorithmStep, type ListNode, type ListSnapshot } from './model'
import { Recorder } from './recorder'

/**
 * `nodes` is display order, left to right; `next` is the actual link. Keeping
 * the two apart is what lets a reversal show arrows turning around while the
 * boxes stay put.
 */
function buildList(values: number[]): ListSnapshot {
  if (values.length > LIMITS.list) {
    throw new VisualizerInputError(`Linked lists are limited to ${LIMITS.list} nodes; got ${values.length}.`)
  }
  const nodes: ListNode[] = values.map((value, index) => ({
    id: `n${index}`,
    value,
    next: index + 1 < values.length ? `n${index + 1}` : null,
  }))
  return { kind: 'list', head: nodes[0]?.id ?? null, nodes, tags: {}, pointers: {} }
}

function node(state: ListSnapshot, id: string): ListNode {
  const found = state.nodes.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`No node ${id}.`)
  return found
}

function valueOf(state: ListSnapshot, id: string | null): string {
  return id === null ? 'null' : String(node(state, id).value)
}

export function listInsert(values: number[], value: number, position: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (values.length + 1 > LIMITS.list) {
    throw new VisualizerInputError(`Linked lists are limited to ${LIMITS.list} nodes.`)
  }
  if (position < 0 || position > values.length) {
    throw new VisualizerInputError(`Position must be between 0 and ${values.length}.`)
  }
  const recorder = new Recorder(options)
  const state = buildList(values)
  const created: ListNode = { id: `n${values.length}`, value, next: null }

  if (position === 0) {
    state.nodes.unshift(created)
    state.pointers = { new: created.id }
    recorder.emit('INSERT', state, {
      nodeIds: [created.id],
      variables: { value, position },
      description: `Create a node holding ${value}.`,
    })
    created.next = state.head
    state.head = created.id
    state.pointers = { head: created.id }
    recorder.emit('UPDATE', state, {
      nodeIds: [created.id],
      variables: { value, position },
      description: `Point the new node at the old head, then make it the head.`,
    })
  } else {
    let current = state.head
    for (let index = 0; index < position - 1 && current !== null; index += 1) {
      recorder.metrics.visits += 1
      state.pointers = { curr: current }
      recorder.emit('VISIT', state, {
        nodeIds: [current],
        variables: { index, position },
        description: `Walk past ${valueOf(state, current)} toward position ${position}.`,
      })
      current = node(state, current).next
    }
    if (current === null) throw new RangeError('Walked off the list.')

    recorder.metrics.visits += 1
    state.pointers = { curr: current }
    recorder.emit('VISIT', state, {
      nodeIds: [current],
      variables: { index: position - 1, position },
      description: `${valueOf(state, current)} is the node just before position ${position}.`,
    })

    const before = node(state, current)
    state.nodes.splice(position, 0, created)
    state.pointers = { curr: current, new: created.id }
    recorder.emit('INSERT', state, {
      nodeIds: [created.id],
      variables: { value, position },
      description: `Create a node holding ${value}.`,
    })

    created.next = before.next
    recorder.emit('UPDATE', state, {
      nodeIds: [created.id],
      variables: { value, position },
      description: `Point the new node at ${valueOf(state, created.next)} first, so nothing is lost.`,
    })
    before.next = created.id
    recorder.emit('UPDATE', state, {
      nodeIds: [before.id, created.id],
      variables: { value, position },
      description: `Then point ${before.value} at the new node.`,
    })
  }

  state.tags[created.id] = 'found'
  state.pointers = { head: state.head }
  recorder.emit('DONE', state, {
    nodeIds: [created.id],
    variables: { value, position },
    description: `${value} is now at position ${position}.`,
  })
  return recorder.steps
}

export function listDelete(values: number[], target: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = buildList(values)
  let previous: string | null = null
  let current = state.head
  let index = 0

  while (current !== null) {
    recorder.metrics.visits += 1
    recorder.metrics.comparisons += 1
    state.pointers = { prev: previous, curr: current }
    recorder.emit('VISIT', state, {
      nodeIds: [current],
      variables: { index, target },
      description: `Is ${valueOf(state, current)} the value ${target}?`,
    })
    if (node(state, current).value === target) break
    state.tags[current] = 'visited'
    previous = current
    current = node(state, current).next
    index += 1
  }

  if (current === null) {
    state.pointers = { head: state.head }
    recorder.emit('DONE', state, {
      variables: { target },
      description: `${target} is not in the list; nothing to delete.`,
    })
    return recorder.steps
  }

  const doomed = node(state, current)
  state.tags[doomed.id] = 'removed'
  if (previous === null) {
    state.head = doomed.next
    state.pointers = { head: state.head, curr: doomed.id }
    recorder.emit('UPDATE', state, {
      nodeIds: [doomed.id],
      variables: { index, target },
      description: `${target} is the head, so the head moves to ${valueOf(state, doomed.next)}.`,
    })
  } else {
    node(state, previous).next = doomed.next
    recorder.emit('UPDATE', state, {
      nodeIds: [previous, doomed.id],
      variables: { index, target },
      description: `Point ${valueOf(state, previous)} past ${target} to ${valueOf(state, doomed.next)}.`,
    })
  }

  state.nodes = state.nodes.filter((candidate) => candidate.id !== doomed.id)
  delete state.tags[doomed.id]
  state.pointers = { head: state.head }
  recorder.emit('DELETE', state, {
    variables: { index, target },
    description: `Nothing points at ${target} any more, so it is removed.`,
  })
  recorder.emit('DONE', state, { variables: { target }, description: `Deleted ${target}.` })
  return recorder.steps
}

export function listReverse(values: number[], options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = buildList(values)
  let previous: string | null = null
  let current = state.head

  while (current !== null) {
    const following: string | null = node(state, current).next
    recorder.metrics.visits += 1
    state.pointers = { prev: previous, curr: current, next: following }
    recorder.emit('VISIT', state, {
      nodeIds: [current],
      variables: { prev: valueOf(state, previous), curr: valueOf(state, current), next: valueOf(state, following) },
      description: `Remember ${valueOf(state, following)} before cutting the link out of ${valueOf(state, current)}.`,
    })
    node(state, current).next = previous
    state.tags[current] = 'settled'
    recorder.emit('UPDATE', state, {
      nodeIds: [current],
      variables: { prev: valueOf(state, previous), curr: valueOf(state, current), next: valueOf(state, following) },
      description: `Point ${valueOf(state, current)} back at ${valueOf(state, previous)}.`,
    })
    previous = current
    current = following
  }

  state.head = previous
  state.pointers = { head: previous }
  recorder.emit('DONE', state, {
    nodeIds: previous === null ? [] : [previous],
    variables: { head: valueOf(state, previous) },
    description: `Every link is reversed; ${valueOf(state, previous)} is the new head.`,
  })
  return recorder.steps
}

/** Floyd's tortoise and hare. `cycleAt` is the index the tail links back to, or -1. */
export function detectCycle(values: number[], cycleAt: number, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (cycleAt < -1 || cycleAt >= values.length) {
    throw new VisualizerInputError(`The cycle position must be -1 (no cycle) or between 0 and ${values.length - 1}.`)
  }
  const recorder = new Recorder(options)
  const state = buildList(values)
  const tail = state.nodes.at(-1)
  if (tail !== undefined && cycleAt >= 0) tail.next = `n${cycleAt}`

  let slow = state.head
  let fast = state.head
  let found = false

  while (fast !== null && node(state, fast).next !== null) {
    slow = slow === null ? null : node(state, slow).next
    const skip: string | null = node(state, fast).next
    fast = skip === null ? null : node(state, skip).next
    recorder.metrics.visits += 3
    state.pointers = { slow, fast }
    recorder.emit('VISIT', state, {
      nodeIds: [slow, fast].filter((id): id is string => id !== null),
      variables: { slow: valueOf(state, slow), fast: valueOf(state, fast) },
      description: `Slow moves one step to ${valueOf(state, slow)}; fast moves two to ${valueOf(state, fast)}.`,
    })
    if (slow === null || fast === null) break
    recorder.metrics.comparisons += 1
    if (slow === fast) {
      found = true
      state.tags[slow] = 'found'
      recorder.emit('MARK', state, {
        nodeIds: [slow],
        variables: { slow: valueOf(state, slow), fast: valueOf(state, fast) },
        description: `Slow and fast meet at ${valueOf(state, slow)} — only a loop lets the faster pointer catch up.`,
      })
      break
    }
  }

  recorder.emit('DONE', state, {
    variables: { hasCycle: found },
    description: found ? 'The list has a cycle.' : 'Fast reached the end, so the list has no cycle.',
  })
  return recorder.steps
}
