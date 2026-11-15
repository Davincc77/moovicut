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
  const board = createStoryboard({ premise, model: 'grok', aspectRatio: '16:9', promptStyle: 'detailed' })
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

test('Sora, ChatGPT video, Midjourney video, MiniMax Hailuo, ByteDance Seedance, Pika, Kling, Luma, and Wan snap only to documented lengths', () => {
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

test('ChatGPT video stays separate from Sora and uses the generic defaults', () => {
  const chatgpt = profileFor('chatgpt')
  assert.notEqual(chatgpt.id, profileFor('sora').id)
  assert.equal(chatgpt.available, false)
  assert.equal(chatgpt.durations.unverified, true)
  assert.equal(Array.isArray(chatgpt.aspects), false)
  assert.equal(chatgpt.sources.every(item => item.checked === '2026-11-16'), true)
  assert.match(chatgpt.sources.map(item => item.url).join('\n'), /help\.openai\.com/)
  assert.match(chatgpt.sources.map(item => item.url).join('\n'), /developers\.openai\.com/)
  assert.equal(snapDuration(3, chatgpt), 3)
  const board = createStoryboard({ premise, model: 'chatgpt' })
  assert.equal(board.model, 'chatgpt')
  assert.equal(board.duration, 3)
  assert.equal(assessProject(board).some(item => item.shotId && item.code === 'midjourney_high_motion'), false)
})

test('Midjourney video offers the documented 5 second generation', () => {
  const profile = profileFor('mj')
  assert.equal(profile.id, 'midjourney')
  assert.deepEqual(allowedDurations(profile), [5])
  assert.equal(snapDuration(3, profile), 5)
  assert.equal(profile.durationNote.includes('21'), true)
  assert.deepEqual(profile.aspects, ['1:1', '4:3', '2:3', '16:9', '1:2'])
  assert.equal(profile.aspects.includes('9:16'), false)
  assert.equal(profile.features.seed.supported, false)
  assert.equal(profile.weakSpots[0].code, 'midjourney_high_motion')
  assert.equal(profile.sources.every(item => item.checked === '2026-11-16'), true)
  const board = createStoryboard({ premise, model: 'midjourney' })
  assert.equal(board.shots[0].duration, 5)
  assert.equal(assessProject(board).some(item => item.code === 'midjourney_high_motion'), false)
})

test('Hailuo uses the documented 6 and 10 second lengths and no aspect ratio', () => {
  const profile = profileFor('minimax')
  assert.equal(profile.id, 'hailuo')
  assert.equal(profile.providerModel, 'MiniMax-Hailuo-2.3')
  assert.deepEqual(allowedDurations(profile), [6, 10])
  assert.equal(snapDuration(3, profile), 6)
  assert.equal(profile.maxPromptLength, 2000)
  assert.equal(profile.aspects.unverified, true)
  assert.equal(snapAspect('4:5', profile), '4:5')
  assert.equal(profile.features.seed.unverified, true)
  assert.equal(profile.sources[0].checked, '2026-11-16')
  const board = createStoryboard({ premise, model: 'hailuo' })
  assert.equal(board.shots[0].duration, 6)
  const warnings = assessProject(board).filter(item => item.code === 'hailuo_prompt_optimizer')
  assert.equal(warnings.length, 1)
})

test('Seedance offers the documented 4–15 second range and the listed ratios', () => {
  const profile = profileFor('bytedance')
  assert.equal(profile.id, 'seedance')
  assert.equal(profile.providerModel, 'dreamina-seedance-2-0-260128')
  assert.equal(snapDuration(3, profile), 4)
  assert.equal(snapDuration(10, profile), 10)
  assert.equal(snapDuration(20, profile), 15)
  assert.equal(profile.aspects.includes('9:16'), true)
  assert.equal(profile.aspects.includes('21:9'), true)
  assert.equal(snapAspect('21:9', profile), '16:9')
  assert.equal(profile.features.seed.supported, true)
  assert.equal(profile.features.negativePrompt.unverified, true)
  assert.equal(profile.idealPromptLength.unverified, undefined)
  assert.equal(profile.durationNote.includes('16–30'), true)
  assert.equal(profile.sources.every(item => item.checked === '2026-11-16'), true)
  const board = createStoryboard({ premise, model: 'seedance' })
  assert.equal(board.shots[0].duration, 4)
})

test('Pika offers 5 and 10 seconds, a seed, and a negative prompt', async () => {
  const profile = profileFor('pika')
  assert.deepEqual(allowedDurations(profile), [5, 10])
  assert.equal(snapDuration(3, profile), 5)
  assert.equal(snapDuration(8, profile), 10)
  assert.equal(profile.aspects.includes('4:5'), true)
  assert.equal(profile.aspects.includes('9:16'), true)
  assert.equal(profile.features.seed.supported, true)
  assert.equal(profile.features.negativePrompt.supported, true)
  assert.equal(profile.idealPromptLength.unverified, true)
  assert.equal(profile.sources[0].url, 'https://dev.pika.art/llms/pika/pika-2.5/text-to-video')
  assert.equal(profile.sources[0].checked, '2026-11-16')
  const response = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, model: 'pika' })
  })
  const body = JSON.parse(response.body)
  assert.equal(response.status, 200)
  assert.equal(body.model, 'pika')
  assert.equal(body.shots[0].duration, 5)
  assert.equal(body.modelProfile.id, 'pika')
  assert.equal(body.modelProfile.features.negativePrompt.supported, true)
  const agent = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, model: 'pika', format: 'agent' })
  })
  const board = JSON.parse(agent.body)
  assert.equal(agent.status, 200)
  assert.equal(board.schema, 'shotboard.compact.v1')
  assert.equal(board.model, 'pika')
  assert.equal(board.shots[0].duration, 5)
})
