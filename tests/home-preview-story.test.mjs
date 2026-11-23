// Lot F3 — « les mots de l'auteur dans les cartes » (dogfood 23-11).
// Une prose (2+ phrases) doit être rendue par le moteur de provenance : les
// cartes portent les phrases RÉELLES de l'utilisateur, avec leurs détails
// (valise, neige, aube). Une premise courte garde les battons actuels.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPreview } from '../app/utils/home-preview.js'

const GRANDMOTHER = 'My grandmother says that during the war, when she was a girl, she walked across a frozen river at night carrying one small suitcase. I would like to make a picture of her young, in the snow, at dawn.'
const PREMISE = 'A noir detective chases a suspect through neon-lit rain.'

test('prose (2+ sentences): cards carry the author’s own words, details included', () => {
  const r = buildPreview(GRANDMOTHER, 'grok')
  assert.equal(r.ok, true)
  assert.equal(r.mode, 'story')
  const joined = r.shots.map(s => s.line).join(' ')
  assert.match(joined, /frozen river/i, 'la rivière gelée traverse')
  assert.match(joined, /suitcase/i, 'la valise traverse')
  assert.match(joined, /snow|dawn/i, 'la neige ou l’aube traverse')
  assert.ok(r.shots.every(s => s.kind === 'your-words'), 'toute carte de prose est « vos mots », pas un baton')
})

test('prose cards never fall back to the generic beat templates', () => {
  const r = buildPreview(GRANDMOTHER, 'grok')
  for (const shot of r.shots) {
    assert.doesNotMatch(shot.line, /^One new detail|^The result of that choice|chooses a direction and moves/i)
  }
})

test('single-sentence premises keep the engine’s beats (no silent behavior change)', () => {
  const r = buildPreview(PREMISE, 'grok')
  assert.equal(r.ok, true)
  assert.equal(r.mode, 'beats')
  assert.ok(r.shots.length >= 1)
  assert.ok(r.shots.every(s => s.kind === 'engine'))
})

test('lines clip at word boundaries, never mid-word, max 140', () => {
  const long = 'The expedition crossed ' + 'glacier ' + 'blue '.repeat(60) + 'and turned back at dusk. Nobody spoke of it for years.'
  const r = buildPreview(long, 'grok')
  assert.equal(r.mode, 'story')
  for (const shot of r.shots) {
    assert.ok(shot.line.length <= 140, 'longueur <= 140 : ' + shot.line.length)
    assert.ok(/(?:…|\p{L}[.!?»”"']?)$/u.test(shot.line), 'terminaison par un mot entier ou l’ellipse')
  }
})

test('prose mode is deterministic: same input, same cards, twice', () => {
  assert.deepEqual(buildPreview(GRANDMOTHER, 'grok'), buildPreview(GRANDMOTHER, 'grok'))
})

test('prompts stay copyable in prose mode (the contract the renderer reads)', () => {
  const r = buildPreview(GRANDMOTHER, 'grok')
  for (const shot of r.shots) {
    assert.ok(shot.prompt.length > 20, 'prompt collable')
    assert.ok(Number.isInteger(shot.order))
  }
})
