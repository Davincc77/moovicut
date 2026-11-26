/** /long "Join the list": a silent button is a dead button. Golds traced by hand BEFORE the code
 *  (tests/fixtures/long-form-golds.json); the file is pinned by sha256 so a quiet edit alerts by name.
 *  The pin was computed by node AND by mechacut.studio /api/v1/hash/digest (same hex). Re-bake = new hex + a reason. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { emailGate } from '../app/utils/waitlist-form.js'

const GOLDS_FILE = 'tests/fixtures/long-form-golds.json'
const GOLDS_SHA256 = '629d04ce06926700c9d59cb12c500e06a2f731acc94c467de1da576620f531d5'
const golds = JSON.parse(readFileSync(GOLDS_FILE, 'utf8'))

test('gold file is pinned', () => {
  assert.equal(createHash('sha256').update(readFileSync(GOLDS_FILE, 'utf8'), 'utf8').digest('hex'), GOLDS_SHA256)
})

for (const gold of golds.cases) {
  test(`emailGate: ${gold.name}`, () => {
    assert.deepEqual(emailGate(gold.email), gold.gate)
  })
}

test('emailGate never judges the format: the server is the single judge', () => {
  const source = readFileSync('app/utils/waitlist-form.js', 'utf8')
  assert.doesNotMatch(source, /RegExp|\.test\(|\.match\(|'@'|"@"/)
})

test('/long shows the gold message for an empty submit, without a request, and puts focus back on the field', () => {
  const page = readFileSync('app/pages/long.vue', 'utf8')
  assert.match(page, /emailGate\(email\.value\)/)
  assert.ok(page.includes(`t('${golds.message.email_missing}')`), 'the gold wording is the catalog key')
  assert.match(page, /emailInput\.value\?\.focus\(\)/)
  assert.doesNotMatch(page, /if \(!email\.value\.trim\(\)\) return/, 'the silent early return is gone')
})
