import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, applyStylePreset, applyModelProfile, regenerateOneShot } from '../app/utils/prompt-engine.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const premise = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'

function post(body) {
  return dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body),
    origin: 'https://moovicut.studio'
  })
}

test('an ad locks the product into four shots', () => {
  const board = createStoryboard({
    mode: 'ad',
    product: 'Sunlit pear',
    benefit: 'A cold pear that stays crisp in the sun.',
    cta: 'Taste one today',
    model: 'grok',
    duration: 3
  })
  assert.equal(board.sequenceMode, 'ad')
  assert.equal(board.aspectRatio, '9:16')
  assert.deepEqual(board.shots.map(shot => shot.stage), ['Hook', 'Hero', 'Proof', 'Pack shot'])
  assert.equal(board.filmSheet.product.name, 'Sunlit pear')
  assert.equal(board.shots.every(shot => shot.prompt.includes('Sunlit pear')), true)
  assert.equal(board.shots.every(shot => shot.duration === 3), true)
})

test('a series shares one film sheet across 3 to 8 episodes', () => {
  const board = createStoryboard({
    mode: 'series',
    seriesTitle: 'Morning shift',
    hook: 'The same barista opens the same cafe.',
    episodes: 3,
    character: 'Léa',
    place: 'Cafe'
  })
  assert.equal(board.shots.length, 9)
  assert.equal(board.aspectRatio, '9:16')
  assert.equal(board.filmSheet.characters[0].name, 'Léa')
  assert.equal(board.filmSheet.places[0].name, 'Cafe')
  assert.equal(new Set(board.shots.map(shot => shot.who)).size, 1)
  assert.equal(new Set(board.shots.map(shot => shot.where)).size, 1)
  for (const count of [2, 9]) {
    const rejected = post({ mode: 'series', seriesTitle: 'Morning shift', hook: 'The same barista opens the same cafe.', episodes: count })
    assert.equal(rejected.status, 400)
    const body = JSON.parse(rejected.body)
    assert.ok(Array.isArray(body.errors))
    assert.match(body.errors.map(item => item.message).join(' '), /3 to 8/)
  }
})

test('an explainer uses one shot per step and snaps duration to the model', () => {
  const steps = ['Rinse the pear under cold water.', 'Slice it into thin pieces.', 'Serve it on a cold plate.']
  const grok = createStoryboard({ mode: 'explainer', topic: 'How to plate a pear', steps, model: 'grok', duration: 3 })
  assert.equal(grok.shots.length, steps.length)
  assert.deepEqual(grok.shots.map(shot => shot.action), steps)
  assert.equal(grok.aspectRatio, '16:9')
  assert.equal(grok.shots.every(shot => shot.duration === 3), true)
  const google = createStoryboard({ mode: 'explainer', topic: 'How to plate a pear', steps, model: 'google', duration: 3 })
  assert.equal(google.shots.every(shot => shot.duration === 4), true)
  const luma = createStoryboard({ mode: 'explainer', topic: 'How to plate a pear', steps, model: 'luma', duration: 3 })
  assert.equal(luma.shots.every(shot => shot.duration === 5), true)
})

test('promptEdited stays on preset boards unless overwritePrompt is set', () => {
  const board = createStoryboard({
    mode: 'explainer',
    topic: 'How to plate a pear',
    steps: [
      { text: 'Rinse the pear under cold water.', prompt: 'HAND EDITED FIRST SHOT' },
      'Slice it into thin pieces.'
    ]
  })
  assert.equal(board.shots[0].promptEdited, true)
  assert.equal(board.shots[0].prompt, 'HAND EDITED FIRST SHOT')
  const styled = applyStylePreset(board, 'cinema', 'drama')
  assert.equal(styled.shots[0].prompt, 'HAND EDITED FIRST SHOT')
  assert.equal(styled.shots[0].promptEdited, true)
  const retargeted = applyModelProfile(styled, 'google')
  assert.equal(retargeted.shots[0].prompt, 'HAND EDITED FIRST SHOT')
  assert.equal(retargeted.shots[1].duration, 4)
  const kept = regenerateOneShot(retargeted, retargeted.shots[0].id)
  assert.equal(kept.skipped, true)
  assert.equal(kept.project.shots[0].prompt, 'HAND EDITED FIRST SHOT')
  const other = regenerateOneShot(retargeted, retargeted.shots[1].id)
  assert.equal(other.skipped, false)
  assert.equal(other.project.shots[0].prompt, 'HAND EDITED FIRST SHOT')
  assert.match(other.project.shots[1].prompt, /Slice it into thin pieces/)
  const replaced = createStoryboard({
    mode: 'explainer',
    topic: 'How to plate a pear',
    overwritePrompt: true,
    steps: [{ text: 'Rinse the pear under cold water.', prompt: 'HAND EDITED FIRST SHOT' }]
  })
  assert.equal(replaced.shots[0].promptEdited, undefined)
  assert.doesNotMatch(replaced.shots[0].prompt, /HAND EDITED FIRST SHOT/)
})

test('a normal premise stays a 5 by 3 continuous board and an unknown mode is rejected', () => {
  const board = createStoryboard({ premise })
  assert.equal(board.shots.length, 5)
  assert.equal(board.shots.every(shot => shot.duration === 3), true)
  assert.equal(board.sequenceMode, undefined)
  const planned = JSON.parse(post({ premise }).body)
  assert.equal(planned.sequenceMode, 'continuous')
  assert.equal(planned.shots.length, 5)
  const continuous = createStoryboard({ premise, sequenceMode: 'continuous', product: 'Sunlit pear', benefit: 'A cold pear that stays crisp in the sun.' })
  assert.equal(continuous.sequenceMode, 'continuous')
  assert.equal(continuous.shots.length, 5)
  const rejected = post({ premise, mode: 'montage' })
  assert.equal(rejected.status, 400)
  assert.match(JSON.parse(rejected.body).message, /continuous.*varied.*scenario.*ad.*series.*explainer/)
})
