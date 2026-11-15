import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { createStoryboard } from '../app/utils/prompt-engine.js'
import { lockLineFor } from '../app/utils/character-lock.js'
import { blankWizard, continueStep, setIdea } from '../app/utils/wizard.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function prose(text) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: text, model: 'grok', compact: true })
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

test('M1 age and carried items stay in the lock line', () => {
  const text = 'Pilar, 71, white bun, olive-green cloak, a silver locket on a chain around her neck, walks the quay. Pilar waits.'
  const board = createStoryboard({ premise: text, model: 'grok' })
  const lock = lockLineFor(board.filmSheet.characters.find(item => item.name === 'Pilar'), 1)
  for (const piece of ['71', 'white bun', 'olive-green cloak', 'silver locket on a chain around her neck']) {
    assert.match(lock, new RegExp(piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(board.shots.map(shot => shot.action).join('\n'), /walks the quay/)
})

test('M2 a description sentence fills the sheet and is not a shot', () => {
  const detected = detectProse('Colette is forty-two. She has long auburn curls and wears a blue apron. Colette pours the tea in the kitchen.')
  const colette = detected.characters.find(item => item.name === 'Colette')
  assert.ok(colette)
  assert.match(colette.look, /forty-two/)
  assert.match(colette.look, /auburn curls/)
  assert.match(colette.outfit, /blue apron/)
  assert.equal(colette.outfit.includes('apron, apron'), false)
  assert.deepEqual(detected.scenes.map(scene => scene.what), ['Colette pours the tea in the kitchen'])
  const guide = continueStep(setIdea(blankWizard(), 'Colette is forty-two. She has long auburn curls and wears a blue apron. Colette pours the tea in the kitchen.'))
  const sheet = guide.characters.find(item => item.name === 'Colette')
  assert.equal(sheet.age, 'forty-two')
  assert.match(sheet.hair, /auburn curls/)
  assert.match(sheet.outfit, /blue apron/)
  assert.deepEqual(guide.shots.map(shot => shot.action), ['Colette pours the tea in the kitchen'])
})

test('M3 a later introduction keeps the second character\'s description', () => {
  const detected = detectProse('Colette pours the tea in the kitchen. Her cousin Jonas is thirty-one, with a short beard and a brown cap. Jonas lifts the cup.')
  const jonas = detected.characters.find(item => item.name === 'Jonas')
  assert.ok(jonas)
  assert.match(jonas.look, /thirty-one/)
  assert.match(jonas.look, /short beard/)
  assert.match(jonas.outfit, /brown cap/)
  assert.equal(detected.scenes.some(scene => /thirty-one|short beard/.test(scene.what)), false)
  assert.deepEqual(detected.scenes.map(scene => scene.what), ['Colette pours the tea in the kitchen', 'Jonas lifts the cup'])
})

test('M4 full names stay whole and sentence-initial words are not people', () => {
  const detected = detectProse('Hana Mori walks the quay. Late that night Hana Mori waits. Inside, Hana Mori sits. On Rue Verte Hana Mori turns.')
  assert.deepEqual(detected.characters.map(item => item.name), ['Hana Mori'])
  assert.equal(detected.characters.some(item => /^(Hana|Mori|Late|Inside|Verte|On)$/.test(item.name)), false)
  assert.ok(detected.places.some(place => place.name === 'Rue Verte'))
  assert.equal(detected.places.some(place => place.name === 'On Rue'), false)
})

test('M5 an unrecognised place still plans with an uncertain setting', () => {
  const named = prose('Ida walks the loading dock. Ida lifts a crate.')
  assert.equal(named.status, 200)
  assert.ok(detectProse('Ida walks the loading dock. Ida lifts a crate.').places.some(place => /loading dock/i.test(place.name)))
  const bare = prose('Nia walks forward. Nia lifts the lid.')
  assert.equal(bare.status, 200)
  const setting = detectProse('Nia walks forward. Nia lifts the lid.').places[0]
  assert.equal(setting.uncertain, true)
  assert.match(setting.name, /setting/i)
  const agent = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: 'Nia walks forward. Nia lifts the lid.', model: 'grok', format: 'agent' })
  })
  const sheet = JSON.parse(agent.body).filmSheet.places[0]
  assert.equal(sheet.uncertain, true)
  assert.match(sheet.name, /setting/i)
  const french = prose('Inès ouvre le laboratoire. Inès attend.')
  assert.equal(french.status, 200)
  assert.ok(detectProse('Inès ouvre le laboratoire. Inès attend.').places.some(place => /laboratoire/i.test(place.name)))
})

test('M6 a long board keeps every shot in a part', () => {
  const beats = Array.from({ length: 50 }, (_, index) => `Nia walks marker ${index + 1}`).join('. ')
  const planned = prose(`Nia, 40, short black hair, grey coat, ${beats} on the quay.`)
  assert.equal(planned.status, 200)
  assert.ok(planned.body.shots.length >= 50)
  const markers = planned.body.shots.map(shot => shot.prompt.match(/marker (\d+)/)?.[1]).filter(Boolean)
  assert.equal(new Set(markers).size, 50)
  assert.ok(planned.body.parts?.length > 1)
  planned.body.parts.forEach(part => assert.ok(part.to - part.from + 1 <= 40))
})

test('M7 time of day changes with the text', () => {
  const text = 'At dawn, in the bakery, Nora pours the tea. That night, Nora waits by the oven.'
  const detected = detectProse(text)
  assert.equal(detected.scenes[0].light, 'dawn')
  assert.equal(detected.scenes.at(-1).light, 'night')
  assert.notEqual(detected.scenes[0].light, detected.scenes.at(-1).light)
  const planned = prose(text)
  assert.equal(planned.status, 200)
  assert.match(planned.body.shots[0].prompt, /dawn/i)
  assert.match(planned.body.shots.at(-1).prompt, /night/i)
  assert.doesNotMatch(planned.body.shots[0].prompt, /\bnight\b/i)
})

test('M8 an object noun does not move the place', () => {
  const detected = detectProse('In the bakery Nora checks the list pinned to the pantry office window. Nora pours the tea.')
  assert.deepEqual(detected.places.map(place => place.name), ['Bakery'])
  assert.equal(detected.scenes.every(scene => scene.where === 'Bakery'), true)
  assert.equal(detected.places.some(place => /office/i.test(place.name)), false)
})

test('M9 a place description does not repeat the bare name', () => {
  const detected = detectProse('In the tiny sunlit cafe, Nora waits. Nora pours the tea.')
  const cafe = detected.places.find(place => /caf/i.test(place.name))
  assert.ok(cafe)
  assert.match(cafe.description, /tiny/)
  assert.match(cafe.description, /sunlit/)
  assert.notEqual(cafe.description.replace(/^(?:a|an|the)\s+/i, '').toLowerCase(), cafe.name.toLowerCase())
  const kitchen = detectProse('Colette pours the tea in the kitchen. Colette waits.').places.find(place => /kitchen/i.test(place.name))
  assert.ok(kitchen)
  assert.notEqual(kitchen.description.replace(/^(?:a|an|the)\s+/i, '').toLowerCase(), kitchen.name.toLowerCase())
})
