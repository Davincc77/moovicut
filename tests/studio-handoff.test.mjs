import test from 'node:test'
import assert from 'node:assert/strict'
import { saveStudioHandoff, takeStudioHandoff, STUDIO_HANDOFF_KEY } from '../app/utils/studio-handoff.js'

function memory() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}

test('a home premise is handed to the studio once, in this browser only', () => {
  const storage = memory()
  saveStudioHandoff(storage, { premise: '  A baker in Luxembourg loses the last loaf.  ', model: 'google' })
  assert.match(storage.getItem(STUDIO_HANDOFF_KEY), /Luxembourg/)
  assert.deepEqual(takeStudioHandoff(storage), { premise: 'A baker in Luxembourg loses the last loaf.', model: 'google' })
  assert.equal(storage.getItem(STUDIO_HANDOFF_KEY), null)
  assert.deepEqual(takeStudioHandoff(storage), { premise: '', model: '' })
  saveStudioHandoff(storage, { premise: 'A paper star map.', model: 'kling' })
  assert.equal(takeStudioHandoff(storage).model, 'kling')
  saveStudioHandoff(storage, { premise: 'A paper star map.', model: 'happyhorse' })
  assert.equal(takeStudioHandoff(storage).model, '')
})
