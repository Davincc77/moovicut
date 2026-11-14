import test from 'node:test'
import assert from 'node:assert/strict'
import { MODEL_PROFILES, allowedDurations, profileFor, publicProfile, snapAspect, snapDuration } from '../app/utils/model-profiles.js'
import { applyModelProfile, createStoryboard } from '../app/utils/prompt-engine.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const premise = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'

test('every named profile cites an official page, and generic stays unverified', () => {
  for (const id of ['grok', 'google', 'sora', 'kling', 'runway', 'luma', 'wan']) {
    const profile = MODEL_PROFILES[id]
    assert.ok(profile.sources.length >= 1, id)
    profile.sources.forEach(item => {
      assert.match(item.url, /^https:\/\//)
      assert.equal(item.checked, '2026-11-14')
    })
  }
  assert.equal(MODEL_PROFILES.generic.durations.unverified, true)
  assert.equal(MODEL_PROFILES.generic.sources.length, 0)
  assert.equal(MODEL_PROFILES.grok.idealPromptLength.unverified, true)
  assert.deepEqual(MODEL_PROFILES.sora.unverifiedDurations, [16, 20])
  assert.equal(MODEL_PROFILES.sora.available, false)
})

test('Veo accepts only 4, 6, and 8 seconds in 16:9 or 9:16', () => {
  const veo = profileFor('veo')
  assert.equal(veo.id, 'google')
  assert.deepEqual(veo.durations.values, [4, 6, 8])
  assert.deepEqual(veo.aspects, ['16:9', '9:16'])
  const board = createStoryboard({ premise, model: 'google' })
  assert.equal(board.duration, 4)
  assert.equal(board.shots[0].duration, 4)
  assert.equal(board.aspectRatio, '16:9')
  const held = createStoryboard({ premise, model: 'google', duration: 6, aspectRatio: '9:16' })
  assert.equal(held.duration, 6)
  assert.equal(held.aspectRatio, '9:16')
  assert.equal(snapAspect('4:5', veo), '9:16')
  assert.equal(snapAspect('1:1', veo), '9:16')
})

test('a grok board stays 5 × 3s and a hand-edited prompt survives a model change', () => {
  const board = createStoryboard({ premise, model: 'grok', aspectRatio: '16:9' })
  assert.equal(board.shots.length, 5)
  assert.equal(board.duration, 3)
  assert.equal(assessProject(board).length, 0)
  const edited = board.shots[1].prompt
  board.shots[1].prompt = 'KEEP THIS LINE'
  board.shots[1].promptEdited = true
  const next = applyModelProfile(board, 'runway')
  assert.equal(next.model, 'runway')
  assert.equal(next.shots[1].prompt, 'KEEP THIS LINE')
  assert.notEqual(next.shots[0].prompt, board.shots[0].prompt)
  assert.match(next.shots[0].prompt, /Camera:/)
  assert.doesNotMatch(next.shots[0].prompt, /^CAMERA:/m)
  assert.equal(next.filmSheet.characters[0].name, board.filmSheet.characters[0].name)
  assert.ok(next.shots.every(shot => shot.duration >= 2 && shot.duration <= 10))
  assert.equal(edited.length > 0, true)
})

test('Sora, Kling, Luma, and Wan snap only to documented lengths', () => {
  assert.deepEqual(allowedDurations(profileFor('sora')), [4, 8, 12])
  assert.equal(snapDuration(3, profileFor('sora')), 4)
  assert.equal(snapDuration(3, profileFor('kling')), 3)
  assert.equal(snapDuration(20, profileFor('kling')), 15)
  assert.equal(snapDuration(3, profileFor('luma')), 5)
  assert.deepEqual(allowedDurations(profileFor('luma')), [5, 9])
  assert.equal(snapDuration(3, profileFor('wan')), 3)
  assert.equal(snapDuration(7, profileFor('generic')), 7)
  const sora = createStoryboard({ premise, model: 'sora', duration: 8 })
  assert.ok(assessProject(sora).some(item => item.code === 'sora_long_clip'))
  const quoted = createStoryboard({ premise, model: 'google', duration: 6 })
  quoted.shots[0].action = 'She says "Not this one." and waits.'
  quoted.shots[0].what = quoted.shots[0].action
  assert.equal(assessProject(quoted).some(item => item.code === 'on_screen_text'), false)
})

test('the API accepts a target model and keeps the default compact keys', async () => {
  const response = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, model: 'sora' })
  })
  const body = JSON.parse(response.body)
  assert.equal(response.status, 200)
  assert.equal(body.model, 'sora')
  assert.equal(body.shots[0].duration, 4)
  assert.equal(body.modelProfile.id, 'sora')
  assert.match(body.modelProfile.sources[0].url, /^https:\/\/developers\.openai\.com\//)
  const compact = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, compact: true })
  })
  const short = JSON.parse(compact.body)
  assert.deepEqual(Object.keys(short).sort(), ['aspectRatio', 'model', 'premise', 'shots', 'studioUrl', 'title'])
  const refused = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, model: 'unknown-model' })
  })
  assert.equal(refused.status, 400)
  assert.equal(publicProfile('veo').id, 'google')
})
