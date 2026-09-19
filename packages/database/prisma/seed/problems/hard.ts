import { starter, type ProblemSeed } from './problem-seed'

export const HARD_PROBLEMS: ProblemSeed[] = [
  {
    slug: 'minimum-belt-capacity',
    title: 'Minimum Belt Capacity',
    difficulty: 'HARD',
    statement: `A packing belt runs once per shift. Parcels must be loaded **in the order they arrive** — you may not reorder or skip any — and the total weight loaded in one shift cannot exceed the belt capacity.

Given \`n\` parcel weights and a budget of \`d\` shifts, print the smallest capacity that gets every parcel shipped within \`d\` shifts.

Read \`n\` and \`d\`, then the \`n\` weights.`,
    constraints: `- \`1 <= d <= n <= 200000\`
- \`1 <= weight <= 500\`
- A shift may be left empty, though an optimal answer never needs one.`,
    examples: [
      {
        input: '10 5\n1 2 3 4 5 6 7 8 9 10',
        output: '15',
        explanation:
          'With capacity 15 the shifts are (1..5), (6,7), (8,9), (10) — four shifts, inside the budget. Capacity 14 needs six.',
      },
      {
        input: '5 3\n3 2 2 4 1',
        output: '5',
        explanation: 'Capacity 5 gives (3,2), (2), (4,1) — three shifts. Capacity 4 needs four.',
      },
    ],
    starterCode: starter('binary search the capacity, checking each candidate by simulation'),
    timeLimitMs: 3000,
    memoryLimitMb: 256,
    estimatedMinutes: 50,
    topics: [
      { slug: 'searching', relevance: 'PRIMARY' },
      { slug: 'arrays', relevance: 'SECONDARY' },
    ],
    patterns: [{ slug: 'binary-search-on-answer', relevance: 'PRIMARY' }],
    hints: [
      'You cannot build the answer directly, but given a capacity you can check it in one pass. Start there: write the checker first.',
      'If a capacity works, does every larger capacity also work? That yes/no answer is monotone in the capacity — which is exactly what binary search needs.',
      'Search the range from `max(weight)` to `sum(weights)`. For a candidate, greedily fill each shift until the next parcel would overflow, count the shifts, and keep the smallest capacity whose count is at most `d`.',
    ],
    testCases: [
      { input: '10 5\n1 2 3 4 5 6 7 8 9 10\n', expectedOutput: '15\n', isSample: true },
      { input: '5 3\n3 2 2 4 1\n', expectedOutput: '5\n', isSample: true },
      { input: '3 3\n1 2 3\n', expectedOutput: '3\n', isSample: false },
      { input: '1 1\n7\n', expectedOutput: '7\n', isSample: false },
      { input: '4 1\n1 2 3 4\n', expectedOutput: '10\n', isSample: false },
      { input: '5 5\n5 4 3 2 1\n', expectedOutput: '5\n', isSample: false },
      { input: '6 3\n10 10 10 10 10 10\n', expectedOutput: '20\n', isSample: false },
      { input: '8 4\n1 1 1 1 1 1 1 1\n', expectedOutput: '2\n', isSample: false },
    ],
  },

  {
    slug: 'grid-routes-with-blockages',
    title: 'Grid Routes with Blockages',
    difficulty: 'HARD',
    statement: `A warehouse floor is an \`r\` by \`c\` grid. A robot starts at the top-left cell and must reach the bottom-right cell, moving only **right** or **down** one cell at a time. Cells marked \`#\` are blocked; cells marked \`.\` are free.

Print the number of distinct routes, **modulo 1000000007**. If the start or the destination is blocked, the answer is \`0\`.

Read \`r\` and \`c\`, then \`r\` lines of \`c\` characters.`,
    constraints: `- \`1 <= r, c <= 1000\`
- Each cell is \`.\` or \`#\`.
- The answer is reported modulo 1000000007.`,
    examples: [
      {
        input: '3 3\n...\n.#.\n...',
        output: '2',
        explanation:
          'The blocked centre leaves one route along the top edge and one along the left.',
      },
      {
        input: '2 2\n..\n..',
        output: '2',
        explanation: 'Right-then-down, or down-then-right.',
      },
    ],
    starterCode: starter('fill a table of route counts, one row at a time'),
    timeLimitMs: 3000,
    memoryLimitMb: 256,
    estimatedMinutes: 45,
    topics: [{ slug: 'dynamic-programming', relevance: 'PRIMARY' }],
    patterns: [{ slug: 'memoisation-and-tabulation', relevance: 'PRIMARY' }],
    hints: [
      'A million cells rules out listing routes. Ask instead how many routes reach one particular cell.',
      'The robot can only arrive at a free cell from directly above or directly to the left, so the count for a cell is the sum of those two — and zero for a blocked cell.',
      'Fill the table row by row with `dp[i][j] = dp[i-1][j] + dp[i][j-1]`, taking the modulus at every addition and forcing blocked cells to 0. The first row and column are only reachable while no blockage has been passed.',
    ],
    testCases: [
      { input: '3 3\n...\n.#.\n...\n', expectedOutput: '2\n', isSample: true },
      { input: '2 2\n..\n..\n', expectedOutput: '2\n', isSample: true },
      { input: '1 1\n.\n', expectedOutput: '1\n', isSample: false },
      { input: '1 1\n#\n', expectedOutput: '0\n', isSample: false },
      { input: '3 3\n...\n...\n...\n', expectedOutput: '6\n', isSample: false },
      { input: '2 3\n.#.\n...\n', expectedOutput: '1\n', isSample: false },
      { input: '4 4\n....\n.#..\n..#.\n....\n', expectedOutput: '4\n', isSample: false },
      { input: '3 3\n..#\n...\n#..\n', expectedOutput: '4\n', isSample: false },
    ],
  },
]
