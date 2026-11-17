import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function line(prompt, prefix) {
  return (prompt || '').split('\n').find(item => item.startsWith(prefix)) || ''
}

function lock(prompt, name) {
  return (prompt || '').split('\n').find(item => item.includes(`${name} —`)) || ''
}

test('taking off or flying sets the aircraft and the next beats keep it', () => {
  const portuguese = plan({
    input: 'prose',
    prose: 'Tadeu, 44 anos, cabelo curto, casaco azul, espera no posto de saúde. Ao meio-dia, Tadeu descola com o avião sobre o rio. Tadeu verifica o altímetro. Tadeu vira o manche. Tadeu olha a asa. Tadeu acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(portuguese.status, 200, portuguese.body.message)
  for (const shot of portuguese.body.shots.slice(1)) {
    assert.match(line(shot.prompt, 'PLACE'), /Avião/)
    assert.doesNotMatch(line(shot.prompt, 'PLACE'), /Posto|Rio/)
  }
  assert.equal(portuguese.body.shots[1].time, 'midday')
  assert.equal(portuguese.body.shots[2].time, 'midday')
  const english = plan({
    input: 'prose',
    prose: 'Mara, 33, short hair, grey coat, waits at the clinic. Mara takes off. Mara flies over the valley. Mara boards. Mara waves.',
    model: 'grok',
    compact: true
  })
  assert.equal(english.status, 200, english.body.message)
  for (const shot of english.body.shots.slice(1)) assert.match(line(shot.prompt, 'PLACE'), /Plane/)
})

test('a capitalized surf school keeps the full compound on the rules prose path', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Helena, 36 anos, cabelo curto, casaco azul, espera no cais. Helena entra na Escola de Surf. Helena acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(line(planned.body.shots[1].prompt, 'PLACE'), /Escola de Surf/)
  assert.match(line(planned.body.shots[2].prompt, 'PLACE'), /Escola de Surf/)
  assert.doesNotMatch(line(planned.body.shots[1].prompt, 'PLACE'), /PLACE: Escola\./)
})

test('giving an item back to a named person restores it on the rules path and the sheet path', () => {
  const rules = plan({
    input: 'prose',
    prose: 'Nia, 38, bobbed hair, olive coat, wears a silver ring, waits in the hall. Mara Quinn, 29, black hair, grey coat, waits. Nia hands the ring back to Mara Quinn. Mara Quinn nods.',
    model: 'grok',
    compact: true
  })
  assert.equal(rules.status, 200, rules.body.message)
  const handed = rules.body.shots.find(shot => /hands the ring back/.test(shot.prompt))
  assert.doesNotMatch(lock(handed.prompt, 'Nia'), /ring/)
  assert.match(lock(handed.prompt, 'Mara Quinn'), /silver ring|ring/)
  assert.doesNotMatch(lock(handed.prompt, 'Mara Quinn'), /\bto\b/)
  assert.doesNotMatch(lock(handed.prompt, 'Nia'), /\bto\b/)
  const returned = plan({
    input: 'prose',
    prose: 'Nia, 38, bobbed hair, olive coat, wears a silver ring, waits in the hall. Mara Quinn, 29, black hair, grey coat, waits. Nia returns the ring to Mara Quinn. Mara Quinn nods.',
    model: 'grok',
    compact: true
  })
  const back = returned.body.shots.find(shot => /returns the ring/.test(shot.prompt))
  assert.match(lock(back.prompt, 'Mara Quinn'), /ring/)
  assert.doesNotMatch(lock(back.prompt, 'Nia'), /ring/)
  const sheet = plan({
    model: 'grok',
    compact: true,
    scenario: {
      characters: [
        { name: 'Nia', look: '38, bobbed hair', outfit: 'olive coat', items: 'silver ring' },
        { name: 'Mara Quinn', look: '29, black hair', outfit: 'grey coat' }
      ],
      places: [{ name: 'Hall', description: 'a quiet hall' }],
      scenes: [
        { who: 'Nia', where: 'Hall', what: 'Nia gives the ring back to Mara Quinn' },
        { who: 'Mara Quinn', where: 'Hall', what: 'Mara Quinn nods' }
      ]
    }
  })
  assert.equal(sheet.status, 200, sheet.body.message)
  assert.match(lock(sheet.body.shots[0].prompt, 'Mara Quinn'), /silver ring|ring/)
  assert.doesNotMatch(lock(sheet.body.shots[0].prompt, 'Nia'), /ring/)
  for (const shot of sheet.body.shots) {
    assert.doesNotMatch(lock(shot.prompt, 'Nia'), /\bto\b/)
    assert.doesNotMatch(lock(shot.prompt, 'Mara Quinn'), /\bto\b/)
  }
})

test('deixa cair and perde remove the item, and a jammed um is not part of the lock', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Bia, 29 anos, cabelo curto, casaco verde, traz cachecol um apito, espera no cais. Bia deixa o apito cair. Bia perde o cachecol. Bia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const first = lock(planned.body.shots[0].prompt, 'Bia')
  assert.match(first, /cachecol/)
  assert.match(first, /apito/)
  assert.doesNotMatch(first, /\bum\b/)
  assert.doesNotMatch(lock(planned.body.shots[1].prompt, 'Bia'), /apito/)
  assert.match(lock(planned.body.shots[1].prompt, 'Bia'), /cachecol/)
  assert.doesNotMatch(lock(planned.body.shots[2].prompt, 'Bia'), /cachecol|apito/)
})

test('Portuguese veste, tira, põe, and despe version the outfit from that shot', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Bia, 30 anos, cabelo curto, casaco azul, espera no cais. Bia veste um impermeável amarelo. Bia tira o casaco. Bia põe um chapéu. Bia despe o chapéu. Bia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.doesNotMatch(lock(planned.body.shots[0].prompt, 'Bia'), /impermeável|chapéu|põe|veste/)
  assert.match(lock(planned.body.shots[1].prompt, 'Bia'), /impermeável amarelo/)
  assert.match(lock(planned.body.shots[1].prompt, 'Bia'), /casaco azul/)
  assert.doesNotMatch(lock(planned.body.shots[2].prompt, 'Bia'), /casaco/)
  assert.match(lock(planned.body.shots[3].prompt, 'Bia'), /chapéu/)
  assert.doesNotMatch(lock(planned.body.shots[3].prompt, 'Bia'), /\bpõe\b/)
  assert.doesNotMatch(lock(planned.body.shots[4].prompt, 'Bia'), /chapéu/)
  assert.match(lock(planned.body.shots[5].prompt, 'Bia'), /impermeável/)
})

test('a cued time stays on the next uncued shot and compact shots record it', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Nadia, 34, short black hair, red parka, waits on the glacier at dawn. At midday Nadia crosses the glacier. Nadia plants a flag. In the afternoon Joe starts the helicopter. Joe checks the fuel.',
    model: 'grok',
    compact: true
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.equal(planned.body.shots[1].time, 'midday')
  assert.match(line(planned.body.shots[1].prompt, 'LIGHT'), /Midday/)
  assert.equal(planned.body.shots[2].time, 'midday')
  assert.match(line(planned.body.shots[2].prompt, 'LIGHT'), /Midday/)
  assert.doesNotMatch(line(planned.body.shots[2].prompt, 'LIGHT'), /Dawn/)
  assert.equal(planned.body.shots[3].time, 'afternoon')
  assert.equal(planned.body.shots[4].time, 'afternoon')
  assert.match(line(planned.body.shots[4].prompt, 'LIGHT'), /Afternoon/)
  assert.doesNotMatch(line(planned.body.shots[4].prompt, 'LIGHT'), /Dawn|Morning/)
})

test('plural, kinship, titles, and later clothes stay on the people who are present', () => {
  const pair = plan({
    input: 'prose',
    prose: 'Bia, 30 anos, cabelo curto, casaco azul, espera no atelier. Rosa, 68 anos, cabelo branco, vestido preto, é a avó. Nuno, 40 anos, barba curta, casaco cinzento, espera na porta. Bia ajuda a avó. Os dois pintam lado a lado.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const both = pair.body.shots.find(shot => /pintam lado a lado/.test(shot.prompt))
  assert.match(lock(both.prompt, 'Bia'), /casaco azul/)
  assert.match(lock(both.prompt, 'Rosa'), /vestido preto/)
  const father = plan({
    input: 'prose',
    prose: 'Marta, 28 anos, cabelo comprido, vestido azul, espera no salão. Rui, 55 anos, barba grisalha, casaco castanho, é o pai de Marta. Marta dança com o pai. Rui acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const dance = father.body.shots.find(shot => /dança com o pai/.test(shot.prompt))
  assert.match(lock(dance.prompt, 'Marta'), /vestido azul/)
  assert.match(lock(dance.prompt, 'Rui'), /casaco castanho/)
  const intro = plan({
    input: 'prose',
    prose: 'Lia, 30 anos, cabelo curto, casaco azul, espera no cais. A irmã de Lia, Iracema, tem 50 anos, cabelo branco e veste um vestido preto. Iracema acena. Lia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const introduced = intro.body.shots.find(shot => /Iracema, tem 50 anos/.test(shot.prompt))
  assert.match(lock(introduced.prompt, 'Iracema'), /50 anos/)
  assert.match(lock(introduced.prompt, 'Iracema'), /vestido preto/)
  assert.equal(lock(introduced.prompt, 'Lia'), '')
  const dona = plan({
    input: 'prose',
    prose: 'Dona Celeste, 70 anos, cabelo branco, xaile preto, benze a criança. Dona Celeste senta.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(dona.status, 200, dona.body.message)
  assert.equal(dona.body.shots.length, 2)
  assert.match(dona.body.shots[0].prompt, /benze a criança/)
  assert.match(lock(dona.body.shots[0].prompt, 'Dona Celeste'), /70 anos/)
  assert.match(lock(dona.body.shots[0].prompt, 'Dona Celeste'), /xaile preto/)
})

test('tailleur, pérolas, batina, terço, and rastas stay in the lock', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Odete, 52 anos, cabelo grisalho, tailleur azul, pérolas, espera na oficina. Vasco, 60 anos, careca, batina preta, terço, espera na igreja. Bruno, 27 anos, rastas, camisola verde, espera no cais. Odete acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const odete = planned.body.shots.find(shot => lock(shot.prompt, 'Odete'))
  const vasco = planned.body.shots.find(shot => lock(shot.prompt, 'Vasco'))
  const bruno = planned.body.shots.find(shot => lock(shot.prompt, 'Bruno'))
  assert.match(lock(odete.prompt, 'Odete'), /tailleur/)
  assert.match(lock(odete.prompt, 'Odete'), /pérolas/)
  assert.match(lock(vasco.prompt, 'Vasco'), /batina/)
  assert.match(lock(vasco.prompt, 'Vasco'), /terço/)
  assert.match(lock(bruno.prompt, 'Bruno'), /rastas/)
})

test('an item first named in a later shot is not in the opening lock', () => {
  const rules = plan({
    input: 'prose',
    prose: 'Pilar, 71, white bun, olive cloak, waits on the quay. Pilar opens the silver locket. Pilar checks the brass compass. Pilar waves.',
    model: 'grok',
    compact: true
  })
  assert.doesNotMatch(lock(rules.body.shots[0].prompt, 'Pilar'), /locket|compass/)
  assert.match(lock(rules.body.shots[1].prompt, 'Pilar'), /locket/)
  assert.doesNotMatch(lock(rules.body.shots[1].prompt, 'Pilar'), /compass/)
  assert.match(lock(rules.body.shots[2].prompt, 'Pilar'), /compass/)
  const sheet = plan({
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{ name: 'Pilar', look: '71, white bun', outfit: 'olive cloak' }],
      places: [{ name: 'Quay', description: 'a stone quay' }],
      scenes: [
        { who: 'Pilar', where: 'Quay', what: 'Pilar waits' },
        { who: 'Pilar', where: 'Quay', what: 'Pilar opens the locket' },
        { who: 'Pilar', where: 'Quay', what: 'Pilar checks the compass' }
      ]
    }
  })
  assert.doesNotMatch(lock(sheet.body.shots[0].prompt, 'Pilar'), /locket|compass/)
  assert.match(lock(sheet.body.shots[1].prompt, 'Pilar'), /locket/)
  assert.match(lock(sheet.body.shots[2].prompt, 'Pilar'), /compass/)
})
