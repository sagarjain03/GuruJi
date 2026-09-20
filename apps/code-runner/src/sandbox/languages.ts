import type { Language } from '@guruji/types'

export interface LanguagePlan {
  image: string
  sourceFile: string
  /** Absent for interpreted languages. */
  compile?: { entrypoint: string; args: string[] }
  run: { entrypoint: string; args: string[] }
}

const PREFIX = process.env.SANDBOX_IMAGE_PREFIX ?? 'guruji-sandbox'
const TAG = process.env.SANDBOX_IMAGE_TAG ?? '1'

/**
 * How each language is compiled and run.
 *
 * The entrypoint is always passed explicitly rather than baked into the image,
 * so the exact binary and arguments a submission runs are visible here, in one
 * file, next to the limits that bound them.
 */
export const LANGUAGES: Record<Language, LanguagePlan> = {
  CPP: {
    image: `${PREFIX}-cpp:${TAG}`,
    sourceFile: 'source.cpp',
    compile: {
      entrypoint: 'g++',
      args: ['-O2', '-std=c++20', '-o', '/sandbox/prog', '/sandbox/source.cpp'],
    },
    run: { entrypoint: '/sandbox/prog', args: [] },
  },
  C: {
    image: `${PREFIX}-c:${TAG}`,
    sourceFile: 'source.c',
    compile: {
      entrypoint: 'gcc',
      args: ['-O2', '-std=c17', '-o', '/sandbox/prog', '/sandbox/source.c'],
    },
    run: { entrypoint: '/sandbox/prog', args: [] },
  },
  PYTHON: {
    image: `${PREFIX}-python:${TAG}`,
    sourceFile: 'source.py',
    run: { entrypoint: 'python3', args: ['-I', '-B', '/sandbox/source.py'] },
  },
  JAVASCRIPT: {
    image: `${PREFIX}-javascript:${TAG}`,
    sourceFile: 'source.js',
    run: { entrypoint: 'node', args: ['/sandbox/source.js'] },
  },
}
