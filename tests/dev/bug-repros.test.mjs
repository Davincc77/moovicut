/**
 * Original blind-test sentences. This file is a dev set, not the tuning set.
 * npm test does not run tests/dev. The held-out file is the generalisation check.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../../app/utils/prose-detect.js'

test('dev repro: a comma list keeps age and a carried item on one person', () => {
  const found = detectProse('Odile, 62, silver braid, mustard-yellow raincoat, a brass compass on a cord around her neck, walks the quay.')
  assert.equal(found.characters.length, 1)
  const line = `${found.characters[0].look} ${found.characters[0].outfit}`
  assert.match(line, /62/)
  assert.match(line, /silver braid/)
  assert.match(line, /mustard-yellow raincoat/)
  assert.match(line, /brass compass/)
})

test('dev repro: a full name is one person and a street is not a person', () => {
  const found = detectProse('Hana Mori walks the quay. Late that night Hana Mori waits. Inside, Hana Mori sits. On Rue Verte Hana Mori turns.')
  assert.deepEqual(found.characters.map(item => item.name), ['Hana Mori'])
  assert.ok(found.places.some(place => place.name === 'Rue Verte'))
})

test('dev repro: a later short name does not become a second empty person', () => {
  const found = detectProse('Wilhelmina Okafor, 41, silver locs, linen coat, waits in the cafe. Wilhelmina checks the clock.')
  assert.deepEqual(found.characters.map(item => item.name), ['Wilhelmina Okafor'])
  assert.match(`${found.characters[0].look} ${found.characters[0].outfit}`, /41/)
  assert.match(`${found.characters[0].look} ${found.characters[0].outfit}`, /linen coat/)
})
