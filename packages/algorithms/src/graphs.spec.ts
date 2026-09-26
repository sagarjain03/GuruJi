import { describe, expect, it } from 'vitest'
import { dijkstra, graphBfs, graphDfs, topologicalSort, unionFind } from './graphs'
import { parseGraph } from './input'
import type { AlgorithmStep, GraphSnapshot } from './model'

const types = (steps: AlgorithmStep[]) => steps.map((step) => step.type)
const finalGraph = (steps: AlgorithmStep[]) => steps.at(-1)?.state as GraphSnapshot

describe('graph input', () => {
  it('reads undirected, directed and weighted edges', () => {
    expect(parseGraph('A-B, B-C')).toMatchObject({ directed: false, weighted: false, nodes: ['A', 'B', 'C'] })
    expect(parseGraph('A>B:3')).toMatchObject({ directed: true, weighted: true, edges: [{ from: 'A', to: 'B', weight: 3 }] })
  })

  it('refuses mixed or malformed edges with a message naming the problem', () => {
    expect(() => parseGraph('A-B, B>C')).toThrow('not both')
    expect(() => parseGraph('A-B:1, B-C')).toThrow('Either every edge has a weight or none do.')
    expect(() => parseGraph('A--B')).toThrow('"A--B" is not an edge.')
  })

  it('refuses graphs over the node cap', () => {
    const edges = Array.from({ length: 31 }, (_, index) => `N${index}-M${index}`).slice(0, 16).join(', ')
    expect(() => parseGraph(edges)).toThrow('Graphs are limited to 30 nodes; got 32.')
  })
})

describe('graph event streams', () => {
  const diamond = parseGraph('A-B, A-C, B-D')

  it('BFS queues every unseen neighbour and labels its distance', () => {
    const steps = graphBfs(diamond, 'A')

    expect(types(steps)).toEqual(['PUSH', 'POP', 'PUSH', 'PUSH', 'POP', 'PUSH', 'POP', 'POP', 'DONE'])
    expect(steps.at(-1)?.variables).toEqual({ order: 'A, B, C, D' })
    expect(finalGraph(steps).labels).toEqual({ A: 'd=0', B: 'd=1', C: 'd=1', D: 'd=2' })
  })

  it('DFS goes deep before wide and reports each backtrack', () => {
    const steps = graphDfs(diamond, 'A')

    expect(types(steps)).toEqual(['VISIT', 'VISIT', 'VISIT', 'POP', 'POP', 'VISIT', 'POP', 'POP', 'DONE'])
    expect(steps.at(-1)?.variables).toEqual({ order: 'A, B, D, C' })
    expect(steps[2]?.variables).toMatchObject({ path: 'A → B → D' })
  })

  it('Dijkstra settles the closest node and relaxes its edges', () => {
    const steps = dijkstra(parseGraph('A-B:4, A-C:1, C-B:2'), 'A')

    expect(types(steps)).toEqual([
      'MARK',
      'VISIT', 'COMPARE', 'UPDATE', 'COMPARE', 'UPDATE',
      'VISIT', 'COMPARE', 'UPDATE',
      'VISIT',
      'DONE',
    ])
    expect(steps.at(-1)?.variables).toEqual({ distances: 'A=0, B=3, C=1' })
    // The direct A-B edge was the best path once, then lost to A-C-B.
    expect(finalGraph(steps).edges.map((edge) => edge.state)).toEqual(['rejected', 'used', 'used'])
  })

  it('Dijkstra refuses unweighted or negative graphs', () => {
    expect(() => dijkstra(parseGraph('A-B'), 'A')).toThrow('weighted edges')
    expect(() => dijkstra(parseGraph('A-B:-1'), 'A')).toThrow('non-negative')
  })

  it("topological sort follows Kahn's in-degree countdown", () => {
    const steps = topologicalSort(parseGraph('A>B, A>C, B>D, C>D'))

    expect(types(steps)).toEqual(['PUSH', 'POP', 'UPDATE', 'UPDATE', 'POP', 'UPDATE', 'POP', 'UPDATE', 'POP', 'DONE'])
    expect(steps.at(-1)?.variables).toEqual({ order: 'A, B, C, D', hasCycle: false })
    expect(steps[5]?.state).toMatchObject({ labels: { D: 'in=1' } })
  })

  it('topological sort reports a cycle instead of a partial order', () => {
    const steps = topologicalSort(parseGraph('A>B, B>A'))

    expect(types(steps)).toEqual(['PUSH', 'DONE'])
    expect(steps.at(-1)?.variables).toEqual({ order: '', hasCycle: true })
  })

  it('topological sort refuses undirected edges', () => {
    expect(() => topologicalSort(diamond)).toThrow('directed edges')
  })

  it('union-find joins sets and rejects the edge that would close a cycle', () => {
    const steps = unionFind(parseGraph('A-B, B-C, A-C'))

    expect(types(steps)).toEqual(['MARK', 'COMPARE', 'UPDATE', 'COMPARE', 'UPDATE', 'COMPARE', 'MARK', 'DONE'])
    expect(finalGraph(steps).edges.map((edge) => edge.state)).toEqual(['used', 'used', 'rejected'])
    expect(steps.at(-1)?.variables).toEqual({ components: 1 })
  })
})
