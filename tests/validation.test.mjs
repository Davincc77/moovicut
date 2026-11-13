import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, validateProject, normalizeProject, regenerateShotPrompts } from '../app/utils/prompt-engine.js'

test('import/export schema and every shot field survive a round trip', () => {
  const project = createStoryboard({ premise: 'A diver finds a luminous doorway in a submerged library.', model: 'google', count: 3 })
  const saved = validateProject(JSON.parse(JSON.stringify(project)))
  assert.equal(saved.project.model, 'google')
  assert.deepEqual(project, saved.project)
  const exported = JSON.parse(JSON.stringify(project))
  assert.equal(exported.schema, 'shotboard.v1')
  assert.equal(exported.target_model, 'google')
  for (const shot of project.shots) {
    assert.ok(shot.action && shot.lighting && shot.sound && shot.continuity && shot.prompt)
    assert.equal(shot.order, project.shots.indexOf(shot) + 1)
  }
})

test('compact exports preserve edited fields without inventing prompts', () => {
  const project = createStoryboard({ premise: 'A dancer waits for the last train beneath a flickering platform light.', count: 2 })
  const minimal = { schema: 'shotboard.v1', target_model: project.model, title: project.title, premise: project.premise, shots: project.shots.map(({ id, order, title, action, camera, framing, lens, lighting, sound, continuity, prompt, duration }) => ({ id, order, title, action, camera, framing, lens, lighting, sound, continuity, prompt, duration })) }
  const restored = normalizeProject(minimal)
  for (const [index, shot] of project.shots.entries()) {
    for (const field of ['id', 'order', 'title', 'action', 'camera', 'framing', 'lens', 'lighting', 'sound', 'continuity', 'prompt', 'duration']) assert.equal(restored.shots[index][field], shot[field])
  }
})

test('invalid schemas, types, duplicate IDs and excessive prompts are rejected', () => {
  const valid = createStoryboard({ premise: 'A gardener discovers a map beneath an old glasshouse.', count: 2 })
  for (const input of [null, [], {}, { ...valid, model: 'other' }, { ...valid, target_model: 'other', model: undefined }, { ...valid, shots: [] }, { ...valid, shots: Array(49).fill(valid.shots[0]) }, { ...valid, shots: [valid.shots[0], valid.shots[0]] }, { ...valid, schema: 'unknown.v99' }]) assert.throws(() => validateProject(input))
  assert.throws(() => validateProject({ ...valid, shots: [{ ...valid.shots[0], prompt: 'x'.repeat(16001) }] }))
  assert.throws(() => validateProject({ ...valid, shots: [{ ...valid.shots[0], id: { not: 'an ID' } }] }))
})

test('extreme durations are bounded and valid sound survives normalization', () => {
  const project = createStoryboard({ premise: 'A musician listens to the first rainfall after a long drought.', count: 1 })
  const normalized = normalizeProject({ ...project, shots: [{ ...project.shots[0], duration: 999, duration_seconds: undefined, sound: 'rain against a corrugated roof' }] })
  assert.equal(normalized.shots[0].duration, 15)
  assert.equal(normalized.shots[0].sound, 'rain against a corrugated roof')
})

test('model switching is explicit and retains stable shot identifiers', () => {
  const project = createStoryboard({ premise: 'Two friends build a solar radio for an approaching storm.', count: 3 })
  const google = regenerateShotPrompts({ ...project, model: 'google' })
  assert.equal(google.target_model, 'google')
  assert.ok(google.shots.every(shot => shot.prompt.includes('CAMERA:')))
  assert.deepEqual(project.shots.map(shot => shot.id), google.shots.map(shot => shot.id))
  const grok = regenerateShotPrompts(google, 'grok')
  assert.equal(grok.target_model, 'grok')
  assert.deepEqual(project.shots.map(shot => shot.id), grok.shots.map(shot => shot.id))
})
