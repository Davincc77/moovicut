import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { isNonPlaceNoun } from '../app/utils/place-lexicon.js'
import { createStoryboard } from '../app/utils/prompt-engine.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { legacyRedirectTarget } from '../server/prod-server.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

test('an empty where omits the PLACE line and does not fall back to the first place', () => {
  const project = createStoryboard({
    scenario: {
      characters: [{ name: 'Nia', look: '30, short black hair', outfit: 'grey coat' }],
      places: [{ name: 'Kitchen', description: 'a bright kitchen' }, { name: 'Garden', description: 'a walled garden' }],
      scenes: [
        { who: 'Nia', where: 'Kitchen', what: 'Nia waits' },
        { who: 'Nia', where: '', what: 'Nia reads' }
      ]
    },
    allowMissingWhere: true,
    model: 'grok'
  })
  assert.match(project.shots[0].prompt, /PLACE: Kitchen/)
  assert.equal(project.shots[1].where, '')
  assert.doesNotMatch(project.shots[1].prompt, /PLACE:/)
  assert.doesNotMatch(project.shots[1].prompt, /Kitchen|Garden/)
})

test('in place, in a circle, and van speakers are not places', () => {
  for (const phrase of ['place', 'circle', 'van speakers', 'speakers', 'van']) {
    assert.equal(isNonPlaceNoun(phrase), true, phrase)
  }
  const cases = [
    'Nia waits in place. Nia looks at the map.',
    'Nia waits in a circle. Nia looks around.',
    'Nia waits in the van speakers. Nia looks.'
  ]
  for (const text of cases) {
    const found = detectProse(text)
    const labels = found.places.map(place => place.name).join(' | ')
    assert.doesNotMatch(labels, /place|circle|van|speaker/i, labels)
    assert.ok(found.scenes.every(scene => !scene.where), found.scenes.map(scene => scene.where).join(' > '))
  }
})

test('a place carries forward only after a locative or an arrival, not from a bare noun', () => {
  const bare = detectProse('The kitchen is quiet. Nia waits. Nia reads a letter.')
  assert.ok(bare.places.some(place => /kitchen/i.test(place.name)))
  assert.ok(bare.scenes.every(scene => !scene.where), bare.scenes.map(scene => scene.where).join(' > '))
  const cued = detectProse('Nia waits in the kitchen. The greenhouse is quiet. Nia waits in the greenhouse.')
  assert.deepEqual(cued.scenes.map(scene => scene.where), ['Kitchen', 'Greenhouse'])
  assert.equal(cued.scenes.some(scene => /quiet/i.test(scene.what)), false)
  const bank = detectProse('The bank is quiet. Nia waits. Nia waits in the bank.')
  assert.equal(bank.scenes[0].where, '')
  assert.match(bank.scenes.at(-1).where, /bank/i)
})

test('time of day carries only until the next time cue', () => {
  const nextDay = detectProse('At dawn, Mara waits in the kitchen. Mara opens the door. The next day, Mara walks to the lighthouse. Mara reads a map.')
  assert.equal(nextDay.scenes[0].light, 'dawn')
  assert.equal(nextDay.scenes[1].light, 'dawn')
  assert.equal(nextDay.scenes[2].light, '')
  assert.equal(nextDay.scenes[3].light, '')
  const later = detectProse('At dawn, Nia waits in the kitchen. Later, Nia walks to the garden.')
  assert.equal(later.scenes[0].light, 'dawn')
  assert.equal(later.scenes[1].light, '')
  const noon = detectProse('At dawn Wilhelmina walks up to the old bothy on the moor. At noon Wilhelmina reaches the lighthouse. Wilhelmina reads a map.')
  assert.equal(noon.scenes[0].light, 'dawn')
  assert.equal(noon.scenes[1].light, 'day')
  assert.equal(noon.scenes[2].light, 'day')
  const planned = plan({ input: 'prose', prose: 'At dawn, Mara waits in the kitchen. The next day, Mara walks to the lighthouse.', model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(planned.body.shots[0].prompt, /dawn/i)
  assert.doesNotMatch(planned.body.shots.at(-1).prompt, /\bdawn\b/i)
})

test('a lock line is included when the character is named in the action, and a non-lead keeps age, hair, outfit, and a held item', () => {
  const board = createStoryboard({
    scenario: {
      characters: [
        { name: 'Maya', look: 'early 30s, short black hair', outfit: 'charcoal coat' },
        { name: 'Rui', look: '50s, grey stubble', outfit: 'navy peacoat' }
      ],
      places: [{ name: 'Quay', description: 'a rainy quay' }],
      scenes: [{ who: 'Maya', where: 'Quay', what: 'Maya hands Rui a letter' }]
    },
    model: 'grok'
  })
  assert.match(board.shots[0].prompt, /Maya — early 30s/)
  assert.match(board.shots[0].prompt, /Rui — 50s, grey stubble, navy peacoat/)
  const english = detectProse('Nia, 30, short black hair, grey coat, a tin whistle, meets Rui, 19, short brown hair, denim jacket, a brass compass, on the quay. Rui waits.')
  const rui = english.characters.find(person => person.name === 'Rui')
  const nia = english.characters.find(person => person.name === 'Nia')
  assert.notEqual(rui.look, '19')
  assert.match(rui.look, /19/)
  assert.match(rui.look, /short brown hair/)
  assert.match(rui.outfit, /denim jacket/)
  assert.match(`${rui.look} ${rui.outfit}`, /compass/)
  assert.match(`${nia.look} ${nia.outfit}`, /whistle/)
  assert.match(nia.look, /30/)
  assert.match(nia.look, /short black hair/)
  assert.match(nia.outfit, /grey coat/)
  const portuguese = detectProse('Ines, 41, cabelo preto, casaco azul, um apito, encontra Rui, 19, barba curta, casaco verde, uma lanterna, no cais. Rui espera.')
  const second = portuguese.characters.find(person => person.name === 'Rui')
  assert.equal(portuguese.language, 'pt')
  assert.match(second.look, /19/)
  assert.match(second.look, /barba/)
  assert.match(second.outfit, /casaco/)
  assert.match(second.outfit, /lanterna/)
  assert.notEqual(second.outfit, '')
})

test('Chinese is not a site or prompt language, and old /zh paths redirect to English', () => {
  const rejected = plan({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.', promptLanguage: 'zh-Hans', model: 'grok' })
  assert.equal(rejected.status, 400)
  assert.equal(rejected.body.error, 'invalid_prompt_language')
  assert.match(rejected.body.message, /en, pt/)
  assert.doesNotMatch(rejected.body.message, /zh-Hans/)
  assert.equal(legacyRedirectTarget('/zh'), '/')
  assert.equal(legacyRedirectTarget('/zh-Hans'), '/')
  assert.equal(legacyRedirectTarget('/zh/studio'), '/studio')
  const chinese = detectProse('赵明远在厨房等待。赵明远拿着一封信。')
  assert.notEqual(chinese.language, 'zh-Hans')
})
