import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeStudioBoard, decodeStudioBoard, studioUrl, STUDIO_LINK_MAX } from '../app/utils/studio-link.js'
import { storyMarkdown } from '../app/utils/story-markdown.js'
import { createStoryboard } from '../app/utils/prompt-engine.js'

test('a studio hash round-trips options and scenes inside the size limit', () => {
  const options = {
    premise: 'A lighthouse keeper races the dusk to repair a failing beacon.',
    model: 'google',
    shots: 5,
    duration: 3,
    sequenceMode: 'continuous',
    continuityStrength: 'strict',
    density: 'concise',
    aspectRatio: '9:16',
    style: 'Normal',
    stepByStep: true,
    scenes: [{ action: 'The keeper climbs the stairs.', duration: 3, lighting: 'Blue hour', notes: 'Gulls' }]
  }
  const token = encodeStudioBoard(options)
  assert.ok(token.length <= STUDIO_LINK_MAX)
  const decoded = decodeStudioBoard(token)
  assert.equal(decoded.premise, options.premise)
  assert.equal(decoded.model, 'google')
  assert.equal(decoded.sequenceMode, 'continuous')
  assert.equal(decoded.continuity, 'strict')
  assert.equal(decoded.density, 'concise')
  assert.equal(decoded.aspectRatio, '9:16')
  assert.equal(decoded.scenes[0].notes, 'Gulls')
  const url = studioUrl('https://moovicut.studio', options)
  assert.match(url, /^https:\/\/moovicut\.studio\/studio#board=/)
  assert.equal(decodeStudioBoard('not valid'), null)
  assert.equal(decodeStudioBoard(''), null)
  assert.equal(encodeStudioBoard({ premise: 'short', model: 'grok' }), '')
})

test('markdown export is a readable shot sheet', () => {
  const project = createStoryboard({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.', count: 2, duration: 3 })
  const markdown = storyMarkdown(project)
  assert.match(markdown, /^# /)
  assert.match(markdown, /## Shot 1/)
  assert.match(markdown, /Duration: 3s/)
  assert.match(markdown, /```/)
  assert.ok(markdown.includes(project.shots[0].prompt))
})
