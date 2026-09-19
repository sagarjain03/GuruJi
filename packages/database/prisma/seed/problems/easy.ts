import { starter, type ProblemSeed } from './problem-seed'

export const EASY_PROBLEMS: ProblemSeed[] = [
  {
    slug: 'pair-sums-to-target',
    title: 'Pair Sums to Target',
    difficulty: 'EASY',
    statement: `A sensor array reports one integer reading per position. You are given a target value and asked to find the **two distinct positions** whose readings add up to exactly that target.

Read \`n\` and \`target\`, then \`n\` readings. Print the two positions as **1-based indices in increasing order**, separated by a space. If no pair adds up to the target, print \`-1\`.

The input guarantees that at most one such pair exists.`,
    constraints: `- \`1 <= n <= 200000\`
- \`-10^9 <= reading, target <= 10^9\`
- At most one valid pair exists.`,
    examples: [
      {
        input: '5 9\n2 7 11 15 3',
        output: '1 2',
        explanation: 'Readings 2 and 7 sit at positions 1 and 2, and 2 + 7 = 9.',
      },
      {
        input: '4 100\n1 2 3 4',
        output: '-1',
        explanation: 'No two readings reach 100.',
      },
    ],
    starterCode: starter('read n and target, then the readings, and print the two positions'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 15,
    topics: [
      { slug: 'arrays', relevance: 'PRIMARY' },
      { slug: 'hashing', relevance: 'SECONDARY' },
    ],
    patterns: [{ slug: 'hash-map-lookup', relevance: 'PRIMARY' }],
    hints: [
      'The obvious solution checks every pair. Before optimising it, write down its cost when n is 200000 — that number is why the obvious solution is not the answer here.',
      'You are always asking the same question: "have I already seen the number that would complete this pair?" What would let you answer that in constant time?',
      'Walk the array once. For each reading, look up `target - reading` in a map of value to position you have built so far; if it is there you are done, otherwise record the current reading and move on.',
    ],
    testCases: [
      { input: '5 9\n2 7 11 15 3\n', expectedOutput: '1 2\n', isSample: true },
      { input: '4 100\n1 2 3 4\n', expectedOutput: '-1\n', isSample: true },
      { input: '2 0\n-5 5\n', expectedOutput: '1 2\n', isSample: false },
      { input: '6 -8\n-3 4 1 -5 2 9\n', expectedOutput: '1 4\n', isSample: false },
      { input: '1 5\n5\n', expectedOutput: '-1\n', isSample: false },
      { input: '5 14\n7 1 2 3 7\n', expectedOutput: '1 5\n', isSample: false },
      { input: '6 3\n1000000000 -999999997 2 8 4 6\n', expectedOutput: '1 2\n', isSample: false },
      { input: '5 9\n1 2 3 4 5\n', expectedOutput: '4 5\n', isSample: false },
    ],
  },

  {
    slug: 'longest-steady-run',
    title: 'Longest Steady Run',
    difficulty: 'EASY',
    statement: `A machine logs one reading per second. A run is **steady** while consecutive readings are identical.

Read \`n\` followed by \`n\` readings, and print the length of the longest steady run.`,
    constraints: `- \`1 <= n <= 200000\`
- \`-10^9 <= reading <= 10^9\``,
    examples: [
      {
        input: '7\n3 3 1 1 1 2 2',
        output: '3',
        explanation: 'The run of three 1s is the longest.',
      },
      {
        input: '1\n9',
        output: '1',
        explanation: 'A single reading is a steady run of length one.',
      },
    ],
    starterCode: starter('track the current run length and the best seen so far'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 10,
    topics: [{ slug: 'arrays', relevance: 'PRIMARY' }],
    patterns: [{ slug: 'two-pointers', relevance: 'SECONDARY' }],
    hints: [
      'You never need to look at more than two readings at a time.',
      'Keep two numbers as you scan: how long the run you are inside is, and the longest run you have finished.',
      'Reset the current length to 1 whenever a reading differs from the one before it, and take the maximum at every step — including the last one, which is the off-by-one this problem is really testing.',
    ],
    testCases: [
      { input: '7\n3 3 1 1 1 2 2\n', expectedOutput: '3\n', isSample: true },
      { input: '1\n9\n', expectedOutput: '1\n', isSample: true },
      { input: '5\n1 2 3 4 5\n', expectedOutput: '1\n', isSample: false },
      { input: '6\n4 4 4 4 4 4\n', expectedOutput: '6\n', isSample: false },
      { input: '8\n1 1 2 2 2 2 3 1\n', expectedOutput: '4\n', isSample: false },
      { input: '4\n-1 -1 -1 0\n', expectedOutput: '3\n', isSample: false },
      { input: '10\n5 5 6 6 6 7 7 7 7 8\n', expectedOutput: '4\n', isSample: false },
      { input: '2\n0 0\n', expectedOutput: '2\n', isSample: false },
    ],
  },

  {
    slug: 'balanced-brackets-log',
    title: 'Balanced Brackets Log',
    difficulty: 'EASY',
    statement: `A build tool writes a trace where every opened scope is closed by its matching bracket. The trace uses three bracket kinds: \`()\`, \`[]\` and \`{}\`.

A trace is **balanced** when every bracket closes the most recently opened unclosed bracket, of the same kind, and nothing is left open at the end.

Read \`n\`, the length of the trace, then the trace itself on the next line. Print \`BALANCED\` or \`UNBALANCED\`.`,
    constraints: `- \`1 <= n <= 200000\`
- The trace contains only the characters \`()[]{}\`.`,
    examples: [
      { input: '6\n({[]})', output: 'BALANCED', explanation: 'Every bracket closes in order.' },
      {
        input: '2\n(]',
        output: 'UNBALANCED',
        explanation: 'The open round bracket is closed by a square one.',
      },
    ],
    starterCode: starter('push opening brackets, pop and compare on each closing bracket'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 15,
    topics: [
      { slug: 'stacks-and-queues', relevance: 'PRIMARY' },
      { slug: 'strings', relevance: 'SECONDARY' },
    ],
    patterns: [],
    hints: [
      'Counting brackets is not enough: `(]` has one opener and one closer and is still wrong. What else does the rule require?',
      '"Closes the most recently opened" is the definition of a particular data structure. Which one?',
      'Push every opening bracket. On a closing bracket, fail if the stack is empty or its top is not the matching opener; at the end, fail if the stack is not empty.',
    ],
    testCases: [
      { input: '6\n({[]})\n', expectedOutput: 'BALANCED\n', isSample: true },
      { input: '2\n(]\n', expectedOutput: 'UNBALANCED\n', isSample: true },
      { input: '1\n(\n', expectedOutput: 'UNBALANCED\n', isSample: false },
      { input: '4\n()[]\n', expectedOutput: 'BALANCED\n', isSample: false },
      { input: '4\n([)]\n', expectedOutput: 'UNBALANCED\n', isSample: false },
      { input: '12\n{{[[(())]]}}\n', expectedOutput: 'BALANCED\n', isSample: false },
      { input: '3\n)((\n', expectedOutput: 'UNBALANCED\n', isSample: false },
      { input: '2\n{}\n', expectedOutput: 'BALANCED\n', isSample: false },
    ],
  },

  {
    slug: 'reverse-the-transcript',
    title: 'Reverse the Transcript',
    difficulty: 'EASY',
    statement: `A speech-to-text service emits a line of words. For a playback feature you need the same words in the opposite order.

Read \`n\`, the number of words, then the \`n\` words on the next line separated by single spaces. Print them in reverse order, separated by single spaces.`,
    constraints: `- \`1 <= n <= 100000\`
- Each word is 1 to 20 characters of letters and digits.`,
    examples: [
      {
        input: '4\nthe queue drains slowly',
        output: 'slowly drains queue the',
        explanation: 'The words are emitted last to first. The words themselves are unchanged.',
      },
      { input: '1\nalone', output: 'alone', explanation: 'One word reverses to itself.' },
    ],
    starterCode: starter('read the words and print them in reverse order'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 10,
    topics: [{ slug: 'strings', relevance: 'PRIMARY' }],
    patterns: [{ slug: 'two-pointers', relevance: 'SECONDARY' }],
    hints: [
      'The words keep their own spelling. Only their order changes.',
      'Build the output once rather than prepending to a string in a loop — prepending copies everything you have built so far, every time.',
      'Read all the words into a list, then emit from the back, joining with a single space.',
    ],
    testCases: [
      {
        input: '4\nthe queue drains slowly\n',
        expectedOutput: 'slowly drains queue the\n',
        isSample: true,
      },
      { input: '1\nalone\n', expectedOutput: 'alone\n', isSample: true },
      { input: '3\na b c\n', expectedOutput: 'c b a\n', isSample: false },
      {
        input: '5\none two three four five\n',
        expectedOutput: 'five four three two one\n',
        isSample: false,
      },
      { input: '2\nhello world\n', expectedOutput: 'world hello\n', isSample: false },
      {
        input: '6\nx1 y2 z3 a4 b5 c6\n',
        expectedOutput: 'c6 b5 a4 z3 y2 x1\n',
        isSample: false,
      },
      { input: '3\nGuruJi trains you\n', expectedOutput: 'you trains GuruJi\n', isSample: false },
      {
        input: '7\nseven six five four three two one\n',
        expectedOutput: 'one two three four five six seven\n',
        isSample: false,
      },
    ],
  },

  {
    slug: 'first-missing-shift-id',
    title: 'First Missing Shift ID',
    difficulty: 'EASY',
    statement: `Shifts are numbered from 1 upwards. A roster export lists the shift id assigned to each worker, but the export is dirty: it can contain duplicates, zero, and negative placeholder values.

Read \`n\` followed by \`n\` values, and print the **smallest positive integer that does not appear** in the export.`,
    constraints: `- \`1 <= n <= 200000\`
- \`-10^9 <= value <= 10^9\``,
    examples: [
      {
        input: '5\n3 4 -1 1 1',
        output: '2',
        explanation: 'The positive values present are 1, 3 and 4. The smallest missing one is 2.',
      },
      {
        input: '3\n1 2 3',
        output: '4',
        explanation: 'Nothing is missing below 4, so the answer is one past the end.',
      },
    ],
    starterCode: starter('find the smallest positive integer absent from the values'),
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    estimatedMinutes: 20,
    topics: [
      { slug: 'arrays', relevance: 'PRIMARY' },
      { slug: 'hashing', relevance: 'SECONDARY' },
    ],
    patterns: [{ slug: 'hash-map-lookup', relevance: 'PRIMARY' }],
    hints: [
      'Values above `n` cannot change the answer. Convince yourself why before writing anything.',
      'With `n` values, the answer is somewhere in `1..n+1` — there are not enough values to fill that range.',
      'Record which of `1..n` are present, then return the first one that is not. Zero and negatives are noise; discard them on the way in.',
    ],
    testCases: [
      { input: '5\n3 4 -1 1 1\n', expectedOutput: '2\n', isSample: true },
      { input: '3\n1 2 3\n', expectedOutput: '4\n', isSample: true },
      { input: '1\n-5\n', expectedOutput: '1\n', isSample: false },
      { input: '4\n7 8 9 11\n', expectedOutput: '1\n', isSample: false },
      { input: '6\n1 2 3 4 5 6\n', expectedOutput: '7\n', isSample: false },
      { input: '5\n2 2 2 2 2\n', expectedOutput: '1\n', isSample: false },
      { input: '8\n1 1 2 3 5 8 13 21\n', expectedOutput: '4\n', isSample: false },
      { input: '3\n0 -1 2\n', expectedOutput: '1\n', isSample: false },
    ],
  },
]
