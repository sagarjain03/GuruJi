import { starter, type ProblemSeed } from './problem-seed'

export const MEDIUM_PROBLEMS: ProblemSeed[] = [
  {
    slug: 'longest-distinct-window',
    title: 'Longest Distinct Window',
    difficulty: 'MEDIUM',
    statement: `A device streams a line of characters. A maintenance window is any **contiguous** stretch of that stream in which no character repeats.

Read \`n\`, the length of the stream, then the stream itself. Print the length of the longest window with no repeated character.`,
    constraints: `- \`1 <= n <= 200000\`
- The stream contains lowercase English letters only.`,
    examples: [
      {
        input: '8\nabcabcbb',
        output: '3',
        explanation: 'The window `abc` has no repeat; every window of length 4 does.',
      },
      { input: '4\nbbbb', output: '1', explanation: 'Any two characters already repeat.' },
    ],
    starterCode: starter('grow a window to the right and shrink it from the left on a repeat'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 30,
    topics: [
      { slug: 'strings', relevance: 'PRIMARY' },
      { slug: 'hashing', relevance: 'SECONDARY' },
    ],
    patterns: [
      { slug: 'sliding-window', relevance: 'PRIMARY' },
      { slug: 'hash-map-lookup', relevance: 'SECONDARY' },
    ],
    hints: [
      'Checking every window is quadratic at best. Notice that when a window is valid, every window inside it is valid too — that is the property worth exploiting.',
      'Keep a window `[left, right]`. Extend `right` one character at a time. What must happen to `left` when the new character is already inside the window?',
      'Store the last position of each character. On a repeat, move `left` to one past that stored position — never backwards — and take the maximum width as you go.',
    ],
    testCases: [
      { input: '8\nabcabcbb\n', expectedOutput: '3\n', isSample: true },
      { input: '4\nbbbb\n', expectedOutput: '1\n', isSample: true },
      { input: '8\npwwkeqwe\n', expectedOutput: '4\n', isSample: false },
      { input: '1\nz\n', expectedOutput: '1\n', isSample: false },
      { input: '6\nabcdef\n', expectedOutput: '6\n', isSample: false },
      { input: '10\nabbacdeffe\n', expectedOutput: '6\n', isSample: false },
      { input: '5\naabaa\n', expectedOutput: '2\n', isSample: false },
      { input: '12\nabcdeafghijk\n', expectedOutput: '11\n', isSample: false },
    ],
  },

  {
    slug: 'peak-energy-window',
    title: 'Peak Energy Window',
    difficulty: 'MEDIUM',
    statement: `A meter records the net energy change each minute — positive when the system gains energy, negative when it loses energy.

Read \`n\` followed by \`n\` readings, and print the largest total over any **non-empty contiguous** stretch of minutes.

The answer can be negative: if every reading is a loss, the best you can do is the single smallest loss.`,
    constraints: `- \`1 <= n <= 200000\`
- \`-10^9 <= reading <= 10^9\`
- The answer fits in a signed 64-bit integer.`,
    examples: [
      {
        input: '9\n-2 1 -3 4 -1 2 1 -5 4',
        output: '6',
        explanation: 'The stretch `4 -1 2 1` totals 6.',
      },
      {
        input: '1\n-7',
        output: '-7',
        explanation: 'The stretch must be non-empty, so the only answer is -7.',
      },
    ],
    starterCode: starter('scan once, tracking the best total ending here and the best overall'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 30,
    topics: [{ slug: 'arrays', relevance: 'PRIMARY' }],
    patterns: [{ slug: 'prefix-sum', relevance: 'PRIMARY' }],
    hints: [
      'Ask a narrower question first: what is the best stretch that *ends* at minute `i`? If you can answer that for every `i`, the overall answer is the largest of those.',
      'The best stretch ending at `i` either extends the best stretch ending at `i-1`, or starts fresh at `i`. Nothing else is possible.',
      'Carry `best_here = max(reading, best_here + reading)` and `best = max(best, best_here)`. Initialise both from the first reading, not from zero — zero would be wrong for an all-negative input.',
    ],
    testCases: [
      { input: '9\n-2 1 -3 4 -1 2 1 -5 4\n', expectedOutput: '6\n', isSample: true },
      { input: '1\n-7\n', expectedOutput: '-7\n', isSample: true },
      { input: '5\n-1 -2 -3 -4 -5\n', expectedOutput: '-1\n', isSample: false },
      { input: '4\n1 2 3 4\n', expectedOutput: '10\n', isSample: false },
      { input: '6\n5 -9 6 -2 3 -1\n', expectedOutput: '7\n', isSample: false },
      { input: '3\n0 0 0\n', expectedOutput: '0\n', isSample: false },
      { input: '7\n8 -19 5 -4 20 -3 10\n', expectedOutput: '28\n', isSample: false },
      { input: '5\n-2 -1 4 -1 -2\n', expectedOutput: '4\n', isSample: false },
    ],
  },

  {
    slug: 'merge-maintenance-windows',
    title: 'Merge Maintenance Windows',
    difficulty: 'MEDIUM',
    statement: `Operations teams each book a maintenance window as a closed interval \`[start, end]\`. Two windows that overlap — or merely touch at an endpoint — are really one outage and must be reported as one.

Read \`n\`, then \`n\` lines each holding \`start\` and \`end\`. Print the number of merged windows on the first line, then the merged windows themselves in increasing order of start, one per line as \`start end\`.`,
    constraints: `- \`1 <= n <= 200000\`
- \`-10^9 <= start <= end <= 10^9\`
- Windows arrive in no particular order.`,
    examples: [
      {
        input: '4\n1 3\n2 6\n8 10\n15 18',
        output: '3\n1 6\n8 10\n15 18',
        explanation: '`[1,3]` and `[2,6]` overlap and become `[1,6]`. The others stand alone.',
      },
      {
        input: '2\n1 4\n4 5',
        output: '1\n1 5',
        explanation: 'Touching at 4 still counts as one continuous outage.',
      },
    ],
    starterCode: starter('sort by start, then extend or emit the window you are holding'),
    timeLimitMs: 3000,
    memoryLimitMb: 256,
    estimatedMinutes: 35,
    topics: [
      { slug: 'sorting', relevance: 'PRIMARY' },
      { slug: 'arrays', relevance: 'SECONDARY' },
    ],
    patterns: [{ slug: 'two-pointers', relevance: 'SECONDARY' }],
    hints: [
      'In the given order, a window can merge with one you discarded long ago. Is there an order in which that cannot happen?',
      'Sort by start. Then any window that merges with the one you are holding must be the very next one.',
      'Hold a current window. For each next window: if its start is at most the current end, extend the end to the larger of the two; otherwise emit the current window and start holding the new one. Do not forget to emit the last one.',
    ],
    testCases: [
      {
        input: '4\n1 3\n2 6\n8 10\n15 18\n',
        expectedOutput: '3\n1 6\n8 10\n15 18\n',
        isSample: true,
      },
      { input: '2\n1 4\n4 5\n', expectedOutput: '1\n1 5\n', isSample: true },
      { input: '1\n5 7\n', expectedOutput: '1\n5 7\n', isSample: false },
      { input: '3\n1 10\n2 3\n4 5\n', expectedOutput: '1\n1 10\n', isSample: false },
      {
        input: '3\n5 6\n1 2\n3 4\n',
        expectedOutput: '3\n1 2\n3 4\n5 6\n',
        isSample: false,
      },
      { input: '4\n1 2\n2 3\n3 4\n4 5\n', expectedOutput: '1\n1 5\n', isSample: false },
      { input: '2\n-5 -1\n-2 3\n', expectedOutput: '1\n-5 3\n', isSample: false },
      {
        input: '5\n10 12\n1 3\n2 2\n7 9\n11 20\n',
        expectedOutput: '3\n1 3\n7 9\n10 20\n',
        isSample: false,
      },
    ],
  },

  {
    slug: 'kth-slowest-response',
    title: 'Kth Slowest Response',
    difficulty: 'MEDIUM',
    statement: `A service logs one response time per request. For a latency report you need the \`k\`-th slowest response.

Read \`n\` and \`k\`, then \`n\` response times. Print the \`k\`-th largest value, counting duplicates separately — in \`[5, 5, 3]\` the 2nd largest is \`5\`.`,
    constraints: `- \`1 <= k <= n <= 200000\`
- \`-10^9 <= response time <= 10^9\``,
    examples: [
      {
        input: '6 2\n3 2 1 5 6 4',
        output: '5',
        explanation: 'Sorted descending: 6, 5, 4, 3, 2, 1.',
      },
      {
        input: '9 4\n3 2 3 1 2 4 5 5 6',
        output: '4',
        explanation: 'Descending: 6, 5, 5, 4, ... — duplicates each take a place.',
      },
    ],
    starterCode: starter('keep the k largest values seen so far'),
    timeLimitMs: 3000,
    memoryLimitMb: 256,
    estimatedMinutes: 30,
    topics: [
      { slug: 'heaps', relevance: 'PRIMARY' },
      { slug: 'sorting', relevance: 'SECONDARY' },
    ],
    patterns: [{ slug: 'top-k-heap', relevance: 'PRIMARY' }],
    hints: [
      'Sorting everything works and is a fine first answer. Write it, then ask what you actually needed to know.',
      'You never need the order of the values below the top `k`. What structure lets you hold `k` values and drop the weakest cheaply?',
      'Keep a min-heap of size `k`: push each value, and pop when the heap exceeds `k`. The value left at the top is the k-th largest.',
    ],
    testCases: [
      { input: '6 2\n3 2 1 5 6 4\n', expectedOutput: '5\n', isSample: true },
      { input: '9 4\n3 2 3 1 2 4 5 5 6\n', expectedOutput: '4\n', isSample: true },
      { input: '1 1\n42\n', expectedOutput: '42\n', isSample: false },
      { input: '5 5\n1 2 3 4 5\n', expectedOutput: '1\n', isSample: false },
      { input: '5 1\n-1 -2 -3 -4 -5\n', expectedOutput: '-1\n', isSample: false },
      { input: '4 3\n7 7 7 7\n', expectedOutput: '7\n', isSample: false },
      { input: '7 3\n10 9 8 7 6 5 4\n', expectedOutput: '8\n', isSample: false },
      { input: '6 6\n5 4 3 2 1 0\n', expectedOutput: '0\n', isSample: false },
    ],
  },

  {
    slug: 'conveyor-loop-check',
    title: 'Conveyor Loop Check',
    difficulty: 'MEDIUM',
    statement: `A conveyor network has \`n\` stations. Station \`i\` hands its parcels to exactly one station, given by \`next[i]\`, or drops them at the exit when \`next[i]\` is \`0\`.

A parcel enters at station 1. Print \`LOOP\` if it can never reach the exit, and \`NO LOOP\` if it can.

Read \`n\`, then \`n\` values \`next[1] .. next[n]\`.`,
    constraints: `- \`1 <= n <= 200000\`
- \`0 <= next[i] <= n\`
- Your solution must not use memory proportional to the path length.`,
    examples: [
      {
        input: '4\n2 3 4 0',
        output: 'NO LOOP',
        explanation: 'The parcel travels 1 → 2 → 3 → 4 and exits.',
      },
      {
        input: '4\n2 3 4 2',
        output: 'LOOP',
        explanation: 'From station 4 the parcel returns to 2 and circles for ever.',
      },
    ],
    starterCode: starter('walk the chain from station 1 and decide whether it terminates'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 35,
    topics: [{ slug: 'linked-lists', relevance: 'PRIMARY' }],
    patterns: [{ slug: 'fast-and-slow-pointers', relevance: 'PRIMARY' }],
    hints: [
      'Marking visited stations answers the question, but read the constraints again — what does the memory rule rule out?',
      'Send two parcels along the same chain, one moving one station per tick and one moving two. What can only happen if the chain closes on itself?',
      'Advance slow by one and fast by two. If fast reaches the exit, there is no loop; if fast ever lands on slow, there is one.',
    ],
    testCases: [
      { input: '4\n2 3 4 0\n', expectedOutput: 'NO LOOP\n', isSample: true },
      { input: '4\n2 3 4 2\n', expectedOutput: 'LOOP\n', isSample: true },
      { input: '1\n0\n', expectedOutput: 'NO LOOP\n', isSample: false },
      { input: '1\n1\n', expectedOutput: 'LOOP\n', isSample: false },
      { input: '5\n2 3 1 5 0\n', expectedOutput: 'LOOP\n', isSample: false },
      { input: '5\n3 1 4 5 0\n', expectedOutput: 'NO LOOP\n', isSample: false },
      { input: '6\n2 3 4 5 6 4\n', expectedOutput: 'LOOP\n', isSample: false },
      { input: '3\n3 1 0\n', expectedOutput: 'NO LOOP\n', isSample: false },
    ],
  },
]
