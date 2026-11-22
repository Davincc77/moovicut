import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, splitShotByAction } from '../app/utils/prompt-engine.js'
import { lockLineFor } from '../app/utils/character-lock.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const LIGHTHOUSE = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'
const MAYA = 'Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.'
const NORA_LINE = 'Nora — early 30s, short black hair, navy wool coat.'
const ELIAS_LINE = 'Elias — 40s, grey beard, brown oilskin.'

const LIGHTHOUSE_COMPACT = "{\"title\":\"Lighthouse keeper races the dusk…\",\"premise\":\"A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.\",\"model\":\"grok\",\"aspectRatio\":\"16:9\",\"shots\":[{\"order\":1,\"duration\":3,\"prompt\":\"SHOT: Wide shot: A wide view of Lighthouse at dusk, with Lighthouse keeper entering the frame.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLIGHT: Dusk, warm amber light, deep shadows and muted gold.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"},{\"order\":2,\"duration\":3,\"prompt\":\"SHOT: Tracking shot: Lighthouse keeper. One new detail appears in Lighthouse and changes the next gesture.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLIGHT: Dusk, warm amber light, deep shadows and muted gold.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"},{\"order\":3,\"duration\":3,\"prompt\":\"SHOT: Extreme close-up: Lighthouse keeper chooses a direction and moves through Lighthouse.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLIGHT: Dusk, warm amber light, deep shadows and muted gold.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"},{\"order\":4,\"duration\":3,\"prompt\":\"SHOT: Over-the-shoulder: The result of that choice is visible around Lighthouse keeper.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLIGHT: Dusk, warm amber light, deep shadows and muted gold.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"},{\"order\":5,\"duration\":3,\"prompt\":\"SHOT: Tracking shot: The last image stays on Lighthouse keeper in Lighthouse.\\nLighthouse keeper — wool jacket, knit cap, weathered boots.\\nLIGHT: Dusk, warm amber light, deep shadows and muted gold.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"}]}"

const MAYA_COMPACT = "{\"title\":\"Maya, early 30s, short black…\",\"premise\":\"Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.\",\"model\":\"grok\",\"aspectRatio\":\"16:9\",\"shots\":[{\"order\":1,\"duration\":3,\"prompt\":\"SHOT: Wide shot: Maya hands him a letter.\\nMaya — early 30s, short black pixie cut, charcoal wool coat.\\nRui — 50s, grey stubble, navy peacoat, rust-red scarf.\\nPLACE: Rainy quay, a rainy quay.\\nLIGHT: Rain, wet dark tones, reflected light and cool teal.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\\nSimple hands, the held object stays the same shape.\"},{\"order\":2,\"duration\":3,\"prompt\":\"SHOT: Tracking shot: Rui reads it.\\nRui — 50s, grey stubble, navy peacoat, rust-red scarf.\\nPLACE: Rainy quay, a rainy quay.\\nLIGHT: Rain, wet dark tones, reflected light and cool teal.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"},{\"order\":3,\"duration\":3,\"prompt\":\"SHOT: Extreme close-up: Rui walks away.\\nRui — 50s, grey stubble, navy peacoat, rust-red scarf.\\nPLACE: Rainy quay, a rainy quay.\\nLIGHT: Rain, wet dark tones, reflected light and cool teal.\\nCAMERA: locked-off camera.\\nSTYLE: grounded cinematic realism, restrained colour palette, natural textures.\"}],\"warnings\":[{\"shotId\":\"shot-01\",\"order\":1,\"code\":\"hands_or_held_object\",\"message\":\"Hands or a held object are easy for a video model to melt or change shape.\",\"fix\":\"Keep the hands simple, and say the held object stays the same shape.\",\"action\":\"none\"}]}"

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
  delete copy.sha256 // envelope metadata, like studioUrl: the golden pins content
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

test('a 75-shot harbor story keeps every action and cuts only on scene boundaries', () => {
  const planned = plan({ scenario: harborStory(), model: 'grok', format: 'agent' })
  assert.equal(planned.status, 200, planned.body.message)
  const body = planned.body
  assert.equal(body.schema, 'shotboard.compact.v1')
  assert.equal(body.shots.length, 75)
  assert.deepEqual(body.parts, [
    { index: 1, from: 1, to: 33, place: 'Harbor', time: 'dusk' },
    { index: 2, from: 34, to: 61, place: 'Harbor', time: 'dusk' },
    { index: 3, from: 62, to: 75, place: 'Gallery', time: 'dusk' }
  ])
  const seen = body.shots.map(marker)
  assert.equal(seen[14], '15')
  assert.equal(seen[15], '1')
  assert.equal(marker(body.shots[32]), '18')
  assert.equal(marker(body.shots[33]), '1')
  assert.equal(marker(body.shots[60]), '16')
  assert.equal(marker(body.shots[61]), '1')
  assert.equal(seen.filter(Boolean).length, 75)
  body.parts.forEach(part => assert.ok(part.to - part.from + 1 <= 40))
  assert.equal((body.warnings || []).some(item => item.code === 'part_split_inside_scene'), false)
  body.shots.forEach(shot => {
    if (/Nora/.test(shot.who || '') || /Nora —/.test(shot.prompt || '')) assert.ok((shot.prompt || '').includes(NORA_LINE) || (shot.lockLines || []).includes(NORA_LINE))
    if (/\bElias\b/.test(shot.who || '') || (shot.prompt || '').includes('Elias —')) assert.ok((shot.lockLines || []).includes(ELIAS_LINE) || (shot.prompt || '').includes(ELIAS_LINE))
  })
  const project = createStoryboard({ scenario: harborStory(), model: 'grok' })
  const nora = project.filmSheet.characters.find(item => item.name === 'Nora')
  const elias = project.filmSheet.characters.find(item => item.name === 'Elias')
  assert.equal(lockLineFor(nora, 1), lockLineFor(nora, 50))
  assert.equal(lockLineFor(elias, 16), lockLineFor(elias, 70))
  body.parts.forEach(part => {
    const first = body.shots[part.from - 1]
    assert.equal(part.place, first.where)
    assert.equal(part.time, first.light || body.filmSheet.light)
  })
})

test('one scene longer than 40 shots is cut on a shot boundary and nothing is dropped', () => {
  const planned = plan({
    scenario: {
      characters: CAST.characters.slice(0, 1),
      places: CAST.places.slice(0, 1),
      light: 'dusk',
      scenes: [{ who: 'Nora', where: 'Harbor', what: actions('Nora', 'walks', 55), duration: 3 }]
    },
    model: 'grok',
    compact: true
  })
  assert.equal(planned.status, 200, planned.body.message)
  const body = planned.body
  assert.equal(body.shots.length, 55)
  assert.deepEqual(body.parts.map(part => [part.from, part.to]), [[1, 40], [41, 55]])
  assert.equal(body.parts[1].place, 'Harbor')
  assert.equal(body.parts[1].time, 'dusk')
  const numbers = body.shots.map(shot => Number(marker(shot)))
  assert.deepEqual(numbers, Array.from({ length: 55 }, (_, index) => index + 1))
  const inside = (body.warnings || []).filter(item => item.code === 'part_split_inside_scene')
  assert.equal(inside.length, 1)
  assert.equal(inside[0].order, 41)
})

test('the continuity checker runs across the part join on the same film sheet', () => {
  let project = createStoryboard({ scenario: harborStory(), model: 'grok' })
  for (let guard = 0; guard < 20; guard += 1) {
    let next = null
    for (const shot of project.shots) {
      next = splitShotByAction(project, shot.id)
      if (next) break
    }
    if (!next) break
    project = next
  }
  assert.equal(project.shots.length, 75)
  assert.equal(project.filmSheet.characters.map(item => item.name).join(', '), 'Nora, Elias')
  const warnings = assessProject(project)
  assert.equal(warnings.some(item => item.code === 'part_join'), false)
  assert.equal(warnings.some(item => item.code === 'part_split_inside_scene'), false)
  const nora = project.filmSheet.characters.find(item => item.name === 'Nora')
  const elias = project.filmSheet.characters.find(item => item.name === 'Elias')
  for (const order of [1, 33, 34, 61, 62, 75]) {
    assert.equal(lockLineFor(nora, order), NORA_LINE)
    assert.equal(lockLineFor(elias, order), ELIAS_LINE)
  }
})
