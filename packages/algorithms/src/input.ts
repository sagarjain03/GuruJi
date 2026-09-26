import { VisualizerInputError } from './model'

/**
 * Parsers from the text a person types to the values an algorithm runs on.
 *
 * Every size cap lives here, in one place, so the message a person sees for
 * "too big" is always the same shape and always names the limit.
 */
export const LIMITS = {
  array: 50,
  list: 20,
  treeNodes: 31,
  graphNodes: 30,
  graphEdges: 60,
  fibonacci: 30,
  knapsackItems: 10,
  knapsackCapacity: 30,
  lcsLength: 12,
  coinTypes: 6,
  coinAmount: 50,
} as const

const VALUE_RANGE = 999

/** Splits `a | b | c` into its sections, requiring exactly `count` of them. */
export function sections(input: string, count: number, shape: string): string[] {
  const parts = input.split('|').map((part) => part.trim())
  if (parts.length !== count || parts.some((part) => part === '')) {
    throw new VisualizerInputError(`Expected input shaped like: ${shape}`)
  }
  return parts
}

export function parseInteger(text: string, name: string): number {
  const trimmed = text.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    throw new VisualizerInputError(`${name} must be a whole number, got "${trimmed}".`)
  }
  const value = Number(trimmed)
  if (Math.abs(value) > VALUE_RANGE) {
    throw new VisualizerInputError(`${name} must be between -${VALUE_RANGE} and ${VALUE_RANGE}.`)
  }
  return value
}

export function parseNumbers(text: string, name: string, max: number, min = 1): number[] {
  const tokens = text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length < min) {
    throw new VisualizerInputError(`${name} needs at least ${min} value${min === 1 ? '' : 's'}.`)
  }
  if (tokens.length > max) {
    throw new VisualizerInputError(`${name} is limited to ${max} values; got ${tokens.length}.`)
  }
  return tokens.map((token) => parseInteger(token, `Every value in ${name.toLowerCase()}`))
}

/** Level-order values with `null` for a missing child, as LeetCode writes trees. */
export function parseLevelOrder(text: string): (number | null)[] {
  const tokens = text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length === 0 || tokens[0] === 'null') {
    throw new VisualizerInputError('The tree needs a root value.')
  }
  const values = tokens.map((token) => (token === 'null' ? null : parseInteger(token, 'Every tree value')))
  const count = values.filter((value) => value !== null).length
  if (count > LIMITS.treeNodes) {
    throw new VisualizerInputError(`Trees are limited to ${LIMITS.treeNodes} nodes; got ${count}.`)
  }
  return values
}

export interface ParsedEdge {
  from: string
  to: string
  weight?: number
}

export interface ParsedGraph {
  directed: boolean
  weighted: boolean
  nodes: string[]
  edges: ParsedEdge[]
}

const EDGE = /^([A-Za-z0-9]{1,3})\s*([->])\s*([A-Za-z0-9]{1,3})(?:\s*:\s*(-?\d+))?$/

/**
 * Edges written `A-B` (undirected) or `A>B` (directed), optionally `:weight`.
 * Nodes are named by the edges they appear in, in order of first mention.
 */
export function parseGraph(text: string): ParsedGraph {
  const tokens = text
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length === 0) {
    throw new VisualizerInputError('The graph needs at least one edge, like A-B.')
  }
  if (tokens.length > LIMITS.graphEdges) {
    throw new VisualizerInputError(`Graphs are limited to ${LIMITS.graphEdges} edges; got ${tokens.length}.`)
  }

  const nodes: string[] = []
  const edges: ParsedEdge[] = []
  const arrows = new Set<string>()
  let weighted = false

  for (const token of tokens) {
    const match = EDGE.exec(token)
    if (match === null) {
      throw new VisualizerInputError(`"${token}" is not an edge. Write A-B, A>B, or A-B:4.`)
    }
    const [, from = '', arrow = '-', to = '', weight] = match
    arrows.add(arrow)
    for (const node of [from, to]) {
      if (!nodes.includes(node)) nodes.push(node)
    }
    if (weight === undefined) {
      edges.push({ from, to })
    } else {
      weighted = true
      edges.push({ from, to, weight: parseInteger(weight, 'An edge weight') })
    }
  }

  if (arrows.size > 1) {
    throw new VisualizerInputError('Use either A-B (undirected) or A>B (directed) edges, not both.')
  }
  if (weighted && edges.some((edge) => edge.weight === undefined)) {
    throw new VisualizerInputError('Either every edge has a weight or none do.')
  }
  if (nodes.length > LIMITS.graphNodes) {
    throw new VisualizerInputError(`Graphs are limited to ${LIMITS.graphNodes} nodes; got ${nodes.length}.`)
  }
  return { directed: arrows.has('>'), weighted, nodes, edges }
}

export function requireNode(graph: ParsedGraph, text: string): string {
  const node = text.trim()
  if (!graph.nodes.includes(node)) {
    throw new VisualizerInputError(`Start node "${node}" is not in the graph.`)
  }
  return node
}
