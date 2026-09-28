import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * "Gamification never feeds mastery" (architecture §11), as a test rather
 * than a sentence. Achievements may read what the engines produce; no engine
 * may import achievements. A dependency in that direction is the first step to
 * a badge nudging a score, and this fails the moment one is added.
 */
const SRC = path.resolve(__dirname, '..')
const ENGINES = ['mastery', 'recommendations', 'revision', 'execution', 'contests', 'ai', 'content']

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sources(full)
    return entry.name.endsWith('.ts') ? [full] : []
  })
}

describe('achievements boundary', () => {
  it.each(ENGINES)('nothing in %s imports achievements', (engine) => {
    const offenders = sources(path.join(SRC, engine)).filter((file) =>
      /from\s+['"][^'"]*achievements[^'"]*['"]/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([])
  })

  it('the achievements module exports nothing for others to depend on', () => {
    const module = readFileSync(path.join(SRC, 'achievements', 'achievements.module.ts'), 'utf8')
    expect(module).not.toMatch(/exports\s*:/)
  })
})
