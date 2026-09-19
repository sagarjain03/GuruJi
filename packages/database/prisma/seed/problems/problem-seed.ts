import type { Difficulty, TagRelevance } from '../../../generated/client/client'

export interface TagSeed {
  slug: string
  relevance: TagRelevance
}

export interface TestCaseSeed {
  input: string
  expectedOutput: string
  isSample: boolean
  weight?: number
}

export interface ProblemSeed {
  slug: string
  title: string
  difficulty: Difficulty
  /** Markdown. Original wording — no third-party statement is reproduced here. */
  statement: string
  constraints: string
  examples: { input: string; output: string; explanation: string | null }[]
  starterCode: Record<string, string>
  timeLimitMs: number
  memoryLimitMb: number
  estimatedMinutes: number
  topics: TagSeed[]
  patterns: TagSeed[]
  /** Ordered 1..n. Level 1 nudges; the last level names the technique. */
  hints: string[]
  testCases: TestCaseSeed[]
}

/**
 * Every problem reads whitespace-separated tokens from stdin and writes to
 * stdout, so one scaffold per language covers all of them. `todo` is the single
 * problem-specific line.
 */
export function starter(todo: string): Record<string, string> {
  return {
    CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: ${todo}

    return 0;
}
`,
    C: `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    /* TODO: ${todo} */

    return 0;
}
`,
    PYTHON: `import sys


def main() -> None:
    data = sys.stdin.read().split()
    # TODO: ${todo}


main()
`,
    JAVASCRIPT: `const data = require('fs').readFileSync(0, 'utf8').split(/\\s+/).filter(Boolean)

// TODO: ${todo}
`,
  }
}
