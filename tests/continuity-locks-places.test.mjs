import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { derivedLockLine } from '../app/utils/character-lock.js'
import { isDescriptionSentence, isPortraitSentence } from '../app/utils/scene-split.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function lockOf(text, name) {
  const found = detectProse(text)
  const person = found.characters.find(item => item.name === name)
  return { found, line: derivedLockLine(person), person }
}

test('a Portuguese comma list keeps hair, a de-phrase, the role, and the item', () => {
  const text = 'Ofélia, 17 anos, aprendiz, caracóis castanhos, jaqueta de couro, flauta de bambu. Ofélia espera no cais. Ofélia acena.'
  const { found, line } = lockOf(text, 'Ofélia')
  assert.equal(found.language, 'pt')
  for (const part of [/17 anos/, /aprendiz/, /caracóis castanhos/, /jaqueta de couro/, /flauta de bambu/]) {
    assert.match(line, part, line)
  }
  assert.equal(found.warnings.some(item => item.code === 'missing_look' && item.name === 'Ofélia'), false)
  assert.equal(found.warnings.some(item => item.code === 'missing_outfit' && item.name === 'Ofélia'), false)
  const planned = plan({ premise: text, model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  for (const shot of planned.body.shots) {
    for (const part of [/17 anos/, /aprendiz/, /caracóis castanhos/, /jaqueta de couro/, /flauta de bambu/]) {
      assert.match(shot.prompt, part, shot.prompt)
    }
  }
})

test('an English article-led garment stays on the lock with the hair and the item', () => {
  const text = 'Helen, early 50s, auburn curls, an olive jumper, sketch notebook, waits in the hall. Helen waves. Helen sits.'
  const { line } = lockOf(text, 'Helen')
  for (const part of [/early 50s/, /auburn curls/, /olive jumper/, /sketch notebook/]) assert.match(line, part, line)
  const found = detectProse(text)
  assert.equal(found.warnings.some(item => item.code === 'missing_outfit'), false, line)
})

test('a later verb that mentions the item does not replace age, clothes, or the item', () => {
  const beats = Array.from({ length: 8 }, (_, index) => `Rosa fecha o apito ${index + 1}. Rosa abre as luvas ${index + 1}.`)
  const text = `Rosa, 41 anos, cabelo grisalho, jardineira azul, luvas de couro, apito de metal, espera na horta. ${beats.join(' ')}`
  const { line } = lockOf(text, 'Rosa')
  for (const part of [/41 anos/, /cabelo grisalho/, /jardineira azul/, /luvas de couro/, /apito de metal/]) {
    assert.match(line, part, line)
  }
  assert.doesNotMatch(line, /fecha|abre/i, line)
})

test('a named place in the beat or a description replaces the carried place', () => {
  const english = [
    ['Owen, 44, grey beard, navy coat, waits in the cottage. The dining car rattles. Owen pours tea.', ['Cottage', 'Dining car', 'Dining car']],
    ['Owen, 44, grey beard, navy coat, waits in the lobby. Owen crosses the vineyard. Owen waves.', ['Lobby', 'Vineyard', 'Vineyard']],
    ['Owen, 44, grey beard, navy coat, waits in the lobby. Owen reaches the security room. Owen checks a lamp.', ['Lobby', 'Security room', 'Security room']],
    ['Owen, 44, grey beard, navy coat, waits on the beach. Owen wades into the sea. Owen waves on the beach.', ['Beach', 'Sea', 'Beach']],
    ['Owen, 44, grey beard, navy coat, waits on the beach. The sea is calm at dusk. Owen waves.', ['Beach', 'Sea']]
  ]
  for (const [text, where] of english) {
    const found = detectProse(text)
    assert.deepEqual(found.scenes.map(scene => scene.where), where, found.scenes.map(scene => `${scene.where} :: ${scene.what}`).join(' > '))
  }
  const portuguese = [
    ['Teresa, 40 anos, cabelo preto, casaco azul, espera no mercado. Teresa caminha até a bilheteira. Teresa espera.', ['Mercado', 'Bilheteira', 'Bilheteira']],
    ['Teresa, 40 anos, cabelo preto, casaco azul, espera no cais. Teresa vai para a oficina. Teresa abre uma caixa.', ['Cais', 'Oficina', 'Oficina']],
    ['Teresa, 40 anos, cabelo preto, casaco azul, espera na praia. Teresa entra no mar. Teresa acena na praia.', ['Praia', 'Mar', 'Praia']]
  ]
  for (const [text, where] of portuguese) {
    const found = detectProse(text)
    assert.equal(found.language, 'pt')
    assert.deepEqual(found.scenes.map(scene => scene.where), where, found.scenes.map(scene => `${scene.where} :: ${scene.what}`).join(' > '))
  }
})

test('watch is not a place, and a conservatory, study, atrium, or átrio at dawn is', () => {
  const watch = detectProse('Helen, 31, black bob, wool coat, waits in the hall. Helen walks to the watch. Helen waves.')
  assert.equal(watch.scenes.every(scene => scene.where === 'Hall'), true, watch.scenes.map(scene => scene.where).join(' > '))
  assert.equal(watch.places.some(place => /^watch$/i.test(place.name)), false)
  const rooms = [
    ['The conservatory is quiet at dawn. Helen mends a ribbon. Helen sits.', 'Conservatory'],
    ['The study is quiet at dawn. Helen opens a book. Helen sits.', 'Study'],
    ['The atrium is quiet at dawn. Helen waits. Helen waves.', 'Atrium']
  ]
  for (const [text, place] of rooms) {
    const found = detectProse(text)
    assert.equal(found.scenes.every(scene => scene.where === place), true, found.scenes.map(scene => scene.where).join(' > '))
    assert.equal(found.scenes.every(scene => scene.light === 'dawn'), true)
    assert.equal(found.scenes.some(scene => /quiet/i.test(scene.what)), false)
  }
  const atrio = detectProse('Teresa, 40 anos, cabelo preto, casaco azul, espera na cozinha. O átrio está calmo ao amanhecer. Teresa espera.')
  assert.equal(atrio.language, 'pt')
  assert.deepEqual(atrio.scenes.map(scene => scene.where), ['Cozinha', 'Átrio'])
  const office = detectProse('Teresa, 40 anos, cabelo preto, casaco azul, espera na cozinha. O escritório está calmo ao amanhecer. Teresa escreve.')
  assert.equal(office.scenes.at(-1).where, 'Escritório')
})

test('a carry or a call stays a shot, and a pure appearance line does not', () => {
  assert.equal(isPortraitSentence('Helen carries the crate down the lane.'), false)
  assert.equal(isDescriptionSentence('Helen carries the crate down the lane.'), false)
  const carried = detectProse('Helen carries the crate down the lane. Helen waves.')
  assert.equal(carried.scenes.length, 2)
  assert.match(carried.scenes[0].what, /carries the crate/)
  assert.equal(isPortraitSentence('Helen has the key and calls the guard.'), false)
  const called = detectProse('Helen has the key and calls the guard.')
  assert.equal(called.scenes.length, 1)
  assert.match(called.scenes[0].what, /calls the guard/)
  const portuguese = detectProse('Teresa carrega o cesto até a copa. Teresa espera no cais.')
  assert.equal(portuguese.language, 'pt')
  assert.match(portuguese.scenes[0].what, /carrega o cesto/)
  assert.equal(portuguese.scenes[0].where, 'Copa')
  assert.equal(isPortraitSentence('Teresa tem tranças castanhas.'), true)
  const appearance = detectProse('Teresa tem tranças castanhas. Teresa espera no cais.')
  assert.equal(appearance.scenes.some(scene => /tranças/i.test(scene.what)), false)
  assert.equal(appearance.scenes.some(scene => /espera no cais/i.test(scene.what)), true)
})

test('a 45-beat story keeps the full lock and updates the place in part 2', () => {
  const intro = 'Ofélia, 36 anos, cabelo preto, casaco verde, caderno azul, é aprendiz.'
  const early = Array.from({ length: 30 }, (_, index) => `Ofélia abre o caderno ${index + 1} na cozinha.`)
  const late = Array.from({ length: 18 }, (_, index) => `Ofélia fecha o caderno ${index + 1} na oficina.`)
  const prose = [intro, ...early, 'Ofélia caminha até a oficina.', ...late].join(' ')
  const found = detectProse(prose)
  const line = derivedLockLine(found.characters.find(person => person.name === 'Ofélia'))
  for (const part of [/36 anos/, /cabelo preto/, /aprendiz/, /casaco verde/, /caderno azul/]) assert.match(line, part, line)
  assert.ok(found.scenes.length >= 45)
  assert.equal(found.scenes[0].where, 'Cozinha')
  assert.equal(found.scenes.at(-1).where, 'Oficina')
  const planned = plan({ input: 'prose', prose, model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45)
  assert.ok(planned.body.parts.length >= 2)
  assert.equal(planned.body.parts[0].place, 'Cozinha')
  assert.equal(planned.body.parts[1].place, 'Oficina')
  assert.ok(planned.body.parts.every(part => part.to - part.from + 1 <= 40))
  for (const shot of planned.body.shots) {
    for (const part of [/36 anos/, /cabelo preto/, /casaco verde/, /caderno azul/]) {
      assert.match(shot.prompt, part, shot.prompt)
    }
  }
  const move = planned.body.shots.findIndex(shot => /oficina/i.test(shot.prompt) && /PLACE/i.test(shot.prompt))
  assert.ok(move > 0 && move < planned.body.shots.length - 1)
})
