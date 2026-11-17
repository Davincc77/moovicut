import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { derivedLockLine } from '../app/utils/character-lock.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function lightOf(prompt) {
  return (String(prompt || '').match(/^LIGHT: .+$/m) || [''])[0]
}

test('Portuguese night, dusk, and evening cues set night light and carry it forward', () => {
  const cues = ['à noite', 'perto da meia-noite', 'na madrugada', 'de noite', 'ao anoitecer', 'ao crepúsculo', 'ao luar']
  for (const cue of cues) {
    const text = `Inês, 54 anos, cabelo preto, casaco azul, espera no cais ${cue}. Inês abre a porta.`
    const found = detectProse(text)
    assert.equal(found.language, 'pt', text)
    assert.ok(found.scenes.length >= 2, text)
    assert.ok(found.scenes.every(scene => scene.light === 'night'), `${cue} ${found.scenes.map(scene => scene.light).join(',')}`)
    const planned = plan({ premise: text, model: 'grok', compact: true, promptLanguage: 'pt' })
    assert.equal(planned.status, 200, planned.body.message)
    for (const shot of planned.body.shots) {
      assert.match(lightOf(shot.prompt), /noite/i, `${cue} ${shot.prompt}`)
      assert.doesNotMatch(lightOf(shot.prompt), /luz do dia/i, shot.prompt)
    }
  }
  const carried = detectProse('Ao amanhecer, Inês espera no cais. À noite, Inês abre a porta. Inês lê uma carta.')
  assert.deepEqual(carried.scenes.map(scene => scene.light), ['dawn', 'night', 'night'])
})

test('languages, body parts, room surfaces, objects, and clothing are never places and are not carried', () => {
  const cases = [
    ['Mara answers in French. Mara waits in the kitchen. Mara reads.', /french/i, /kitchen/i],
    ['Mara leans on the wall. Mara waits in the kitchen. Mara reads.', /wall/i, /kitchen/i],
    ['Inês toca a testa. Inês espera na cozinha. Inês lê uma carta.', /testa/i, /cozinha/i],
    ['Inês olha para o chão. Inês espera na cozinha. Inês lê uma carta.', /ch[aã]o/i, /cozinha/i],
    ['Inês encosta na parede. Inês espera na cozinha. Inês lê uma carta.', /parede|encosta/i, /cozinha/i],
    ['Inês está na caixa registadora. Inês espera no mercado. Inês lê uma carta.', /caixa|registadora/i, /mercado/i],
    ['Inês chega com xaile pelos ombros. Inês espera no mercado. Inês lê uma carta.', /xaile|ombros/i, /mercado/i]
  ]
  for (const [text, banned, kept] of cases) {
    const found = detectProse(text)
    const names = found.places.map(place => place.name).join(' | ')
    assert.doesNotMatch(names, banned, names)
    assert.ok(found.scenes.every(scene => !scene.where || kept.test(scene.where)), found.scenes.map(scene => scene.where).join(' > '))
    assert.equal(found.scenes.some(scene => banned.test(scene.where || '')), false)
  }
})

test('a movement into a new place replaces the carried place, including unlisted and lexicon places', () => {
  const english = detectProse('Nia waits in the dining car. Nia enters the sleeper compartment. Nia sits. Nia waits on the beach. Nia walks onto the red carpet. Nia waves.')
  assert.deepEqual(english.scenes.map(scene => scene.where), [
    'Dining car',
    'Sleeper compartment',
    'Sleeper compartment',
    'Beach',
    'Red carpet',
    'Red carpet'
  ])
  const portuguese = detectProse('Inês espera no mercado. Inês entra no farol. Inês acende a luz.')
  assert.equal(portuguese.language, 'pt')
  assert.deepEqual(portuguese.scenes.map(scene => scene.where), ['Mercado', 'Farol', 'Farol'])
})

test('Portuguese lock lines keep age, complete phrases, word boundaries, gender, and later characters', () => {
  const text = 'Inês, 54 anos, cabelo grisalho preso num coque, casaco de lã azul, avental de linho, binóculos ao pescoço, espera no cais. Raimundo, 60 anos, barba branca, casaco escuro, entra no mercado. Celeste, 40 anos, cabelo preto, vestido azul, é pescadora. Celeste acena.'
  const found = detectProse(text)
  const ines = found.characters.find(person => person.name === 'Inês')
  const line = derivedLockLine(ines)
  assert.match(line, /54 anos/)
  assert.match(line, /cabelo grisalho preso num coque/)
  assert.match(line, /casaco de lã azul/)
  assert.match(line, /avental de linho/)
  assert.match(line, /binóculos ao pescoço/)
  assert.doesNotMatch(line, /(?<![\p{L}])óculos ao\b|casaco de\.|avental de\.|preso num[.,]/u)
  const raimundo = found.characters.find(person => person.name === 'Raimundo')
  const celeste = found.characters.find(person => person.name === 'Celeste')
  assert.match(derivedLockLine(raimundo), /60 anos/)
  assert.match(derivedLockLine(raimundo), /barba branca/)
  assert.match(derivedLockLine(raimundo), /casaco escuro/)
  assert.match(derivedLockLine(celeste), /40 anos/)
  assert.match(derivedLockLine(celeste), /pescadora/)
  assert.doesNotMatch(derivedLockLine(celeste), /pescador(?!a)/)
  const planned = plan({ premise: text, model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  const joined = planned.body.shots.map(shot => shot.prompt).join('\n')
  assert.match(joined, /Raimundo — 60 anos/)
  assert.match(joined, /Celeste — 40 anos/)
  assert.match(joined, /pescadora/)
})

test('English lock lines keep age, carried props, and a character introduced later', () => {
  const text = 'Dolores, who is sixty-three, silver hair, navy coat, a camera, waits on the quay. Dolores lifts the camera. Nia, 40, short black hair, grey coat, a ticket punch, waits in the station. Mara, 35, brown hair, linen dress, a paper fan, waits in the garden. Leo, 28, short hair, denim jacket, a walkie-talkie, waits on the dock. Leo calls Tomasz. Tomasz is forty. He has a grey beard and a wool sweater and carries a flashlight. Tomasz answers.'
  const found = detectProse(text)
  const line = person => derivedLockLine(found.characters.find(item => item.name === person))
  assert.match(line('Dolores'), /sixty-three/)
  assert.match(line('Dolores'), /camera/)
  assert.match(line('Dolores'), /navy coat/)
  assert.doesNotMatch(line('Dolores'), /\bis sixty-three\b/)
  assert.match(line('Nia'), /ticket punch/)
  assert.match(line('Mara'), /paper fan/)
  assert.match(line('Leo'), /walkie-talkie/)
  assert.match(line('Tomasz'), /forty/)
  assert.match(line('Tomasz'), /grey beard/)
  assert.match(line('Tomasz'), /wool sweater/)
  assert.match(line('Tomasz'), /flashlight/)
})

test('a description sentence sets context and is not a shot, and a feminine role stays feminine', () => {
  const text = 'The kitchen is quiet at dawn. Mara, forty-two, short black hair, blue apron, is a fisherwoman. She has a weathered face. Mara mends a net. Mara lifts the basket. Mara walks to the quay. Mara waves. Mara sits. Mara reads a letter. Mara folds the net. Mara smiles.'
  const found = detectProse(text)
  assert.equal(found.scenes.length, 8)
  assert.equal(found.scenes.some(scene => /quiet|forty-two|weathered face/i.test(scene.what)), false)
  assert.equal(found.scenes[0].light, 'dawn')
  assert.ok(found.places.some(place => /kitchen/i.test(place.name)))
  const mara = found.characters.find(person => person.name === 'Mara')
  assert.match(`${mara.look} ${mara.outfit}`, /forty-two/)
  assert.match(`${mara.look} ${mara.outfit}`, /fisherwoman/)
  const portuguese = detectProse('Clara, 30 anos, cabelo preto, vestido azul, é pescadora. Clara espera no cais. Ela lança a rede.')
  const clara = portuguese.characters.find(person => person.name === 'Clara')
  assert.match(derivedLockLine(clara), /pescadora/)
  assert.doesNotMatch(derivedLockLine(clara), /pescador(?!a)/)
})

test('a scenario that packs many actions into few shots is invalid_plan', () => {
  const beats = Array.from({ length: 16 }, (_, index) => `Inês abre a porta ${index + 1}. Inês lê a carta ${index + 1}.`)
  const packed = plan({
    model: 'grok',
    scenario: {
      characters: [{ name: 'Inês', look: '54 anos, cabelo preto', outfit: 'casaco azul' }],
      places: [{ name: 'Cais', description: 'um cais' }],
      scenes: [
        { who: 'Inês', where: 'Cais', what: beats.slice(0, 6).join(' ') },
        { who: 'Inês', where: 'Cais', what: beats.slice(6, 11).join(' ') },
        { who: 'Inês', where: 'Cais', what: beats.slice(11).join(' ') }
      ]
    }
  })
  assert.equal(packed.status, 400)
  assert.equal(packed.body.error, 'invalid_plan')
  assert.match(packed.body.message, /one action per shot/i)
  assert.match(packed.body.message, /do not merge beats/i)
  assert.match(packed.body.message, /40 shots/i)
  const kept = plan({
    model: 'grok',
    scenario: {
      characters: [{ name: 'Maya', look: 'early 30s, short black hair', outfit: 'grey coat' }, { name: 'Rui', look: '50s, grey stubble', outfit: 'navy peacoat' }],
      places: [{ name: 'Quay', description: 'a rainy quay' }],
      scenes: [{ who: 'Maya and Rui', where: 'Quay', what: 'Maya hands Rui a letter. He reads it and walks away.' }]
    }
  })
  assert.equal(kept.status, 200, kept.body.message)
})
