import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, parseCharacter, splitShotByAction } from '../app/utils/prompt-engine.js'
import { detectProse } from '../app/utils/prose-detect.js'
import { assessProject, assessShot } from '../app/utils/shot-risk.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const MAYA = 'Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.'
const LEA = 'Léa, curly hair and round glasses, wears a green apron in a small morning cafe. She pours a latte. She laughs.'

function person(board, name) {
  return board.filmSheet.characters.find(item => item.name === name)
}

test('a plain Maya and Rui premise keeps both people, the quay, and the real actions', () => {
  assert.equal(parseCharacter(MAYA), 'Maya')
  const board = createStoryboard({ premise: MAYA, model: 'grok' })
  const maya = person(board, 'Maya')
  const rui = person(board, 'Rui')
  assert.equal(board.filmSheet.characters.map(item => item.name).join(', '), 'Maya, Rui')
  assert.match(maya.look, /early 30s/)
  assert.match(maya.look, /short black pixie cut/)
  assert.doesNotMatch(maya.look, /coat/)
  assert.match(maya.outfit, /charcoal wool coat/)
  assert.doesNotMatch(maya.outfit, /pixie/)
  assert.match(rui.look, /50s/)
  assert.match(rui.look, /grey stubble/)
  assert.doesNotMatch(rui.look, /peacoat|scarf/)
  assert.match(rui.outfit, /navy peacoat/)
  assert.match(rui.outfit, /rust-red scarf/)
  assert.match(board.filmSheet.places[0].name, /rainy quay/i)
  assert.equal(board.shots.length, 3)
  assert.match(board.shots[0].action, /hands him a letter/)
  assert.match(board.shots[0].who, /Maya/)
  assert.match(board.shots[0].who, /Rui/)
  assert.match(board.shots[1].action, /reads it/)
  assert.equal(board.shots[1].who, 'Rui')
  assert.match(board.shots[2].action, /walks away/)
  assert.equal(board.shots[2].who, 'Rui')
  assert.match(board.shots[0].prompt, /Maya — early 30s, short black pixie cut, charcoal wool coat\./)
  assert.match(board.shots[0].prompt, /Rui — 50s, grey stubble, navy peacoat, rust-red scarf\./)
  assert.doesNotMatch(board.shots[1].prompt, /Maya —/)
  assert.match(board.shots[1].prompt, /Rui — 50s, grey stubble, navy peacoat, rust-red scarf\./)
  assert.doesNotMatch(board.shots.map(shot => shot.action).join('\n'), /One new detail appears|Charcoal wool coat entering/)
  const codes = assessProject(board).map(item => item.code)
  assert.ok(codes.includes('hands_or_held_object'))
  assert.equal(codes.includes('too_many_actions'), false)
})

test('the same paragraph as prose returns shots, and an unusable paragraph is 400', () => {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: MAYA, model: 'grok' })
  })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.input, 'prose')
  assert.equal(body.shots.length, 3)
  assert.match(body.shots[0].prompt, /hands him a letter/)
  assert.match(body.shots[1].prompt, /reads it/)
  assert.match(body.shots[2].prompt, /walks away/)
  assert.equal(body.error, undefined)

  const lea = detectProse(LEA)
  assert.equal(lea.characters.length, 1)
  assert.equal(lea.characters[0].name, 'Léa')
  assert.match(lea.characters[0].look, /curly hair/)
  assert.match(lea.characters[0].look, /round glasses/)
  assert.match(lea.characters[0].outfit, /green apron/)
  assert.ok(lea.places.some(place => /caf/i.test(place.name)))
  assert.deepEqual(lea.scenes.map(scene => scene.what), ['She pours a latte', 'She laughs'])
  const cafe = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: LEA, model: 'grok' })
  })
  assert.equal(cafe.status, 200)
  const cafeBody = JSON.parse(cafe.body)
  assert.equal(cafeBody.shots.length, 2)
  assert.match(cafeBody.shots[0].prompt, /Léa — curly hair, round glasses, green apron\./)
  assert.equal(assessProject(cafeBody).some(item => item.code === 'too_many_actions'), false)

  const bad = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: 'The morning light hits the street. A bird flies over the city.' })
  })
  assert.equal(bad.status, 400)
  const failed = JSON.parse(bad.body)
  assert.equal(failed.error, 'invalid_scenario')
  assert.equal(failed.shots, undefined)
  assert.ok(failed.errors.length >= 2)
  failed.errors.forEach(item => assert.match(failed.message, new RegExp(item.message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
})

test('a names-only scenario lists each problem instead of a count', () => {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({
      scenario: { characters: [{ name: 'Maya' }], places: [{ name: 'Quay' }], scenes: [{ who: 'Maya', where: 'Quay' }] },
      model: 'grok'
    })
  })
  assert.equal(response.status, 400)
  const body = JSON.parse(response.body)
  assert.equal(body.error, 'invalid_scenario')
  assert.equal(body.errors.length, 4)
  for (const piece of ['missing a look', 'missing an outfit', 'missing a description', 'missing what happens']) {
    assert.match(body.message, new RegExp(piece))
  }
  assert.doesNotMatch(body.message, /has \d+ problems|Add at least one/)
})

test('He walks away is one action, and repeated what plus action is not counted twice', () => {
  const shot = { id: 'shot-01', order: 1, duration: 3, what: 'He walks away', action: 'He walks away' }
  assert.equal(assessShot(shot, { duration: 3 }).some(item => item.code === 'too_many_actions'), false)
  const board = createStoryboard({
    scenario: {
      characters: [{ name: 'Rui', look: 'grey stubble', outfit: 'navy peacoat' }],
      places: [{ name: 'Quay', description: 'a rainy quay' }],
      scenes: [
        { who: 'Rui', where: 'Quay', what: 'He walks away', duration: 3 },
        { who: 'Léa', where: 'Quay', what: 'She pours a latte', duration: 3 },
        { who: 'Léa', where: 'Quay', what: 'She laughs', duration: 3 }
      ]
    }
  })
  assert.equal(assessProject(board).some(item => item.code === 'too_many_actions'), false)
  const doubled = assessShot({ id: 'shot-02', order: 1, duration: 3, what: 'She pours a latte and then she runs', action: 'She pours a latte and then she runs' }, { duration: 3 })
  assert.ok(doubled.some(item => item.code === 'too_many_actions'))
})

test('the API splits multi-action shots unless splitActions is false, and the studio helper still splits one shot', () => {
  const scenario = {
    characters: [{ name: 'Maya', look: 'early 30s, short black pixie cut', outfit: 'charcoal wool coat' }, { name: 'Rui', look: '50s, grey stubble', outfit: 'navy peacoat, rust-red scarf' }],
    places: [{ name: 'Quay', description: 'a rainy quay' }],
    scenes: [{ who: 'Maya and Rui', where: 'Quay', what: 'Maya hands Rui a letter. He reads it and walks away.', duration: 3 }]
  }
  const split = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ scenario, model: 'grok', compact: true })
  })
  assert.equal(split.status, 200)
  const splitBody = JSON.parse(split.body)
  assert.equal(splitBody.shots.length, 3)
  assert.match(splitBody.shots[0].prompt, /hands Rui a letter/)
  assert.match(splitBody.shots[1].prompt, /reads it/)
  assert.match(splitBody.shots[2].prompt, /walks away/)

  const kept = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ scenario, model: 'grok', compact: true, splitActions: false })
  })
  const keptBody = JSON.parse(kept.body)
  assert.equal(keptBody.shots.length, 1)
  assert.match(keptBody.shots[0].prompt, /reads it and walks away/)

  const edited = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({
      scenario: {
        ...scenario,
        scenes: [{ who: 'Maya and Rui', where: 'Quay', what: 'Maya hands Rui a letter. He reads it and walks away.', prompt: 'HAND WRITTEN' }]
      },
      model: 'grok',
      compact: true
    })
  })
  const editedBody = JSON.parse(edited.body)
  assert.equal(editedBody.shots.length, 1)
  assert.equal(editedBody.shots[0].prompt, 'HAND WRITTEN')

  const studio = createStoryboard({ scenario, model: 'grok' })
  assert.equal(studio.shots.length, 1)
  const fixed = splitShotByAction(studio, studio.shots[0].id)
  assert.equal(fixed.shots.length, 3)
  assert.match(fixed.shots[2].action, /walks away/)
})

test('format agent includes warnings', () => {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({
      premise: MAYA,
      model: 'grok',
      format: 'agent'
    })
  })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.schema, 'shotboard.compact.v1')
  assert.equal(body.filmSheet.characters[0].name, 'Maya')
  assert.ok(body.warnings.some(item => item.code === 'hands_or_held_object'))
  assert.equal(body.warnings.some(item => item.code === 'too_many_actions'), false)
})
