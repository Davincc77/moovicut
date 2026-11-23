// U4 — le souffle : affordances de pro, dans la palette existante (le test
// palette interdit tout hex hors tokens — ici on n'utilise QUE des var()).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(ROOT, 'app/assets/css/main.css'), 'utf8')

test('focus clavier visible partout (heuristique 4 : consistance avec le web standard)', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline/, 'une règle :focus-visible avec outline doit exister')
})

test('titres display : letter-spacing négatif (la leçon des systèmes premium)', () => {
  const hero = css.match(/\.hero-copy h1\s*\{([^}]*)\}/)
  assert.ok(hero, '.hero-copy h1 défini')
  assert.match(hero[1], /letter-spacing:\s*-0?\.\d+em/, 'h1 doit serrer ses lettres')
})

test('les cartes genre offrent le survol (affordance, pas décoration)', () => {
  assert.match(css, /\.genre-grid button:hover\s*\{/, 'hover déclaré')
  const hover = css.match(/\.genre-grid button:hover\s*\{([^}]*)\}/)[1]
  assert.match(hover, /border-color:var\(--accent|border-color:var\(--gold/, 'le hover doit parler le langage de la marque via var()'
  )
})

test('prefers-reduced-motion respecte l’utilisateur (a11y)', () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})

test('aucun hex hors palette introduit (rappel : le guard palette fait le vrai travail)', () => {
  const PALETTE = new Set(['0a0a0a', '0f0f0f', '141414', '1b1b1b', 'eae7df', '9a9486', 'f0b429', 'f6c85a', '1a1408', 'ef4444', '000000', 'ffffff'])
  for (const m of css.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) {
    let body = m[0].slice(1).toLowerCase()
    if (body.length === 3 || body.length === 4) body = [...body].map(c => c + c).join('')
    if (body.length === 8) body = body.slice(0, 6)
    assert.ok(PALETTE.has(body), `hex hors tokens: ${m[0]}`)
  }
})
