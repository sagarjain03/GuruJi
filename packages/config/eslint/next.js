import next from 'eslint-config-next/core-web-vitals'
import base from './base.js'

/** Next.js apps. */
export default [...base, ...(Array.isArray(next) ? next : [next])]
