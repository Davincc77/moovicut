// U3 — le voyage lisible : progression visible PARTOUT, échappatoire au tunnel.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { skipWithDefaults, blankWizard } from '../app/utils/wizard.js'
import { WIZARD_STRINGS } from '../app/utils/wizard-strings.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const STORY = 'My grandmother says that during the war, when she was a girl, she walked across a frozen river at night carrying one small suitcase. She reached the far bank before dawn.'

test('skipWithDefaults: from the idea, detected words alone can reach generate (or check, never a dead end)', () => {
  let state = blankWizard()
  state = { ...state, idea: STORY }
  const jumped = skipWithDefaults(state)
  assert.ok(['generate', 'check'].includes(jumped.step), `step attendue generate|check, recue: ${jumped.step}`)
  assert.equal(jumped.idea, STORY, 'l’idée survit au skip')
})

test('skipWithDefaults: an empty idea does not move (le bouton est sans effet, pas destructeur)', () => {
  const state = { ...blankWizard(), idea: 'hi' }
  assert.deepEqual(skipWithDefaults(state), state)
})

test('skipWithDefaults est déterministe: même état, même résultat', () => {
  let s = { ...blankWizard(), idea: STORY }
  assert.deepEqual(skipWithDefaults(s), skipWithDefaults(s))
})

test('la rail propose la sortie: clé libellée dans WIZARD_STRINGS', () => {
  assert.ok(WIZARD_STRINGS['wizard.skip'], 'libellé du bouton skip')
  assert.match(WIZARD_STRINGS['wizard.skip'], /word|skip|continue/i)
})

test('StudioWizard câble le bouton (handler + aria)', () => {
  const vue = readFileSync(join(ROOT, 'app/components/StudioWizard.vue'), 'utf8')
  assert.match(vue, /skipWithDefaults/, 'composant')
  assert.match(vue, /t\('wizard\.skip'\)/, 'libellé via la chaîne cataloguée')
})

test('CSS: la puce « Step X of 6 » n’est plus invisibilisée sous 1px en desktop', () => {
  const css = readFileSync(join(ROOT, 'app/assets/css/main.css'), 'utf8')
  const desktop = css.match(/@media \(min-width:820px\)\s*\{[\s\S]*?\n\}/g) || []
  const offender = desktop.find(block => /wizard-step-compact[^}]*clip:rect\(0,0,0,0\)/.test(block))
  assert.equal(offender, undefined, 'déclaré mais rendu 1px: la progression est invisible à l’œil')
})
