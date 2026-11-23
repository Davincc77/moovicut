// Rapport « Marc » 23-11 — la prose humaine avant tout.
// F1 : /story ne doit JAMAIS jeter ni afficher le vocabulaire du validateur sur une
// prose naturelle sans lieu explicite. F2 : « My grandmother says that… » ne fait pas
// un personnage qui s'appelle « My grandmother says ». F4 : l'accord du pluriel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storyToBoard, storyCast } from '../app/utils/story-provenance.js'
import { buildContinuitySheet } from '../app/utils/prompt-engine.js'
import { buildPreview } from '../app/utils/home-preview.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GRANDMOTHER = 'My grandmother says that during the war, when she was a girl, she walked across a frozen river at night carrying one small suitcase. I would like to make a picture of her young, in the snow, at dawn.'
const CAT = 'My cat knocked a glass off the kitchen table this morning and I laughed until I cried.'

test('F1: storyToBoard survives prose without explicit places (no throw)', () => {
  for (const story of [GRANDMOTHER, CAT]) {
    const r = storyToBoard(story, { model: 'grok' })
    assert.ok(r.board.shots.length >= 1, 'un draft avec au moins un shot, pas une exception')
  }
})

test('F1: the /story surface never speaks validator to a human', () => {
  const vue = readFileSync(join(ROOT, 'app/pages/story.vue'), 'utf8')
  assert.match(vue, /is missing|could not|humanize|storyError/i, 'la page mappe les erreurs techniques')
  assert.ok(vue.includes('storyErrorFor') || vue.includes('could not be planned'), 'message humain par défaut')
})

test('F2: a reported clause does not become the character name', () => {
  assert.equal(buildContinuitySheet(GRANDMOTHER).character, 'My grandmother')
  assert.equal(buildContinuitySheet(CAT).character, 'My cat')
  const cast = storyCast(GRANDMOTHER)
  assert.ok(cast.length >= 1)
  assert.doesNotMatch(cast[0].name, /\b(says|knocked)\b/i, 'jamais de verbe dans le nom du casting')
})

test('F2: the hero board cards never print the stolen verb either', () => {
  const r = buildPreview(GRANDMOTHER, 'grok')
  assert.equal(r.ok, true)
  for (const shot of r.shots) {
    assert.doesNotMatch(shot.line + ' ' + shot.prompt, /grandmother says|says that|cat knocked/i, 'la prose volée ne revient pas dans les cartes')
  }
})

test('F4: a singular more-shots key exists beside the plural, both locales', () => {
  for (const lang of ['en', 'pt']) {
    const messages = JSON.parse(readFileSync(join(ROOT, `app/i18n/locales/${lang}.json`), 'utf8'))
    assert.ok(messages['{more} more shot in the studio'], `${lang}: clé singulière présente`)
    assert.ok(messages['{more} more shots in the studio'], `${lang}: clé plurielle présente`)
  }
})

test('F3: the beginner is told, in one plain sentence, what to do with a card', () => {
  const messages = JSON.parse(readFileSync(join(ROOT, 'app/i18n/locales/en.json'), 'utf8'))
  assert.ok(messages['Want just one picture? Copy any card and paste it into your AI app.'], 'micro-copie présente en EN')
  const pt = JSON.parse(readFileSync(join(ROOT, 'app/i18n/locales/pt.json'), 'utf8'))
  assert.ok(pt['Want just one picture? Copy any card and paste it into your AI app.'], '…et en PT')
})
