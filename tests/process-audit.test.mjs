import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { locativeHeads } from '../app/utils/place-lexicon.js'

test('a time clause with a pronoun is not a place', () => {
  const found = detectProse('Nia waits in the kitchen. In the afternoon they sit. Nia pours tea.')
  assert.equal(found.scenes.some(scene => /afternoon|they sit/i.test(scene.where || '')), false)
  assert.ok(found.scenes.every(scene => /kitchen/i.test(scene.where || '')))
  assert.equal(locativeHeads('In the afternoon they sit.', 'en').length, 0)
})

test('a destination the sentence does not reach does not move the scene', () => {
  const found = detectProse('Nia waits in the kitchen. Nia writes a letter to the harbour. Nia pours tea.')
  assert.ok(found.scenes.every(scene => /kitchen/i.test(scene.where || '')))
  assert.equal(found.places.some(place => /harbour/i.test(place.name)), false)
})

test('a quoted place and a garment are not the setting', () => {
  const found = detectProse('Nia waits in the kitchen. Nia says "Meet me in Paris". Nia folds the coat.')
  assert.ok(found.scenes.every(scene => !/paris|coat/i.test(scene.where || '')))
  assert.equal(locativeHeads('Nia folds the coat on the mantel.', 'en').some(head => /mantel/i.test(head.name)), false)
})

test('Chinese comma clauses stay separate actions', () => {
  const found = detectProse('早上，林夏打开门，林夏坐下，林夏倒了一杯茶。')
  assert.equal(found.language, 'zh-Hans')
  assert.ok(found.scenes.length >= 3, found.scenes.map(scene => scene.what).join(' | '))
  assert.ok(found.scenes.some(scene => /打开/.test(scene.what)))
  assert.ok(found.scenes.some(scene => /坐下/.test(scene.what)))
  assert.ok(found.scenes.some(scene => /倒了/.test(scene.what)))
})

test('a Chinese semicolon is its own sentence', () => {
  const found = detectProse('林夏打开门；林夏坐下。')
  assert.equal(found.language, 'zh-Hans')
  assert.ok(found.scenes.length >= 2)
})

test('a German compound after im is a place, and a separable particle is not a name', () => {
  const found = detectProse('Im Bootshaus wartet Lena. Lena liest einen Brief. Lena geht hinaus.')
  assert.equal(found.language, 'de')
  assert.equal(found.characters.some(person => /bootshaus|hinaus/i.test(person.name)), false)
  assert.ok(found.characters.some(person => person.name === 'Lena'))
  assert.ok(found.places.some(place => /bootshaus/i.test(place.name)) || found.scenes.some(scene => /bootshaus/i.test(scene.where || '')))
  assert.equal(locativeHeads('Im Bootshaus wartet Lena.', 'de').map(head => head.name).join(' '), 'Bootshaus')
})

test('a German noun after an article is not a person', () => {
  const found = detectProse('In der Küche steht Otto. Otto liest einen Brief und geht hinaus.')
  assert.equal(found.language, 'de')
  assert.equal(found.characters.some(person => /küche/i.test(person.name)), false)
  assert.ok(found.scenes.some(scene => /küche/i.test(scene.where || '')))
})
