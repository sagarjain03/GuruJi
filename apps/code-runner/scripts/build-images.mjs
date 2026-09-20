#!/usr/bin/env node
/* eslint-disable no-console -- a build script's output is the point of it. */
/**
 * Builds one sandbox image per language from `docker/sandbox/`.
 *
 * Tagged with an explicit version, never `latest`: the runner asks for
 * `guruji-sandbox-cpp:1` by name, so a half-finished rebuild cannot silently
 * become the image that runs the next submission.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const LANGUAGES = ['cpp', 'c', 'python', 'javascript']

const here = path.dirname(fileURLToPath(import.meta.url))
const sandboxDir = path.resolve(here, '../../../docker/sandbox')

const prefix = process.env.SANDBOX_IMAGE_PREFIX ?? 'guruji-sandbox'
const tag = process.env.SANDBOX_IMAGE_TAG ?? '1'

let failed = false

for (const language of LANGUAGES) {
  const image = `${prefix}-${language}:${tag}`
  console.log(`\n=== ${image} ===`)

  const result = spawnSync(
    'docker',
    ['build', '-t', image, path.join(sandboxDir, language)],
    { stdio: 'inherit' },
  )

  if (result.status !== 0) {
    console.error(`FAILED: ${image}`)
    failed = true
  }
}

if (failed) {
  console.error('\nOne or more images did not build. The runner will fail on those languages.')
  process.exit(1)
}

console.log(`\nAll ${String(LANGUAGES.length)} sandbox images built at tag ${tag}.`)
