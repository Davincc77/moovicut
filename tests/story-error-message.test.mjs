// F1b : la page /story doit convertir le jargon du validateur en phrase humaine.
import test from 'node:test'
import assert from 'node:assert/strict'
import { storyErrorFor } from '../app/utils/story-provenance.js'

test('F1: validator jargon is translated to human words, never shown raw', () => {
  assert.equal(typeof storyErrorFor, 'function')
  const human = storyErrorFor(new Error('scenes[0] is missing where. scenes[1] is missing where.'))
  assert.match(human, /where|place|setting|scene/i)
  assert.doesNotMatch(human, /scenes\[|is missing where/i, 'jamais le message brut du schéma')
})

test('F1: an unknown error keeps a safe generic human line, not a crash', () => {
  const human = storyErrorFor(new Error('boom weird internal xyz'))
  assert.ok(human.length > 10)
  assert.doesNotMatch(human, /boom weird internal/i)
})
