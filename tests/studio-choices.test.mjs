import test from 'node:test'
import assert from 'node:assert/strict'
import { readStudioChoices, writeStudioChoices, STUDIO_CHOICES_KEY } from '../app/utils/studio-choices.js'

function memory() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

test('the last style, model, and sequence mode stay in local storage only', () => {
  const storage = memory()
  assert.deepEqual(writeStudioChoices(storage, { style: 'Spicy', model: 'google' }), { style: 'Spicy', model: 'google', sequenceMode: 'continuous', aspectRatio: '16:9', continuityStrength: 'standard', promptDensity: 'standard' })
  assert.deepEqual(readStudioChoices(storage), { style: 'Spicy', model: 'google', sequenceMode: 'continuous', aspectRatio: '16:9', continuityStrength: 'standard', promptDensity: 'standard' })
  assert.equal(storage.getItem(STUDIO_CHOICES_KEY).includes('google'), true)
  assert.equal(writeStudioChoices(storage, { style: 'Fun', model: 'grok', sequenceMode: 'varied' }).sequenceMode, 'varied')
  assert.equal(readStudioChoices(storage).sequenceMode, 'varied')
  assert.deepEqual(writeStudioChoices(storage, { style: 'Noir', model: 'kling', sequenceMode: 'montage' }), { style: 'Normal', model: 'grok', sequenceMode: 'continuous', aspectRatio: '16:9', continuityStrength: 'standard', promptDensity: 'standard' })
  assert.deepEqual(readStudioChoices({ getItem: () => '{' }), { style: 'Normal', model: 'grok', sequenceMode: '', aspectRatio: '16:9', continuityStrength: 'standard', promptDensity: 'standard' })
  assert.equal(writeStudioChoices(storage, { style: 'Normal', model: 'grok', aspectRatio: '4:5', continuityStrength: 'strict' }).aspectRatio, '4:5')
  assert.equal(readStudioChoices(storage).continuityStrength, 'strict')
  assert.equal(readStudioChoices(storage).aspectRatio, '4:5')
  assert.equal(writeStudioChoices(storage, { aspectRatio: '2:3', continuityStrength: 'loose' }).aspectRatio, '16:9')
  assert.equal(readStudioChoices(storage).continuityStrength, 'standard')
})
