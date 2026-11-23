import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPreview } from '../app/utils/home-preview.js'

// L'emprunt d'ergonomie 24-11 : le board instantané sous le composer du
// héros. Contrat de ce helper : LOCAL (pas de fetch), déterministe,
// silencieux tant que l'idée est trop courte, jamais muet une fois prête.

const PREMISE = 'A courier sprints across a failing bridge while a pursuit closes from behind, handheld camera and hard cuts.'

test('buildPreview is deterministic: same premise, same cards, twice in a row', () => {
  const a = buildPreview(PREMISE, 'grok')
  const b = buildPreview(PREMISE, 'grok')
  assert.equal(a.ok, true)
  assert.deepEqual(a, b)
})

test('buildPreview never invents a server: the helper imports no fetch and returns local cards only', () => {
  const src = readSource('app/utils/home-preview.js')
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|axios/, 'le board du héros ne doit JAMAIS sortir de la machine')
})

test('short or blank premises are silently not-ok — no half board, no error text', () => {
  assert.deepEqual(buildPreview('hi').ok, false)
  assert.equal(buildPreview('').reason, 'too_short')
  assert.equal(buildPreview('   ').reason, 'too_short')
})

test('cards carry what the renderer reads: order, a line, a copyable prompt', () => {
  const r = buildPreview(PREMISE, 'grok')
  assert.ok(r.shots.length >= 1 && r.shots.length <= 4)
  assert.equal(r.total >= r.shots.length, true)
  for (const shot of r.shots) {
    assert.ok(Number.isInteger(shot.order))
    assert.ok(shot.line.length > 8)
    assert.ok(shot.prompt.length > 20, 'chaque carte doit avoir un prompt collable')
  }
  assert.equal(r.more, r.total - r.shots.length)
})

test('a different prompt target still plans: the preview follows heroModel', () => {
  const r = buildPreview(PREMISE, 'sora')
  assert.equal(r.ok, true)
  assert.ok(r.shots.length >= 1)
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
function readSource(rel) { return readFileSync(join(ROOT, rel), 'utf8') }
