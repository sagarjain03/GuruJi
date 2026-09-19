import type { RoadmapSection } from '../../generated/client/client'

export interface TopicSeed {
  slug: string
  name: string
  description: string
  /** Slugs of topics that must come first. Resolved to ids after the upsert. */
  prerequisites: string[]
  section: RoadmapSection
  /** Parent node in the roadmap tree, by topic slug. Null = a section root. */
  parent: string | null
  estimatedHours: number
}

/**
 * The curriculum. Fourteen topics, ordered.
 *
 * `displayOrder` is the array index, so re-ordering the curriculum is a matter
 * of moving a block in this file — which is the point of storing the roadmap in
 * the database rather than in a component.
 */
export const TOPICS: TopicSeed[] = [
  {
    slug: 'complexity-analysis',
    name: 'Complexity Analysis',
    description:
      'Counting the work an algorithm does, in time and in memory, without running it. The vocabulary every later topic is discussed in.',
    prerequisites: [],
    section: 'FOUNDATION',
    parent: null,
    estimatedHours: 4,
  },
  {
    slug: 'arrays',
    name: 'Arrays',
    description:
      'Contiguous, indexable storage. Scanning, two-pointer sweeps, prefix sums, and the in-place tricks that keep memory flat.',
    prerequisites: ['complexity-analysis'],
    section: 'FOUNDATION',
    parent: 'complexity-analysis',
    estimatedHours: 10,
  },
  {
    slug: 'strings',
    name: 'Strings',
    description:
      'Arrays with an alphabet. Parsing, windows over characters, and the immutability traps that turn a linear loop into a quadratic one.',
    prerequisites: ['arrays'],
    section: 'FOUNDATION',
    parent: 'arrays',
    estimatedHours: 8,
  },
  {
    slug: 'sorting',
    name: 'Sorting',
    description:
      'Comparison sorts and their costs, stability, and — more useful in practice — recognising when sorting first makes a hard problem easy.',
    prerequisites: ['arrays'],
    section: 'FOUNDATION',
    parent: 'arrays',
    estimatedHours: 8,
  },
  {
    slug: 'searching',
    name: 'Searching',
    description:
      'Binary search, and the harder skill: searching over an answer space instead of over an array.',
    prerequisites: ['sorting'],
    section: 'FOUNDATION',
    parent: 'sorting',
    estimatedHours: 6,
  },
  {
    slug: 'recursion-and-backtracking',
    name: 'Recursion & Backtracking',
    description:
      'Solving a problem in terms of a smaller version of itself, and searching a space by undoing choices rather than copying state.',
    prerequisites: ['arrays'],
    section: 'FOUNDATION',
    parent: 'arrays',
    estimatedHours: 10,
  },
  {
    slug: 'hashing',
    name: 'Hashing',
    description:
      'Trading memory for lookup time. Hash maps and sets, collision behaviour, and why average constant time is not a promise.',
    prerequisites: ['arrays'],
    section: 'DATA_STRUCTURES',
    parent: null,
    estimatedHours: 6,
  },
  {
    slug: 'stacks-and-queues',
    name: 'Stacks & Queues',
    description:
      'Order of service as a data structure. Bracket matching, monotonic stacks, and queues as the backbone of breadth-first search.',
    prerequisites: ['arrays'],
    section: 'DATA_STRUCTURES',
    parent: null,
    estimatedHours: 8,
  },
  {
    slug: 'linked-lists',
    name: 'Linked Lists',
    description:
      'Pointer-chained nodes. Reversal, cycle detection, and the pointer discipline that trees and graphs then assume you have.',
    prerequisites: ['arrays'],
    section: 'DATA_STRUCTURES',
    parent: null,
    estimatedHours: 8,
  },
  {
    slug: 'heaps',
    name: 'Heaps & Priority Queues',
    description:
      'Keeping the extreme element cheap to reach. Top-k selection, streaming medians, and the scheduling problems built on them.',
    prerequisites: ['sorting'],
    section: 'DATA_STRUCTURES',
    parent: null,
    estimatedHours: 6,
  },
  {
    slug: 'binary-trees',
    name: 'Binary Trees',
    description:
      'Hierarchies traversed by recursion. Depth-first orders, level-order traversal, and reading a problem as a question about subtrees.',
    prerequisites: ['recursion-and-backtracking', 'linked-lists'],
    section: 'TREES',
    parent: null,
    estimatedHours: 12,
  },
  {
    slug: 'binary-search-trees',
    name: 'Binary Search Trees',
    description:
      'A tree that carries an ordering invariant, what that buys you, and what happens to the guarantee when the tree goes unbalanced.',
    prerequisites: ['binary-trees', 'searching'],
    section: 'TREES',
    parent: 'binary-trees',
    estimatedHours: 8,
  },
  {
    slug: 'graphs',
    name: 'Graphs',
    description:
      'Nodes and edges — the general case every earlier structure was a special case of. Traversal, shortest paths, and topological order.',
    prerequisites: ['binary-trees', 'stacks-and-queues', 'hashing'],
    section: 'GRAPHS',
    parent: null,
    estimatedHours: 16,
  },
  {
    slug: 'dynamic-programming',
    name: 'Dynamic Programming',
    description:
      'Recursion with the repeated work removed. Finding the state, proving the recurrence, and moving from memoisation to a table.',
    prerequisites: ['recursion-and-backtracking', 'hashing'],
    section: 'ADVANCED',
    parent: null,
    estimatedHours: 20,
  },
]

export interface PatternSeed {
  slug: string
  name: string
  description: string
}

/**
 * Techniques, not subjects. A problem is tagged with both, because being weak at
 * Graphs and being weak at breadth-first search are different diagnoses.
 */
export const PATTERNS: PatternSeed[] = [
  {
    slug: 'two-pointers',
    name: 'Two Pointers',
    description:
      'Two indices moving under a rule that never lets either go backwards, turning a nested scan into a single pass.',
  },
  {
    slug: 'sliding-window',
    name: 'Sliding Window',
    description:
      'A contiguous range that grows at one end and shrinks at the other, maintaining a property as it moves.',
  },
  {
    slug: 'prefix-sum',
    name: 'Prefix Sum',
    description: 'Precomputing cumulative totals so any range query becomes one subtraction.',
  },
  {
    slug: 'binary-search-on-answer',
    name: 'Binary Search on Answer',
    description:
      'Searching the space of possible answers rather than the input, using a monotone feasibility check.',
  },
  {
    slug: 'hash-map-lookup',
    name: 'Hash Map Lookup',
    description:
      'Remembering what has already been seen so the second pass becomes a constant-time question.',
  },
  {
    slug: 'fast-and-slow-pointers',
    name: 'Fast & Slow Pointers',
    description:
      'Two traversals at different speeds — the standard way to find a cycle or a midpoint without extra memory.',
  },
  {
    slug: 'monotonic-stack',
    name: 'Monotonic Stack',
    description:
      'A stack kept sorted by construction, answering next-greater and previous-smaller questions in one pass.',
  },
  {
    slug: 'top-k-heap',
    name: 'Top-K with a Heap',
    description:
      'Keeping a bounded heap so the k best elements are known without sorting everything.',
  },
  {
    slug: 'tree-dfs',
    name: 'Tree Depth-First Search',
    description: 'Recursion down a hierarchy, combining answers from subtrees on the way back up.',
  },
  {
    slug: 'tree-bfs',
    name: 'Tree Breadth-First Search',
    description: 'Level-by-level traversal with a queue, for anything phrased in terms of depth.',
  },
  {
    slug: 'graph-traversal',
    name: 'Graph Traversal',
    description:
      'Visiting reachable nodes exactly once, with the visited set doing the work the tree structure used to do for free.',
  },
  {
    slug: 'memoisation-and-tabulation',
    name: 'Memoisation & Tabulation',
    description:
      'Caching a recurrence top-down, then rewriting it bottom-up once the state and the order are clear.',
  },
]
