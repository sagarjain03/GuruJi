import { binarySearch, bubbleSort, heapSort, insertionSort, linearSearch, mergeSort, quickSort, selectionSort } from './arrays'
import { coinChange, fibonacci, knapsack, longestCommonSubsequence } from './dp'
import { dijkstra, graphBfs, graphDfs, topologicalSort, unionFind } from './graphs'
import {
  LIMITS,
  parseGraph,
  parseInteger,
  parseLevelOrder,
  parseNumbers,
  requireNode,
  sections,
} from './input'
import { detectCycle, listDelete, listInsert, listReverse } from './linked-list'
import { VisualizerInputError, type AlgorithmDefinition } from './model'
import { levelOrder, traverse, treeBfs, treeDfs } from './trees'

const ARRAY_HINT = `Comma-separated whole numbers, up to ${LIMITS.array}.`
const TREE_HINT = `Level order, "null" for a missing child, up to ${LIMITS.treeNodes} nodes.`

function sortingEntry(
  id: string,
  name: string,
  complexity: string,
  summary: string,
  sort: (input: number[], options?: { maxSteps?: number }) => ReturnType<typeof bubbleSort>,
): AlgorithmDefinition {
  return {
    id,
    name,
    category: 'SORTING',
    structure: 'array',
    complexity,
    summary,
    inputHint: ARRAY_HINT,
    defaultInput: '8, 3, 6, 1, 5, 2, 7, 4',
    run: (input, options) => sort(parseNumbers(input, 'The array', LIMITS.array), options),
  }
}

function treeTraversal(id: string, name: string, order: 'inorder' | 'preorder' | 'postorder', summary: string): AlgorithmDefinition {
  return {
    id,
    name,
    category: 'TREE',
    structure: 'tree',
    complexity: 'O(n)',
    summary,
    inputHint: TREE_HINT,
    defaultInput: '8, 4, 12, 2, 6, 10, 14',
    run: (input, options) => traverse(order, parseLevelOrder(input), options),
  }
}

function treeSearch(id: string, name: string, kind: 'BFS' | 'DFS', summary: string): AlgorithmDefinition {
  const search = kind === 'BFS' ? treeBfs : treeDfs
  return {
    id,
    name,
    category: 'TREE',
    structure: 'tree',
    complexity: 'O(n)',
    summary,
    inputHint: `${TREE_HINT} Then | target.`,
    defaultInput: '8, 4, 12, 2, 6, 10, 14 | 10',
    run: (input, options) => {
      const [tree = '', target = ''] = sections(input, 2, '8, 4, 12 | 12')
      return search(parseLevelOrder(tree), parseInteger(target, 'The target'), options)
    },
  }
}

/**
 * Every algorithm the visualiser knows. The UI reads nothing but this list:
 * adding an entry here is the whole of adding an algorithm.
 */
export const algorithmRegistry: readonly AlgorithmDefinition[] = [
  sortingEntry('bubble-sort', 'Bubble Sort', 'O(n²)', 'Repeatedly swap neighbours that are out of order; the largest bubbles to the end each pass.', bubbleSort),
  sortingEntry('selection-sort', 'Selection Sort', 'O(n²)', 'Find the smallest remaining value and put it next.', selectionSort),
  sortingEntry('insertion-sort', 'Insertion Sort', 'O(n²)', 'Grow a sorted prefix by sliding each new value left into place.', insertionSort),
  sortingEntry('merge-sort', 'Merge Sort', 'O(n log n)', 'Split in half, sort each half, merge the two sorted halves.', mergeSort),
  sortingEntry('quick-sort', 'Quick Sort', 'O(n log n) avg', 'Partition around a pivot, then sort each side.', quickSort),
  sortingEntry('heap-sort', 'Heap Sort', 'O(n log n)', 'Build a max-heap, then repeatedly move the maximum to the end.', heapSort),
  {
    id: 'linear-search',
    name: 'Linear Search',
    category: 'SEARCHING',
    structure: 'array',
    complexity: 'O(n)',
    summary: 'Check every position in order until the target turns up.',
    inputHint: `${ARRAY_HINT} Then | target.`,
    defaultInput: '4, 9, 2, 7, 5, 1 | 7',
    run: (input, options) => {
      const [values = '', target = ''] = sections(input, 2, '4, 9, 2 | 9')
      return linearSearch(parseNumbers(values, 'The array', LIMITS.array), parseInteger(target, 'The target'), options)
    },
  },
  {
    id: 'binary-search',
    name: 'Binary Search',
    category: 'SEARCHING',
    structure: 'array',
    complexity: 'O(log n)',
    summary: 'Halve a sorted range each step by comparing against the middle.',
    inputHint: `Sorted, comma-separated whole numbers, up to ${LIMITS.array}. Then | target.`,
    defaultInput: '1, 3, 4, 6, 8, 11, 13, 17, 20 | 13',
    run: (input, options) => {
      const [values = '', target = ''] = sections(input, 2, '1, 3, 5 | 5')
      return binarySearch(parseNumbers(values, 'The array', LIMITS.array), parseInteger(target, 'The target'), options)
    },
  },
  {
    id: 'list-insert',
    name: 'Linked List Insert',
    category: 'LINKED_LIST',
    structure: 'list',
    complexity: 'O(n)',
    summary: 'Walk to the node before the position, then relink two pointers.',
    inputHint: `List values | value, position (0 = new head). Up to ${LIMITS.list} nodes.`,
    defaultInput: '3, 7, 1, 9 | 5, 2',
    run: (input, options) => {
      const [values = '', insert = ''] = sections(input, 2, '3, 7, 1 | 5, 2')
      const [value, position] = parseNumbers(insert, 'The value and position', 2, 2)
      return listInsert(parseNumbers(values, 'The list', LIMITS.list), value ?? 0, position ?? 0, options)
    },
  },
  {
    id: 'list-delete',
    name: 'Linked List Delete',
    category: 'LINKED_LIST',
    structure: 'list',
    complexity: 'O(n)',
    summary: 'Find the node, then point its predecessor past it.',
    inputHint: `List values | value to delete. Up to ${LIMITS.list} nodes.`,
    defaultInput: '3, 7, 1, 9, 4 | 1',
    run: (input, options) => {
      const [values = '', target = ''] = sections(input, 2, '3, 7, 1 | 7')
      return listDelete(parseNumbers(values, 'The list', LIMITS.list), parseInteger(target, 'The value to delete'), options)
    },
  },
  {
    id: 'list-reverse',
    name: 'Reverse Linked List',
    category: 'LINKED_LIST',
    structure: 'list',
    complexity: 'O(n)',
    summary: 'Turn every arrow around with three pointers: prev, curr, next.',
    inputHint: `Comma-separated whole numbers, up to ${LIMITS.list}.`,
    defaultInput: '1, 2, 3, 4, 5',
    run: (input, options) => listReverse(parseNumbers(input, 'The list', LIMITS.list), options),
  },
  {
    id: 'list-cycle',
    name: 'Cycle Detection',
    category: 'LINKED_LIST',
    structure: 'list',
    complexity: 'O(n)',
    summary: "Floyd's tortoise and hare: a fast pointer only meets a slow one inside a loop.",
    inputHint: `List values | index the tail links back to (-1 for no cycle).`,
    defaultInput: '1, 2, 3, 4, 5, 6 | 2',
    run: (input, options) => {
      const [values = '', cycle = ''] = sections(input, 2, '1, 2, 3 | 0')
      return detectCycle(parseNumbers(values, 'The list', LIMITS.list), parseInteger(cycle, 'The cycle position'), options)
    },
  },
  treeSearch('tree-bfs', 'Tree BFS', 'BFS', 'Search level by level with a queue.'),
  treeSearch('tree-dfs', 'Tree DFS', 'DFS', 'Search down one branch at a time with a stack.'),
  treeTraversal('tree-inorder', 'In-order Traversal', 'inorder', 'Left, node, right — a BST comes out sorted.'),
  treeTraversal('tree-preorder', 'Pre-order Traversal', 'preorder', 'Node, left, right — how you would copy a tree.'),
  treeTraversal('tree-postorder', 'Post-order Traversal', 'postorder', 'Left, right, node — how you would delete a tree.'),
  {
    id: 'tree-level-order',
    name: 'Level-order Traversal',
    category: 'TREE',
    structure: 'tree',
    complexity: 'O(n)',
    summary: 'Group nodes by depth by processing the queue one level-width at a time.',
    inputHint: TREE_HINT,
    defaultInput: '3, 9, 20, null, null, 15, 7',
    run: (input, options) => levelOrder(parseLevelOrder(input), options),
  },
  {
    id: 'graph-bfs',
    name: 'Graph BFS',
    category: 'GRAPH',
    structure: 'graph',
    complexity: 'O(V + E)',
    summary: 'Explore outward in rings; the first time you reach a node is by the fewest edges.',
    inputHint: `Edges A-B (undirected) or A>B (directed) | start node. Up to ${LIMITS.graphNodes} nodes.`,
    defaultInput: 'A-B, A-C, B-D, C-D, C-E, D-F, E-F | A',
    run: (input, options) => {
      const [edges = '', start = ''] = sections(input, 2, 'A-B, B-C | A')
      const graph = parseGraph(edges)
      return graphBfs(graph, requireNode(graph, start), options)
    },
  },
  {
    id: 'graph-dfs',
    name: 'Graph DFS',
    category: 'GRAPH',
    structure: 'graph',
    complexity: 'O(V + E)',
    summary: 'Go as deep as possible, then back up to the last branch point.',
    inputHint: `Edges A-B (undirected) or A>B (directed) | start node. Up to ${LIMITS.graphNodes} nodes.`,
    defaultInput: 'A-B, A-C, B-D, C-D, C-E, D-F, E-F | A',
    run: (input, options) => {
      const [edges = '', start = ''] = sections(input, 2, 'A-B, B-C | A')
      const graph = parseGraph(edges)
      return graphDfs(graph, requireNode(graph, start), options)
    },
  },
  {
    id: 'dijkstra',
    name: "Dijkstra's Shortest Path",
    category: 'GRAPH',
    structure: 'graph',
    complexity: 'O((V + E) log V)',
    summary: 'Settle the closest unsettled node, then relax its edges.',
    inputHint: 'Weighted edges A-B:4 (or A>B:4), non-negative | start node.',
    defaultInput: 'A-B:4, A-C:2, C-B:1, B-D:5, C-D:8, C-E:10, D-E:2 | A',
    run: (input, options) => {
      const [edges = '', start = ''] = sections(input, 2, 'A-B:4, B-C:1 | A')
      const graph = parseGraph(edges)
      return dijkstra(graph, requireNode(graph, start), options)
    },
  },
  {
    id: 'topological-sort',
    name: 'Topological Sort',
    category: 'GRAPH',
    structure: 'graph',
    complexity: 'O(V + E)',
    summary: "Kahn's algorithm: repeatedly take a node with no incoming edges.",
    inputHint: 'Directed edges A>B, meaning A must come before B.',
    defaultInput: 'A>C, B>C, B>D, C>E, D>E, E>F',
    run: (input, options) => topologicalSort(parseGraph(input), options),
  },
  {
    id: 'union-find',
    name: 'Union-Find (DSU)',
    category: 'GRAPH',
    structure: 'graph',
    complexity: 'O(E α(V))',
    summary: 'Merge sets edge by edge; an edge inside one set would close a cycle.',
    inputHint: 'Undirected edges A-B, processed left to right.',
    defaultInput: 'A-B, C-D, B-C, E-F, A-D, D-E',
    run: (input, options) => unionFind(parseGraph(input), options),
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    category: 'DP',
    structure: 'table',
    complexity: 'O(n)',
    summary: 'Fill the table left to right; each cell reads the two before it.',
    inputHint: `n, from 0 to ${LIMITS.fibonacci}.`,
    defaultInput: '10',
    run: (input, options) => fibonacci(parseInteger(input, 'n'), options),
  },
  {
    id: 'knapsack',
    name: '0/1 Knapsack',
    category: 'DP',
    structure: 'table',
    complexity: 'O(n · W)',
    summary: 'For each item and capacity, keep the better of skipping or taking it.',
    inputHint: `weights | values | capacity. Up to ${LIMITS.knapsackItems} items, capacity ${LIMITS.knapsackCapacity}.`,
    defaultInput: '1, 3, 4, 5 | 1, 4, 5, 7 | 7',
    run: (input, options) => {
      const [weights = '', values = '', capacity = ''] = sections(input, 3, '1, 3 | 1, 4 | 4')
      return knapsack(
        parseNumbers(weights, 'The weights', LIMITS.knapsackItems),
        parseNumbers(values, 'The values', LIMITS.knapsackItems),
        parseInteger(capacity, 'The capacity'),
        options,
      )
    },
  },
  {
    id: 'lcs',
    name: 'Longest Common Subsequence',
    category: 'DP',
    structure: 'table',
    complexity: 'O(n · m)',
    summary: 'A match extends the diagonal; a mismatch keeps the better neighbour.',
    inputHint: `first | second. Up to ${LIMITS.lcsLength} characters each.`,
    defaultInput: 'ABCBDAB | BDCABA',
    run: (input, options) => {
      const [first = '', second = ''] = sections(input, 2, 'ABC | AC')
      if (/\s/.test(first) || /\s/.test(second)) {
        throw new VisualizerInputError('The strings cannot contain spaces.')
      }
      return longestCommonSubsequence(first, second, options)
    },
  },
  {
    id: 'coin-change',
    name: 'Coin Change',
    category: 'DP',
    structure: 'table',
    complexity: 'O(n · amount)',
    summary: 'The fewest coins for an amount is one coin plus the fewest for what remains.',
    inputHint: `coins | amount. Up to ${LIMITS.coinTypes} coins, amount ${LIMITS.coinAmount}.`,
    defaultInput: '1, 2, 5 | 11',
    run: (input, options) => {
      const [coins = '', amount = ''] = sections(input, 2, '1, 2, 5 | 11')
      return coinChange(parseNumbers(coins, 'The coins', LIMITS.coinTypes), parseInteger(amount, 'The amount'), options)
    },
  },
]

export function findAlgorithm(id: string): AlgorithmDefinition | undefined {
  return algorithmRegistry.find((definition) => definition.id === id)
}
