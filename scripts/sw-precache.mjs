// Post-build step: inject the built asset list into dist/sw.js so the app is
// fully offline-capable after its first visit. The cache name embeds a hash
// of the list, so each deploy drops the previous cache on activate.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(dist)
  .map((f) => './' + relative(dist, f).split('\\').join('/'))
  // .woff is only a fallback for pre-2016 browsers; precaching it would
  // download ~62KB nobody uses. Runtime caching still covers a request.
  .filter((f) => f !== './sw.js' && f !== './index.html' && !f.endsWith('.woff'))

const precache = ['./', ...files.sort()]
const hash = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 10)

const swPath = join(dist, 'sw.js')
let sw = readFileSync(swPath, 'utf8')
sw = sw
  .replace(/const CACHE = .*$/m, `const CACHE = 'rollbook-${hash}'`)
  .replace(/const PRECACHE = .*$/m, `const PRECACHE = ${JSON.stringify(precache)}`)
writeFileSync(swPath, sw)
console.log(`sw.js: precaching ${precache.length} entries, cache rollbook-${hash}`)
