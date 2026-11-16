import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProdServer } from '../server/prod-server.mjs'

const read = path => readFileSync(path, 'utf8')

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

test('the served README matches the repository README and the agent files link it', async () => {
  const readme = read('README.md')
  assert.equal(read('public/README.md'), readme)
  for (const file of ['public/llms.txt', 'public/llms-full.txt']) {
    const text = read(file)
    assert.match(text, /README\.md/, file)
    assert.match(text, /\/readme/, file)
    assert.match(text, /40 shots/, file)
    assert.match(text, /chapter/i, file)
    assert.match(text, /rule-based|does not call a model/i, file)
    assert.match(text, /place library|place-lexicon/i, file)
    assert.match(text, /English, Simplified Chinese, Portuguese, Japanese, French, and Italian|English, Simplified Chinese \(zh-Hans\), Portuguese, Japanese, French, and Italian/, file)
  }
  assert.match(read('app/pages/readme.vue'), /README\.md\?raw/)
  assert.match(read('app/components/SiteFooter.vue'), /pageHref\('credits'\)/)
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-readme-'))
  writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Home</title>')
  writeFileSync(join(directory, 'README.md'), readme)
  const server = createProdServer({ staticRoot: directory })
  const base = await listen(server)
  try {
    const response = await fetch(`${base}/README.md`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /markdown/)
    assert.equal(await response.text(), readme)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('the credits page names every place-library source and the ShareAlike licence', () => {
  const page = read('app/pages/credits.vue')
  const docs = read('docs/place-library.md')
  const readme = read('README.md')
  for (const text of [page, docs, readme]) {
    for (const name of ['Princeton WordNet', 'Open Multilingual Wordnet', 'WOLF', 'CeCILL-C', 'OpenWN-PT', 'MultiWordNet', 'NICT Japanese Wordnet', 'Chinese Open Wordnet', 'CC BY-SA 4.0']) {
      assert.match(text, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), name)
    }
  }
  assert.match(docs, /ShareAlike/)
  assert.match(read('app/data/place-lexicon.json'), /CC BY-SA 4\.0/)
})
