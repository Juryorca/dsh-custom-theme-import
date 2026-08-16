#!/usr/bin/env node
// Build script for dsh-custom-theme-import.
// Wraps the plain-JS browser half into the DSH ModuleLoader bundle and writes
// the no-op host entry. `node build.mjs --check` verifies reproducibility.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pkgName = 'dsh-custom-theme-import'
const checkOnly = process.argv.includes('--check')

const clientSource = readFileSync(join(root, 'src', 'client.js'), 'utf8')
const clientOutput = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkgName)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${clientSource}
\t\treturn module.exports;
\t}
});
`

const indexSource = readFileSync(join(root, 'src', 'index.js'), 'utf8')
const indexOutput = indexSource.trimEnd() + '\n'

function verify(path, content) {
  const current = readFileSync(path, 'utf8')
  if (current !== content) {
    console.error(`[build] stale output: ${path}`)
    process.exit(1)
  }
  console.log(`[build] ok: ${path}`)
}

if (checkOnly) {
  verify(join(root, 'lib', 'client.js'), clientOutput)
  verify(join(root, 'lib', 'index.js'), indexOutput)
  console.log('[build] check passed')
} else {
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'lib', 'client.js'), clientOutput)
  writeFileSync(join(root, 'lib', 'index.js'), indexOutput)
  console.log('[build] wrote lib/client.js and lib/index.js')
}
