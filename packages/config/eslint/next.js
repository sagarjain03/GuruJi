import next from 'eslint-config-next/core-web-vitals'
import base from './base.js'

/** Next.js apps. */
export default [
  ...base,
  ...(Array.isArray(next) ? next : [next]),
  {
    rules: {
      // Pages Router rule: it asks for `pages/_document.js`, which App Router
      // does not have. Font <link> tags belong in the root layout head.
      '@next/next/no-page-custom-font': 'off',
    },
  },
]
