// U2 — planchers mesurés (audit U1 du 23-11) : plus jamais 11px de texte utile,
// plus jamais de cible interactive sous 40px. Garde statique sur main.css :
// si quelqu'un « optimise » la typo à la baisse, la CI le refuse.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(ROOT, 'app/assets/css/main.css'), 'utf8')

function declaredPx(rule, prop) {
  const hits = [...css.matchAll(new RegExp(`\\.${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g'))]
  assert.ok(hits.length >= 1, `règle .${rule} absente du CSS`)
  return hits.map(h => {
    const m = h[1].match(new RegExp(`${prop}:\\s*(\\d+(?:\\.\\d+)?)px`))
    return m ? Number(m[1]) : null
  }).filter(v => v !== null)
}

const TEXT = [
  ['hero-local-note', 14],
  ['hero-model-line', 14],
  ['text-link', 14],
  ['board-tag', 13],
  ['board-line', 15]
]
for (const [rule, floor] of TEXT) {
  test(`typo : .${rule} jamais sous ${floor}px`, () => {
    for (const value of declaredPx(rule, 'font-size')) {
      assert.ok(value >= floor, `.${rule} declare ${value}px < ${floor}px`)
    }
  })
}

test('typo : plus aucun texte utile sous 12px dans la feuille (le 11px de la landing est mort)', () => {
  const small = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)]
    .map(m => Number(m[1])).filter(v => v < 12)
  assert.deepEqual(small, [], `tailles interdites: ${small.join(',')}`)
})

const TARGETS = [
  ['hero-model-select', 'min-height', 40],
  ['main-nav-link', 'min-height', 40]
]
test('touch : les chips exemple du hero atteignent 40px', () => {
  const hit = css.match(/\.hero-model-line button\s*\{([^}]*)\}/g) || []
  assert.ok(hit.length >= 1)
  for (const block of hit) {
    const mh = block.match(/min-height:\s*(\d+)px/)
    assert.ok(mh && Number(mh[1]) >= 40, `min-height insuffisant: ${mh?.[1] || 'absent'}`)
  }
})
test('touch : la nav principale a une cible >= 40px', () => {
  const block = css.match(/\.main-nav a\s*\{([^}]*)\}/)
  assert.ok(block && /min-height:\s*(4[0-9]|[5-9]\d)px/.test(block[1]), 'main-nav a doit declarer min-height >= 40px')
})
void TARGETS
