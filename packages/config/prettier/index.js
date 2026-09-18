import { createRequire } from 'node:module'

// Prettier resolves plugin names from the working directory, not from this file.
// Handing it an absolute path lets every package share one installed copy.
const require = createRequire(import.meta.url)

/** @type {import('prettier').Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: [require.resolve('prettier-plugin-tailwindcss')],
}
