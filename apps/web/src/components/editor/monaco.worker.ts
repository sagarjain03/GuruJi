/**
 * Monaco's base editor worker, re-exported from our own source tree.
 *
 * The worker is created as `new Worker(new URL('./monaco.worker.ts', import.meta.url))`.
 * That relative form is the one the bundler can follow and compile into a
 * same-origin file — which is what `worker-src 'self'` in the CSP requires. A
 * bare package specifier inside `new URL` is not resolved, and Monaco's own
 * fallback builds the worker from a `blob:` URL the policy would reject.
 */
import 'monaco-editor/editor/editor.worker.js'
