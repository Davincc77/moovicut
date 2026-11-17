import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { derivedLockLine } from '../app/utils/character-lock.js'
import { partOpening } from '../app/utils/parts.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function placesOf(text) {
  return detectProse(text).places.map(place => place.name).join(' | ')
}

function wheres(text) {
  return detectProse(text).scenes.map(scene => scene.where || '')
}

test('clothing, objects, manner, and tool tails are not place labels', () => {
  const english = [
    ['Lila, 33, short brown hair, grey coat, arrives in a hurry at the bakery. Lila opens the door.', /hurry/i, /bakery/i],
    ['Lila waits in a plum cardigan inside the bakery. Lila sits.', /cardigan/i, /bakery/i],
    ['Otto stands in a striped waistcoat inside the hall. Otto waves.', /waistcoat/i, /hall/i],
    ['Lila puts the lens in its case in the workshop. Lila waits.', /case/i, /workshop/i],
    ['Lila arrives at the empty big top. Lila waves.', /^Empty big$/i, /big top/i],
    ['Lila steps onto the red carpet beside the theatre. Lila waves.', /steps onto/i, /red carpet/i]
  ]
  for (const [text, banned, kept] of english) {
    const found = detectProse(text)
    const names = found.places.map(place => place.name).join(' | ')
    assert.doesNotMatch(names, banned, names)
    assert.match(names, kept, names)
    assert.equal(found.scenes.some(scene => banned.test(scene.where || '')), false)
  }
  const portuguese = [
    ['Inês, 40 anos, cabelo preto, casaco azul, espera na janela. Inês abre a porta.', /janela/i],
    ['Inês, 40 anos, cabelo preto, casaco azul, entra em cena no teatro. Inês acena.', /cena/i],
    ['Inês, 40 anos, cabelo preto, casaco azul, escreve no caderno. Inês espera na sala.', /caderno/i],
    ['Inês, 40 anos, cabelo preto, casaco azul, senta na cadeira. Inês espera na copa.', /cadeira/i],
    ['Inês, 40 anos, cabelo preto, casaco azul, chega ao portão com lanterna. Inês espera.', /lanterna|com$/i],
    ['Inês, 40 anos, cabelo preto, casaco azul, caminha na floresta com cantil. Inês espera.', /cantil|com$/i],
    ['Lia espera no quintal com mochila. Lia acena.', /mochila|com$/i]
  ]
  for (const [text, banned] of portuguese) {
    const found = detectProse(text)
    const names = found.places.map(place => place.name).join(' | ')
    assert.doesNotMatch(names, banned, names)
    assert.equal(found.scenes.some(scene => banned.test(scene.where || '')), false, found.scenes.map(scene => scene.where).join(' > '))
  }
  assert.match(placesOf('Inês, 40 anos, cabelo preto, casaco azul, chega ao portão com lanterna. Inês espera.'), /portão/i)
  assert.match(placesOf('Inês, 40 anos, cabelo preto, casaco azul, caminha na floresta com cantil. Inês espera.'), /floresta/i)
  assert.match(placesOf('Lia espera no quintal com mochila. Lia acena.'), /quintal/i)
})

test('a part label never comes from a rejected place', () => {
  const opening = partOpening({
    filmSheet: { places: [{ name: 'Hall' }], light: '' },
    shots: [{ where: 'Striped waistcoat', light: 'night', order: 1 }]
  }, 0)
  assert.equal(opening.place, 'Hall')
})

test('a new locative in a time jump replaces the carried place', () => {
  const english = detectProse('Lila, 33, short brown hair, grey coat, waits in the sleeper compartment. The next day, Lila waits at the stables. Lila walks to the caravan steps. Lila waves.')
  assert.deepEqual(english.scenes.map(scene => scene.where), [
    'Sleeper compartment',
    'Stables',
    'Caravan steps',
    'Caravan steps'
  ])
  const portuguese = detectProse('Inês, 40 anos, cabelo preto, casaco azul, espera no armazém. Inês caminha até à varanda. Inês sobe ao convés. Inês acena.')
  assert.equal(portuguese.language, 'pt')
  assert.deepEqual(portuguese.scenes.map(scene => scene.where), ['Armazém', 'Varanda', 'Convés', 'Convés'])
  const morning = detectProse('À noite, Inês espera na oficina. Na manhã seguinte, Inês espera no armazém. Inês abre uma caixa.')
  assert.equal(morning.scenes[0].where, 'Oficina')
  assert.equal(morning.scenes[1].where, 'Armazém')
  assert.equal(morning.scenes[2].where, 'Armazém')
})

test('an explicit morning or dawn cue replaces carried night', () => {
  const english = detectProse('At night, Lila waits in the gallery. The next morning, Lila waits in the security room. At dawn, Lila checks a monitor.')
  assert.equal(english.scenes[0].light, 'night')
  assert.equal(english.scenes[1].light, 'dawn')
  assert.equal(english.scenes[2].light, 'dawn')
  const portuguese = detectProse('À noite, Inês espera na oficina. Na manhã seguinte, Inês espera no armazém. Ao amanhecer, Inês abre uma caixa.')
  assert.deepEqual(portuguese.scenes.map(scene => scene.light), ['night', 'dawn', 'dawn'])
  const planned = plan({
    input: 'prose',
    prose: 'À noite, Inês espera na oficina. Na manhã seguinte, Inês espera no armazém. Inês abre uma caixa.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const lights = planned.body.shots.map(shot => (shot.prompt.match(/^LIGHT: .+$/m) || [''])[0])
  assert.match(lights[0], /noite/i)
  assert.doesNotMatch(lights[1], /noite/i)
  assert.match(lights[1], /aurora|manhã|dawn/i)
  assert.doesNotMatch(lights[2], /noite/i)
})

test('lock lines keep age, hair, outfit, item, and role on every shot', () => {
  const portuguese = 'Lia, de 12 anos, de tranças castanhas, de vestido verde e uma mochila roxa, é aprendiz. Lia espera no cais. Lia acena. Lia corre.'
  const lia = detectProse(portuguese).characters.find(person => person.name === 'Lia')
  const line = derivedLockLine(lia)
  for (const part of [/12 anos/, /tranças castanhas/, /vestido verde/, /mochila roxa/, /aprendiz/]) assert.match(line, part, line)
  const spread = detectProse('Lia tem 12 anos. Lia tem tranças castanhas. Lia veste um vestido verde e carrega uma mochila roxa. Lia espera no cais. Lia acena.')
  const spreadLine = derivedLockLine(spread.characters.find(person => person.name === 'Lia'))
  for (const part of [/12 anos/, /tranças castanhas/, /vestido verde/, /mochila roxa/]) assert.match(spreadLine, part, spreadLine)
  assert.equal(spread.scenes.some(scene => /tranças|veste|12 anos/i.test(scene.what)), false)
  const english = detectProse('Nora, early 30s, auburn braids, a plum cardigan, carries a tin whistle. Nora waits in the hall. Nora waves. Nora sits.')
  const nora = derivedLockLine(english.characters.find(person => person.name === 'Nora'))
  for (const part of [/early 30s/, /auburn braids/, /plum cardigan/, /tin whistle/]) assert.match(nora, part, nora)
  const hugo = derivedLockLine(detectProse('Hugo is fifty-two. He has a salt beard and wears a linen waistcoat and carries a brass key. Hugo waits on the pier. Hugo waves.').characters[0])
  for (const part of [/fifty-two/, /salt beard/, /linen waistcoat/, /brass key/]) assert.match(hugo, part, hugo)
  const planned = plan({ premise: portuguese, model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 2)
  for (const shot of planned.body.shots) {
    for (const part of [/12 anos/, /tranças castanhas/, /vestido verde/, /mochila roxa/, /aprendiz/]) {
      assert.match(shot.prompt, part, shot.prompt)
    }
  }
})

test('invalid_plan tells the agent how to resubmit, and GET points at POST', () => {
  const beats = Array.from({ length: 16 }, (_, index) => `Nuno abre o postigo ${index + 1}. Nuno lê o bilhete ${index + 1}.`)
  const packed = plan({
    model: 'grok',
    scenario: {
      characters: [{ name: 'Nuno', look: '33 anos, cabelo castanho', outfit: 'casaco cinzento' }],
      places: [{ name: 'Padaria', description: 'uma padaria' }],
      scenes: [
        { who: 'Nuno', where: 'Padaria', what: beats.slice(0, 6).join(' ') },
        { who: 'Nuno', where: 'Padaria', what: beats.slice(6, 11).join(' ') },
        { who: 'Nuno', where: 'Padaria', what: beats.slice(11).join(' ') }
      ]
    }
  })
  assert.equal(packed.status, 400)
  assert.equal(packed.body.error, 'invalid_plan')
  assert.match(packed.body.message, /do not shorten/i)
  assert.match(packed.body.message, /plain prose/i)
  assert.match(packed.body.message, /input to "prose"/i)
  assert.match(packed.body.message, /40 shots/i)
  const get = dispatchAgentRequest({ method: 'GET', pathname: '/api/v1/storyboard' })
  const got = JSON.parse(get.body)
  assert.equal(get.status, 405)
  assert.equal(got.error, 'method_not_allowed')
  assert.match(got.message, /POST \/api\/v1\/storyboard/)
  assert.match(got.message, /premise/)
  assert.match(got.message, /do not shorten/i)
  const many = Array.from({ length: 18 }, () => 'The bell sounds once again today.').join(' ')
  const short = plan({ premise: many, model: 'grok', compact: true })
  assert.equal(short.status, 200, short.body.message)
  assert.ok(short.body.shots.length < 10)
  assert.ok(short.body.warnings.some(item => item.code === 'short_board'))
  assert.match(short.body.warnings.find(item => item.code === 'short_board').message, /do not shorten/i)
})

test('a description sentence that sets the time keeps its place on the following shots', () => {
  const english = detectProse('The pantry is quiet at dawn. Lila mends a net. Lila lifts the basket.')
  assert.ok(english.scenes.length >= 2)
  assert.equal(english.scenes.every(scene => scene.where === 'Pantry'), true, english.scenes.map(scene => scene.where).join(' > '))
  assert.equal(english.scenes.every(scene => scene.light === 'dawn'), true)
  assert.equal(english.scenes.some(scene => /quiet/i.test(scene.what)), false)
  const portuguese = detectProse('A cozinha está calma ao amanhecer. Inês abre a porta. Inês espera.')
  assert.equal(portuguese.language, 'pt')
  assert.equal(portuguese.scenes.every(scene => scene.where === 'Cozinha'), true, portuguese.scenes.map(scene => scene.where).join(' > '))
  assert.equal(portuguese.scenes.every(scene => scene.light === 'dawn'), true)
  assert.equal(portuguese.scenes.some(scene => /calma/i.test(scene.what)), false)
})
