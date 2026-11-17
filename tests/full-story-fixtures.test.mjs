import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function story(name) {
  return readFileSync(new URL(`./fixtures/prose/${name}`, import.meta.url), 'utf8').trim()
}

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function prose(name, promptLanguage) {
  return plan({ input: 'prose', prose: story(name), promptLanguage, model: 'grok', compact: true })
}

function placeOf(shot) {
  return ((shot.prompt || '').split('\n').find(line => line.startsWith('PLACE:')) || '').replace(/^PLACE:\s*/, '').replace(/\.$/, '')
}

function lockOf(shot, name) {
  return (shot.prompt || '').split('\n').find(line => line.includes(`${name} —`)) || ''
}

function assertShots(planned, rows) {
  assert.equal(planned.status, 200, planned.body.message)
  assert.equal(planned.body.shots.length, rows.length, planned.body.shots.map(shot => shot.prompt.split('\n')[0]).join('\n'))
  rows.forEach((row, index) => {
    const shot = planned.body.shots[index]
    assert.match(shot.prompt, row.action, `shot ${index + 1}`)
    if (row.time) assert.equal(shot.time, row.time, `shot ${index + 1} time`)
    if (row.place) assert.match(placeOf(shot), row.place, `shot ${index + 1} place`)
    else assert.equal(placeOf(shot), '', `shot ${index + 1} place`)
    for (const name of row.who || []) assert.match(lockOf(shot, name), /—/, `shot ${index + 1} ${name}`)
    for (const name of row.absent || []) assert.equal(lockOf(shot, name), '', `shot ${index + 1} absent ${name}`)
  })
}

const TRAIN = [
  [/blows her whistle on the platform/, 'evening', /Platform/],
  [/runs along the train/, 'evening', /Platform/],
  [/punches Felix's ticket/, 'evening', /Platform/],
  [/climbs aboard/, 'evening', /Platform/],
  [/orders soup in the dining car/, 'night', /Dining car/],
  [/sits down opposite him/, 'night', /Dining car/],
  [/offers Felix a rice cracker/, 'night', /Dining car/],
  [/tunes his violin/, 'night', /Dining car/],
  [/plays a lullaby for Hana/, 'night', /Dining car/],
  [/claps from the doorway/, 'night', /Dining car/],
  [/checks the sleeper compartment/, 'night', /Sleeper compartment/],
  [/searches her bag for her fan/, 'night', /Sleeper compartment/],
  [/finds the fan under the bunk/, 'night', /Sleeper compartment/],
  [/falls asleep/, 'night', /Sleeper compartment/],
  [/opens the doors at the mountain station/, 'dawn', /Mountain station/],
  [/steps out into the snow/, 'dawn', /Mountain station/],
  [/waves her fan from the window/, 'dawn', /Mountain station/],
  [/hands Felix a forgotten scarf/, 'dawn', /Mountain station/],
  [/plays on a bench at the station for coins/, 'midday', /Mountain station/],
  [/the train leaves/, 'midday', /Mountain station/]
].map(([action, time, place]) => ({ action, time, place }))

const TRAIN_SYNTH = [
  [/locks a trunk on the platform/, 'evening', /Platform/],
  [/runs along the train/, 'evening', /Platform/],
  [/stamps Owen's pass/, 'evening', /Platform/],
  [/climbs aboard/, 'evening', /Platform/],
  [/orders tea in the dining car/, 'night', /Dining car/],
  [/sits down opposite him/, 'night', /Dining car/],
  [/offers Owen a biscuit/, 'night', /Dining car/],
  [/tunes a radio/, 'night', /Dining car/],
  [/plays a waltz for Lila/, 'night', /Dining car/],
  [/claps from the doorway/, 'night', /Dining car/],
  [/checks the sleeper car/, 'night', /Sleeper car/],
  [/searches her bag for her fan/, 'night', /Sleeper car/],
  [/finds the key under the bunk/, 'night', /Sleeper car/],
  [/falls asleep/, 'night', /Sleeper car/],
  [/opens the doors at the mountain station/, 'dawn', /Mountain station/],
  [/steps out into the snow/, 'dawn', /Mountain station/],
  [/waves her fan from the window/, 'dawn', /Mountain station/],
  [/hands Owen a forgotten glove/, 'dawn', /Mountain station/],
  [/plays on a bench at the station for coins/, 'midday', /Mountain station/],
  [/the train leaves/, 'midday', /Mountain station/]
].map(([action, time, place]) => ({ action, time, place }))

function stageRows(names) {
  const [, actor, actress] = names
  return [
    [new RegExp(`${actress} é uma atriz`), '', ''],
    [/marca posições com fita no palco/, 'morning', /Palco/],
    [/ensaia o monólogo/, 'morning', /Palco/],
    [/esquece a fala/, 'morning', /Palco/],
    [/lê a fala em voz alta/, 'morning', /Palco/],
    [/repete a fala/, 'morning', /Palco/],
    [/aplaude/, 'morning', /Palco/],
    [/costura um botão no camarim/, 'afternoon', /Camarim/],
    [/maquilha-se ao espelho/, 'afternoon', /Camarim/],
    [/bate à porta/, 'afternoon', /Camarim/],
    [/fusível queimou/, 'afternoon', /Camarim/],
    [/suspira/, 'afternoon', /Camarim/],
    [/empresta o isqueiro/, 'afternoon', /Camarim/],
    [/conta os bilhetes na bilheteira/, 'afternoon', /Bilheteira/],
    [/vende um bilhete/, 'afternoon', /Bilheteira/],
    [/cola um cartaz/, 'afternoon', /Bilheteira/],
    [/fusível novo/, 'afternoon', /Bilheteira/],
    [/abraça/, 'afternoon', /Bilheteira/],
    [/do palco/, 'dusk', /Palco/],
    [/veste o figurino/, 'dusk', /Palco/],
    [/aquece a voz/, 'dusk', /Palco/],
    [/espreita a plateia/, 'dusk', /Palco/],
    [/segura a mão/, 'dusk', /Palco/, [actor, actress]],
    [/baixa as luzes da plateia/, 'dusk', /Palco/],
    [/entra em cena no palco/, 'night', /Palco/],
    [/canta a canção final/, 'night', /Palco/],
    [/ajoelha-se/, 'night', /Palco/],
    [/acende o foco/, 'night', /Palco/],
    [/chora nos bastidores/, 'night', /Palco/],
    [/faz uma vénia/, 'night', /Palco/],
    [/na praça/, 'morning', /Praça/],
    [/pastéis de nata/, 'morning', /Praça/],
    [/por cima do ombro/, 'morning', /Praça/],
    [/dá de comer aos pombos/, 'morning', /Praça/],
    [/recorta a crítica/, 'morning', /Praça/]
  ].map(([action, time, place, who]) => ({ action, time, place, who }))
}

test('e3 full story keeps the sleeper compartment and leaves action fragments out of locks', () => {
  const planned = prose('e3-sleeper.txt', 'en')
  assertShots(planned, TRAIN)
  for (const shot of planned.body.shots) {
    const felix = lockOf(shot, 'Felix Brandt')
    const ama = lockOf(shot, 'Ama Owusu')
    if (felix) {
      assert.doesNotMatch(felix, /under the|finds the|fan under/)
      assert.match(felix, /violin case/)
    }
    if (ama) {
      assert.doesNotMatch(ama, /blows/)
      assert.match(ama, /ticket punch/)
      assert.match(ama, /burgundy uniform/)
    }
  }
  assert.doesNotMatch(placeOf(planned.body.shots[18]), /for coins/)
})

test('synthetic English train story keeps the sleeper car the same way', () => {
  const planned = prose('e3-sleeper-synthetic.txt', 'en')
  assertShots(planned, TRAIN_SYNTH)
  for (const shot of planned.body.shots) {
    const owen = lockOf(shot, 'Owen Hart')
    const nora = lockOf(shot, 'Nora Keel')
    if (owen) assert.doesNotMatch(owen, /under the|finds the key/)
    if (nora) {
      assert.doesNotMatch(nora, /blows/)
      assert.match(nora, /brass key/)
    }
  }
})

test('p5 full story moves to the stage on do palco after the evening cue', () => {
  const planned = prose('p5-palco.txt', 'pt')
  assertShots(planned, stageRows(['Isabel Rocha', 'Miguel Duarte', 'Joana Teles', 'Osvaldo']))
  const stage = planned.body.shots.slice(18, 24)
  assert.equal(stage.length, 6)
  for (const shot of stage) assert.match(placeOf(shot), /^Palco$/)
  assert.match(planned.body.shots[18].prompt, /testa os projetores do palco/)
  assert.doesNotMatch(placeOf(planned.body.shots[18]), /Bilheteira/)
  const hand = planned.body.shots[22]
  assert.match(lockOf(hand, 'Joana Teles'), /vestido azul/)
  assert.match(lockOf(hand, 'Miguel Duarte'), /camisa branca/)
})

test('synthetic Portuguese stage story moves on do palco the same way', () => {
  const planned = prose('p5-palco-synthetic.txt', 'pt')
  assertShots(planned, stageRows(['Clara Nunes', 'Pedro Lima', 'Rita Mota', 'Vasco']))
  for (const shot of planned.body.shots.slice(18, 24)) assert.match(placeOf(shot), /^Palco$/)
  const hand = planned.body.shots[22]
  assert.match(lockOf(hand, 'Rita Mota'), /vestido vermelho/)
  assert.match(lockOf(hand, 'Pedro Lima'), /camisa azul/)
})

test('p3 full story keeps Dona Celeste weighing the sardines and locks both people in a handshake', () => {
  const planned = prose('p3-celeste.txt', 'pt')
  const rows = [
    [/Rui Costa é um pescador/, '', ''],
    [/Marta Costa, tem vinte e oito anos/, '', ''],
    [/solta as amarras no cais/, 'dawn', /Cais/],
    [/carrega as redes para o barco/, 'dawn', /Barco/],
    [/acende o cachimbo/, 'dawn', /Barco/],
    [/liga o motor/, 'dawn', /Barco/],
    [/lança a rede do convés/, 'midday', /Barco/],
    [/segura o leme/, 'midday', /Barco/],
    [/Uma onda molha Marta/, 'midday', /Barco/],
    [/puxa a rede cheia/, 'midday', /Barco/],
    [/conta as caixas/, 'midday', /Barco/],
    [/canta uma cantiga/, 'midday', /Barco/],
    [/descarrega as caixas na lota/, 'dusk', /Lota/],
    [/pesa as sardinhas/, 'dusk', /Lota/, ['Dona Celeste']],
    [/regateia com Rui/, 'dusk', /Lota/, ['Dona Celeste', 'Rui Costa']],
    [/escreve o preço/, 'dusk', /Lota/],
    [/aperta a mão de Celeste/, 'dusk', /Lota/, ['Rui Costa', 'Dona Celeste']],
    [/grelha sardinhas na taberna/, 'night', /Taberna/],
    [/serve vinho tinto/, 'night', /Taberna/],
    [/toca acordeão/, 'night', /Taberna/, ['Dona Celeste']],
    [/dança com o pai/, 'night', /Taberna/],
    [/adormece na cadeira/, 'night', /Taberna/]
  ].map(([action, time, place, who]) => ({ action, time, place, who }))
  assertShots(planned, rows)
  const weigh = planned.body.shots[13]
  assert.match(lockOf(weigh, 'Dona Celeste'), /setenta e cinco anos/)
  assert.match(lockOf(weigh, 'Dona Celeste'), /avental de plástico/)
  assert.doesNotMatch(planned.body.shots[12].prompt, /pesa as sardinhas/)
  assert.doesNotMatch(planned.body.shots[14].prompt, /pesa as sardinhas/)
})

test('an Iracema introduction with an action stays its own shot beside Lia bebe o chá', () => {
  const planned = prose('p3-iracema-synthetic.txt', 'pt')
  assert.equal(planned.status, 200, planned.body.message)
  const tea = planned.body.shots.find(shot => /Lia bebe o chá/.test(shot.prompt))
  const intro = planned.body.shots.find(shot => /serve o bolo/.test(shot.prompt))
  assert.ok(tea && intro && tea.order < intro.order)
  assert.doesNotMatch(tea.prompt, /Iracema, tem cinquenta|serve o bolo/)
  assert.match(intro.prompt, /A irmã de Lia, Iracema, tem cinquenta anos/)
  assert.match(lockOf(intro, 'Iracema'), /vestido preto/)
  assert.equal(lockOf(intro, 'Lia Pires'), '')
  for (const shot of planned.body.shots.filter(item => lockOf(item, 'Lia Pires'))) {
    assert.match(lockOf(shot, 'Lia Pires'), /camiseta vermelha/)
  }
  const hand = planned.body.shots.find(shot => /aperta a mão de Iracema/.test(shot.prompt))
  assert.match(lockOf(hand, 'Lia Pires'), /camiseta vermelha/)
  assert.match(lockOf(hand, 'Iracema'), /cabelo branco/)
})

test('Dr. does not split That night, so the ward beats stay night', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Nadia, 34, short black hair, red parka, waits on the glacier at dusk. That night Dr. Mei Lin, thirty-six, with a long black braid, blue scrubs and a stethoscope, examines Nadia in the hospital ward. Mei looks at the X-ray against the lamp. Mei nods.',
    promptLanguage: 'en',
    model: 'grok',
    compact: true
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.equal(planned.body.shots[0].time, 'dusk')
  for (const shot of planned.body.shots.slice(1)) {
    assert.equal(shot.time, 'night', shot.prompt.split('\n')[0])
    assert.match(shot.prompt, /Night/)
    assert.doesNotMatch(shot.prompt, /Dusk|X-ray —/)
  }
  assert.match(planned.body.shots[1].prompt, /That night Dr\. Mei Lin/)
  assert.match(lockOf(planned.body.shots[1], 'Mei Lin'), /stethoscope/)
  assert.match(lockOf(planned.body.shots[1], 'Nadia'), /red parka/)
  assert.match(placeOf(planned.body.shots[1]), /Hospital ward/)
})

test('a sheet item stays on every beat of that character until it is dropped', () => {
  const planned = plan({
    model: 'grok',
    compact: true,
    scenario: {
      characters: [
        { name: 'Nia', look: '38, bobbed hair', outfit: 'olive coat', items: 'silver ring' },
        { name: 'Mara', look: '29, black hair', outfit: 'grey coat', items: 'facão' }
      ],
      places: [{ name: 'Hall', description: 'a quiet hall' }],
      scenes: [
        { who: 'Nia', where: 'Hall', what: 'Nia waits' },
        { who: 'Nia', where: 'Hall', what: 'Nia waves' },
        { who: ['Nia', 'Mara'], where: 'Hall', what: 'Nia nods at Mara' },
        { who: 'Mara', where: 'Hall', what: 'Mara sits' },
        { who: 'Nia', where: 'Hall', what: 'Nia drops the ring' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  planned.body.shots.slice(0, 4).forEach(shot => {
    if (lockOf(shot, 'Nia')) assert.match(lockOf(shot, 'Nia'), /silver ring/)
    if (lockOf(shot, 'Mara')) assert.match(lockOf(shot, 'Mara'), /facão/)
  })
  assert.doesNotMatch(lockOf(planned.body.shots[4], 'Nia'), /ring/)
  assert.match(lockOf(planned.body.shots[3], 'Mara'), /facão/)
})
