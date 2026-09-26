import type { ParsedGraph } from './input'
import { VisualizerInputError, type AlgorithmOptions, type AlgorithmStep, type GraphSnapshot } from './model'
import { Recorder } from './recorder'

function graphState(graph: ParsedGraph): GraphSnapshot {
  return {
    kind: 'graph',
    directed: graph.directed,
    weighted: graph.weighted,
    nodes: [...graph.nodes],
    edges: graph.edges.map((edge) => ({ ...edge, state: 'idle' })),
    tags: {},
    labels: {},
  }
}

interface Neighbour {
  node: string
  edge: number
  weight: number
}

/** Neighbours in input order, so the event sequence is deterministic. */
function adjacency(graph: ParsedGraph): Map<string, Neighbour[]> {
  const map = new Map<string, Neighbour[]>(graph.nodes.map((node) => [node, []]))
  graph.edges.forEach((edge, index) => {
    const weight = edge.weight ?? 1
    map.get(edge.from)?.push({ node: edge.to, edge: index, weight })
    if (!graph.directed) map.get(edge.to)?.push({ node: edge.from, edge: index, weight })
  })
  return map
}

function edgeAt(state: GraphSnapshot, index: number) {
  const edge = state.edges[index]
  if (edge === undefined) throw new RangeError(`No edge ${index}.`)
  return edge
}

export function graphBfs(graph: ParsedGraph, start: string, options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = graphState(graph)
  const neighbours = adjacency(graph)
  const queue = [start]
  const order: string[] = []
  state.tags[start] = 'queued'
  state.labels[start] = 'd=0'
  const depth = new Map([[start, 0]])

  recorder.emit('PUSH', state, {
    nodeIds: [start],
    variables: { queue: queue.join(', '), order: '' },
    description: `Put the start node ${start} on the queue.`,
  })

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    order.push(current)
    recorder.metrics.visits += 1
    state.tags[current] = 'visited'
    recorder.emit('POP', state, {
      nodeIds: [current],
      variables: { current, queue: queue.join(', '), order: order.join(', ') },
      description: `Visit ${current}, the oldest node on the queue.`,
    })

    for (const { node, edge } of neighbours.get(current) ?? []) {
      recorder.metrics.comparisons += 1
      if (state.tags[node] !== undefined) continue
      queue.push(node)
      state.tags[node] = 'queued'
      const distance = (depth.get(current) ?? 0) + 1
      depth.set(node, distance)
      state.labels[node] = `d=${distance}`
      edgeAt(state, edge).state = 'used'
      recorder.emit('PUSH', state, {
        nodeIds: [current, node],
        variables: { current, queue: queue.join(', '), order: order.join(', ') },
        description: `${node} is new, ${distance} edge${distance === 1 ? '' : 's'} from ${start}; queue it.`,
      })
    }
    state.tags[current] = 'settled'
  }

  recorder.emit('DONE', state, {
    variables: { order: order.join(', ') },
    description: `BFS order from ${start}: ${order.join(', ')}.`,
  })
  return recorder.steps
}

export function graphDfs(graph: ParsedGraph, start: string, options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = graphState(graph)
  const neighbours = adjacency(graph)
  const order: string[] = []
  const path: string[] = []

  const walk = (current: string): void => {
    order.push(current)
    path.push(current)
    recorder.metrics.visits += 1
    state.tags[current] = 'visited'
    recorder.emit('VISIT', state, {
      nodeIds: [current],
      variables: { current, path: path.join(' → '), order: order.join(', ') },
      description: `Visit ${current} and go as deep as possible before backing up.`,
    })

    for (const { node, edge } of neighbours.get(current) ?? []) {
      recorder.metrics.comparisons += 1
      if (state.tags[node] !== undefined) continue
      edgeAt(state, edge).state = 'used'
      walk(node)
    }

    state.tags[current] = 'settled'
    path.pop()
    recorder.emit('POP', state, {
      nodeIds: [current],
      variables: { current, path: path.join(' → '), order: order.join(', ') },
      description: `Every neighbour of ${current} is explored; back up${path.length > 0 ? ` to ${path.at(-1)}` : ''}.`,
    })
  }

  walk(start)
  recorder.emit('DONE', state, {
    variables: { order: order.join(', ') },
    description: `DFS order from ${start}: ${order.join(', ')}.`,
  })
  return recorder.steps
}

export function dijkstra(graph: ParsedGraph, start: string, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (!graph.weighted) throw new VisualizerInputError("Dijkstra needs weighted edges, like A-B:4.")
  if (graph.edges.some((edge) => (edge.weight ?? 0) < 0)) {
    throw new VisualizerInputError('Dijkstra needs non-negative weights.')
  }
  const recorder = new Recorder(options)
  const state = graphState(graph)
  const neighbours = adjacency(graph)
  const distance = new Map(graph.nodes.map((node) => [node, Number.POSITIVE_INFINITY]))
  const via = new Map<string, number>()
  distance.set(start, 0)
  for (const node of graph.nodes) state.labels[node] = node === start ? '0' : '∞'

  recorder.emit('MARK', state, {
    nodeIds: [start],
    variables: { start },
    description: `Every distance starts at ∞ except ${start}, which is 0.`,
  })

  for (;;) {
    let current: string | null = null
    for (const node of graph.nodes) {
      if (state.tags[node] === 'settled') continue
      const known = distance.get(node) ?? Number.POSITIVE_INFINITY
      if (known === Number.POSITIVE_INFINITY) continue
      if (current === null || known < (distance.get(current) ?? Number.POSITIVE_INFINITY)) current = node
    }
    if (current === null) break

    const base = distance.get(current) ?? 0
    state.tags[current] = 'settled'
    recorder.metrics.visits += 1
    recorder.emit('VISIT', state, {
      nodeIds: [current],
      variables: { current, distance: base },
      description: `${current} has the smallest unsettled distance, ${base}. It is now final.`,
    })

    for (const { node, edge, weight } of neighbours.get(current) ?? []) {
      if (state.tags[node] === 'settled') continue
      recorder.metrics.comparisons += 1
      const candidate = base + weight
      const known = distance.get(node) ?? Number.POSITIVE_INFINITY
      edgeAt(state, edge).state = 'active'
      recorder.emit('COMPARE', state, {
        nodeIds: [current, node],
        values: [candidate],
        variables: { current, neighbour: node, candidate, known: Number.isFinite(known) ? known : '∞' },
        description: `Through ${current}, ${node} is ${base} + ${weight} = ${candidate}. Known best: ${Number.isFinite(known) ? known : '∞'}.`,
      })

      if (candidate < known) {
        const previous = via.get(node)
        if (previous !== undefined) edgeAt(state, previous).state = 'rejected'
        via.set(node, edge)
        distance.set(node, candidate)
        state.labels[node] = String(candidate)
        state.tags[node] = 'queued'
        edgeAt(state, edge).state = 'used'
        recorder.emit('UPDATE', state, {
          nodeIds: [node],
          values: [candidate],
          variables: { current, neighbour: node, candidate },
          description: `Shorter — ${node} improves to ${candidate}.`,
        })
      } else {
        edgeAt(state, edge).state = 'idle'
      }
    }
  }

  const summary = graph.nodes
    .map((node) => `${node}=${Number.isFinite(distance.get(node)) ? String(distance.get(node)) : '∞'}`)
    .join(', ')
  recorder.emit('DONE', state, {
    variables: { distances: summary },
    description: `Shortest distances from ${start}: ${summary}.`,
  })
  return recorder.steps
}

/** Kahn's algorithm: repeatedly take a node nothing still points at. */
export function topologicalSort(graph: ParsedGraph, options: AlgorithmOptions = {}): AlgorithmStep[] {
  if (!graph.directed) throw new VisualizerInputError('Topological sort needs directed edges, like A>B.')
  const recorder = new Recorder(options)
  const state = graphState(graph)
  const neighbours = adjacency(graph)
  const inDegree = new Map(graph.nodes.map((node) => [node, 0]))
  for (const edge of graph.edges) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  for (const node of graph.nodes) state.labels[node] = `in=${inDegree.get(node) ?? 0}`

  const queue = graph.nodes.filter((node) => inDegree.get(node) === 0)
  const order: string[] = []
  for (const node of queue) state.tags[node] = 'queued'
  recorder.emit('PUSH', state, {
    nodeIds: [...queue],
    variables: { queue: queue.join(', '), order: '' },
    description:
      queue.length === 0
        ? 'Count incoming edges. Every node has at least one, so nothing can go first.'
        : `Count incoming edges. ${queue.join(', ')} ha${queue.length === 1 ? 's' : 've'} none, so ${queue.length === 1 ? 'it' : 'they'} can go first.`,
  })

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    order.push(current)
    recorder.metrics.visits += 1
    state.tags[current] = 'settled'
    recorder.emit('POP', state, {
      nodeIds: [current],
      variables: { current, queue: queue.join(', '), order: order.join(', ') },
      description: `Place ${current} next in the order.`,
    })

    for (const { node, edge } of neighbours.get(current) ?? []) {
      const remaining = (inDegree.get(node) ?? 0) - 1
      inDegree.set(node, remaining)
      state.labels[node] = `in=${remaining}`
      edgeAt(state, edge).state = 'used'
      if (remaining === 0) {
        queue.push(node)
        state.tags[node] = 'queued'
      }
      recorder.emit('UPDATE', state, {
        nodeIds: [node],
        variables: { current, queue: queue.join(', '), order: order.join(', ') },
        description:
          remaining === 0
            ? `Remove ${current}→${node}. ${node} has no incoming edges left; queue it.`
            : `Remove ${current}→${node}. ${node} still waits on ${remaining} edge${remaining === 1 ? '' : 's'}.`,
      })
    }
  }

  const cyclic = order.length < graph.nodes.length
  recorder.emit('DONE', state, {
    variables: { order: order.join(', '), hasCycle: cyclic },
    description: cyclic
      ? `Stuck after ${order.join(', ') || 'nothing'}: the rest form a cycle, so no topological order exists.`
      : `Topological order: ${order.join(', ')}.`,
  })
  return recorder.steps
}

/** Disjoint-set union with path compression, processing edges in input order. */
export function unionFind(graph: ParsedGraph, options: AlgorithmOptions = {}): AlgorithmStep[] {
  const recorder = new Recorder(options)
  const state = graphState(graph)
  const parent = new Map(graph.nodes.map((node) => [node, node]))
  const size = new Map(graph.nodes.map((node) => [node, 1]))
  const label = (): void => {
    for (const node of graph.nodes) {
      const up = parent.get(node) ?? node
      state.labels[node] = up === node ? 'root' : `↑${up}`
    }
  }
  const find = (node: string): string => {
    let root = node
    while ((parent.get(root) ?? root) !== root) {
      recorder.metrics.visits += 1
      root = parent.get(root) ?? root
    }
    let walker = node
    while (walker !== root) {
      const up = parent.get(walker) ?? root
      parent.set(walker, root)
      walker = up
    }
    return root
  }
  const components = (): number => graph.nodes.filter((node) => parent.get(node) === node).length

  label()
  recorder.emit('MARK', state, {
    variables: { components: components() },
    description: 'Every node starts as its own set, and its own root.',
  })

  graph.edges.forEach((edge, index) => {
    edgeAt(state, index).state = 'active'
    const left = find(edge.from)
    const right = find(edge.to)
    recorder.metrics.comparisons += 1
    label()
    recorder.emit('COMPARE', state, {
      nodeIds: [edge.from, edge.to],
      variables: { edge: `${edge.from}-${edge.to}`, [`find(${edge.from})`]: left, [`find(${edge.to})`]: right },
      description: `Find the roots: ${edge.from} belongs to ${left}, ${edge.to} belongs to ${right}.`,
    })

    if (left === right) {
      edgeAt(state, index).state = 'rejected'
      recorder.emit('MARK', state, {
        nodeIds: [edge.from, edge.to],
        variables: { edge: `${edge.from}-${edge.to}`, components: components() },
        description: `Same root — they are already connected, so this edge would close a cycle.`,
      })
      return
    }

    const [small, large] = (size.get(left) ?? 1) <= (size.get(right) ?? 1) ? [left, right] : [right, left]
    parent.set(small, large)
    size.set(large, (size.get(large) ?? 1) + (size.get(small) ?? 1))
    edgeAt(state, index).state = 'used'
    label()
    recorder.emit('UPDATE', state, {
      nodeIds: [small, large],
      variables: { edge: `${edge.from}-${edge.to}`, components: components() },
      description: `Union: attach the smaller set's root ${small} under ${large}.`,
    })
  })

  recorder.emit('DONE', state, {
    variables: { components: components() },
    description: `${components()} connected component${components() === 1 ? '' : 's'} remain.`,
  })
  return recorder.steps
}
