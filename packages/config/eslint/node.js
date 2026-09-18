import globals from 'globals'
import base from './base.js'

/** Server-side packages: API, code runner, and Node-only shared packages. */
export default [...base, { languageOptions: { globals: globals.node } }]
