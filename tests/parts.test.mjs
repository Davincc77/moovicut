import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard } from '../app/utils/prompt-engine.js'
import { lockLineFor } from '../app/utils/character-lock.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const LIGHTHOUSE = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'
const MAYA = 'Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.'
const NORA_LINE = 'Nora — early 30s, short black hair, navy wool coat.'
const ELIAS_LINE = 'Elias — 40s, grey beard, brown oilskin.'

const LIGHTHOUSE_COMPACT = '{"title":"Lighthouse keeper races the dusk…","premise":"A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.","model":"grok","aspectRatio":"16:9","shots":[{"order":1,"duration":3,"prompt":"Wide shot: A wide view of Lighthouse at dusk, with Lighthouse keeper entering the frame.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLighthouse.\\nDusk, warm amber light, deep shadows and muted gold.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."},{"order":2,"duration":3,"prompt":"Tracking shot: Lighthouse keeper. One new detail appears in Lighthouse and changes the next gesture.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLighthouse.\\nDusk, warm amber light, deep shadows and muted gold.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."},{"order":3,"duration":3,"prompt":"Extreme close-up: Lighthouse keeper chooses a direction and moves through Lighthouse.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLighthouse.\\nDusk, warm amber light, deep shadows and muted gold.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."},{"order":4,"duration":3,"prompt":"Over-the-shoulder: The result of that choice is visible around Lighthouse keeper.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLighthouse.\\nDusk, warm amber light, deep shadows and muted gold.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."},{"order":5,"duration":3,"prompt":"Tracking shot: The last image stays on Lighthouse keeper in Lighthouse.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLighthouse.\\nDusk, warm amber light, deep shadows and muted gold.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."}]}'

const MAYA_COMPACT = '{"title":"Maya, early 30s, short black…","premise":"Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.","model":"grok","aspectRatio":"16:9","shots":[{"order":1,"duration":3,"prompt":"Wide shot: Maya hands him a letter.\\nMaya — early 30s, short black pixie cut, charcoal wool coat.\\nRui — 50s, grey stubble, navy peacoat, rust-red scarf.\\nRainy quay, a rainy quay.\\nRain, wet dark tones, reflected light and cool teal.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera.\\nSimple hands, the held object stays the same shape."},{"order":2,"duration":3,"prompt":"Tracking shot: Rui reads it.\\nRui — 50s, grey stubble, navy peacoat, rust-red scarf.\\nRainy quay, a rainy quay.\\nRain, wet dark tones, reflected light and cool teal.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."},{"order":3,"duration":3,"prompt":"Extreme close-up: Rui walks away.\\nRui — 50s, grey stubble, navy peacoat, rust-red scarf.\\nRainy quay, a rainy quay.\\nRain, wet dark tones, reflected light and cool teal.\\ngrounded cinematic realism, restrained colour palette, natural textures, locked-off camera."}],"warnings":[{"shotId":"shot-01","order":1,"code":"hands_or_held_object","message":"Hands or a held object are easy for a video model to melt or change shape.","fix":"Keep the hands simple, and say the held object stays the same shape."}]}'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function withoutStudio(body) {
  const copy = { ...body }
  delete copy.studioUrl
  return JSON.stringify(copy)
}

function actions(name, verb, count) {
  return Array.from({ length: count }, (_, index) => `${name} ${verb} ${index + 1}`).join('. ')
}

const CAST = {
  characters: [
    { name: 'Nora', look: 'early 30s, short black hair', outfit: 'navy wool coat' },
    { name: 'Elias', look: '40s, grey beard', outfit: 'brown oilskin' }
  ],
  places: [
    { name: 'Harbor', description: 'a stone harbor at dusk' },
    { name: 'Gallery', description: 'the lighthouse gallery in the wind' },
    { name: 'Lantern room', description: 'the lantern room above the stair' }
  ],
  light: 'dusk'
}

/** Five scenes, 15 + 18 + 12 + 16 + 14 shots. Cuts fall after scene 2 and scene 4. */
function harborStory() {
  const scenes = [
    { who: 'Nora', where: 'Harbor', what: actions('Nora', 'walks', 15) },
    { who: 'Elias', where: 'Gallery', what: actions('Elias', 'opens', 18) },
    { who: 'Nora', where: 'Harbor', what: actions('Nora', 'looks', 12) },
    { who: 'Nora and Elias', where: 'Lantern room', what: actions('Nora', 'lifts', 16) },
    { who: 'Elias', where: 'Gallery', what: actions('Elias', 'turns', 14) }
  ].map(scene => ({ ...scene, duration: 3 }))
  return { ...CAST, scenes }
}

function marker(shot) {
  return (shot.what || shot.prompt || '').match(/\b(?:walks|opens|looks|lifts|turns) (\d+)/)?.[1]
}

test('boards of 40 shots or fewer keep the previous payload', () => {
  const lighthouse = plan({ premise: LIGHTHOUSE, model: 'grok', compact: true })
  assert.equal(lighthouse.status, 200)
  assert.equal(withoutStudio(lighthouse.body), LIGHTHOUSE_COMPACT)
  assert.equal(lighthouse.body.parts, undefined)

  const maya = plan({ premise: MAYA, model: 'grok', compact: true })
  assert.equal(maya.status, 200)
  assert.equal(withoutStudio(maya.body), MAYA_COMPACT)
  assert.equal(maya.body.parts, undefined)

  const forty = plan({
    scenario: {
      ...CAST,
      scenes: Array.from({ length: 40 }, (_, index) => ({ who: 'Nora', where: 'Harbor', what: `Nora walks ${index + 1}`, duration: 3 }))
    },
    model: 'grok',
    compact: true
  })
  assert.equal(forty.status, 200)
  assert.equal(forty.body.shots.length, 40)
  assert.equal(forty.body.parts, undefined)
  assert.equal(JSON.stringify(forty.body).includes('"parts"'), false)
})

test('a 41-shot request is refused and a 40-shot request is kept whole', () => {
  const fortyOne = plan({
    scenario: {
      characters: CAST.characters.slice(0, 1),
      places: CAST.places.slice(0, 1),
      light: 'dusk',
      scenes: [{ who: 'Nora', where: 'Harbor', what: actions('Nora', 'walks', 41), duration: 3 }]
    },
    model: 'grok',
    compact: true
  })
  assert.equal(fortyOne.status, 400)
  assert.equal(fortyOne.body.error, 'too_many_shots')
  assert.match(fortyOne.body.message, /40/)
  assert.match(fortyOne.body.message, /character sheet/i)
  assert.equal(fortyOne.body.parts, undefined)
  const french = plan({
    premise: 'A lighthouse keeper races the dusk to repair a failing beacon.',
    shots: 41,
    model: 'grok',
    promptLanguage: 'fr',
    compact: true
  })
  assert.equal(french.status, 400)
  assert.match(french.body.message, /40/)
  assert.match(french.body.message, /chapitre/i)
})

test('a story longer than 40 shots is refused instead of split into parts', () => {
  const planned = plan({ scenario: harborStory(), model: 'grok', format: 'agent' })
  assert.equal(planned.status, 400)
  assert.equal(planned.body.error, 'too_many_shots')
  assert.equal(planned.body.parts, undefined)
  assert.equal(planned.body.shots, undefined)
  const project = createStoryboard({ scenario: harborStory(), model: 'grok' })
  assert.equal(project.parts, undefined)
  const nora = project.filmSheet.characters.find(item => item.name === 'Nora')
  const elias = project.filmSheet.characters.find(item => item.name === 'Elias')
  assert.equal(lockLineFor(nora, 1), lockLineFor(nora, 50))
  assert.equal(lockLineFor(elias, 16), lockLineFor(elias, 70))
})
