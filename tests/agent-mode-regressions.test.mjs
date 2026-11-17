import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { detectProse } from '../app/utils/prose-detect.js'
import { characterSheetGaps } from '../app/utils/prose-extra.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { createStoryboard } from '../app/utils/prompt-engine.js'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function lightLine(prompt) {
  return (prompt || '').split('\n').find(line => /^LIGHT/.test(line)) || ''
}

function lockLine(prompt, name) {
  return (prompt || '').split('\n').find(line => line.includes(`${name} —`) || line.includes(`SUBJECT: ${name} —`)) || ''
}

const cast = [{ name: 'Lina', look: '30s, short hair', outfit: 'wool coat' }]
const kitchen = [{ name: 'Kitchen', description: 'a small kitchen' }]

test('evening in light is time, and time carries until the next cue', () => {
  const planned = plan({
    model: 'grok',
    format: 'agent',
    scenario: {
      characters: cast,
      places: kitchen,
      scenes: [
        { who: 'Lina', where: 'Kitchen', what: 'Lina pours tea', light: 'evening' },
        { who: 'Lina', where: 'Kitchen', what: 'Lina sits' },
        { who: 'Lina', where: 'Kitchen', what: 'The next morning, Lina opens the window', light: 'soft' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(planned.body.note, /whole scenario/)
  assert.equal(planned.body.shots[0].time, 'evening')
  assert.equal(planned.body.shots[1].time, 'evening')
  assert.equal(planned.body.shots[2].time, 'morning')
  assert.match(lightLine(planned.body.shots[0].prompt), /Evening light/)
  assert.match(lightLine(planned.body.shots[1].prompt), /Evening light/)
  assert.match(lightLine(planned.body.shots[2].prompt), /Morning light/)
  assert.match(lightLine(planned.body.shots[2].prompt), /soft diffused light/i)
  assert.doesNotMatch(lightLine(planned.body.shots[0].prompt), /soft window light/i)
})

test('Portuguese action cues set and carry time of day', () => {
  const planned = plan({
    model: 'grok',
    promptLanguage: 'pt',
    compact: true,
    scenario: {
      characters: [{ name: 'Inês', look: '30 anos, cabelo curto', outfit: 'casaco azul' }],
      places: [{ name: 'Cozinha', description: 'uma cozinha pequena' }],
      scenes: [
        { who: 'Inês', where: 'Cozinha', what: 'À noite, Inês serve o chá' },
        { who: 'Inês', where: 'Cozinha', what: 'Inês senta' },
        { who: 'Inês', where: 'Cozinha', what: 'De manhã, Inês abre a janela' },
        { who: 'Inês', where: 'Cozinha', what: 'À tarde, Inês acena' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(lightLine(planned.body.shots[0].prompt), /noite/i)
  assert.match(lightLine(planned.body.shots[1].prompt), /noite/i)
  assert.match(lightLine(planned.body.shots[2].prompt), /manhã/i)
  assert.match(lightLine(planned.body.shots[3].prompt), /tarde/i)
  assert.doesNotMatch(lightLine(planned.body.shots[0].prompt), /luz suave de janela/i)
})

test('an unknown time is 400 and lists the allowed values', () => {
  const planned = plan({
    scenario: {
      characters: cast,
      places: kitchen,
      scenes: [{ who: 'Lina', where: 'Kitchen', what: 'Lina sits', time: 'teatime' }]
    }
  })
  assert.equal(planned.status, 400)
  assert.match(planned.body.message, /time must be one of/)
  assert.match(planned.body.message, /evening/)
})

test('sheet auto-fill keeps concrete nouns and drops verb phrases', () => {
  const rita = [{ name: 'Rita', look: '28 anos, cabelo curto', outfit: 'fato de neoprene', items: 'prancha azul' }]
  const story = 'Rita encera a prancha. Rita testa o apito. Rita cai da prancha. Rita entrega a prancha a Nuno. Rita assina a prancha com um marcador. Rita leva o cesto com uma só mão. Rita surfa a onda. De fato Rita surfa.'
  const gaps = characterSheetGaps(rita, story)
  const values = gaps.map(item => item.value)
  for (const banned of ['encera a prancha', 'testa o apito', 'cai da prancha', 'entrega a prancha a', 'assina a prancha com um', 'cesto com uma só mão', 'surfa a onda', 'fato', 'prancha']) {
    assert.equal(values.includes(banned), false, values.join(' | '))
  }
  assert.ok(values.includes('apito'), values.join(' | '))
  assert.ok(values.includes('cesto'), values.join(' | '))
  const mara = characterSheetGaps([{ name: 'Mara', look: '40s, grey hair', outfit: 'boots' }], 'Mara rings the bell.')
  assert.deepEqual(mara.map(item => item.value), ['bell'])
  const filled = plan({
    model: 'grok',
    format: 'agent',
    premise: 'Rita waits on the beach.',
    scenario: {
      characters: rita,
      places: [{ name: 'Praia', description: 'uma praia' }],
      scenes: [
        { who: 'Rita', where: 'Praia', what: 'Rita encera a prancha' },
        { who: 'Rita', where: 'Praia', what: 'Rita testa o apito' }
      ]
    }
  })
  assert.equal(filled.status, 200, filled.body.message)
  const sheetWarnings = (filled.body.warnings || []).filter(item => item.code === 'sheet_filled')
  assert.ok(sheetWarnings.every(item => item.action === 'none'))
  assert.equal(sheetWarnings.some(item => /encera|surfa|testa o|cai da|entrega a|assina a/.test(item.value)), false)
  assert.ok(sheetWarnings.some(item => item.value === 'apito'))
})

test('warnings name how to act, and stage or snow do not demand a re-post', () => {
  const board = createStoryboard({
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small cafe' }],
      scenes: [
        { who: 'Léa', where: 'Stage', what: 'Léa bows on stage' },
        { who: 'Léa', where: 'Snow', what: 'Léa walks in the snow' },
        { who: 'Léa', where: 'Station', what: 'A crowd fills the station' },
        { who: 'Léa', where: 'Café', what: 'Léa holds a cup' }
      ]
    }
  })
  const warnings = assessProject(board)
  assert.equal(warnings.some(item => item.code === 'unresolved_place' && /stage|snow/i.test(item.message)), false)
  const station = warnings.find(item => item.code === 'unresolved_place')
  assert.ok(station)
  assert.equal(station.action, 'optional')
  const hands = warnings.find(item => item.code === 'hands_or_held_object')
  assert.equal(hands.action, 'none')
  const crowd = warnings.find(item => item.code === 'crowd')
  assert.equal(crowd.action, 'none')
  const noted = plan({
    model: 'grok',
    format: 'agent',
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small cafe' }],
      scenes: [{ who: 'Léa', where: 'Café', what: 'Léa holds a cup' }]
    }
  })
  assert.match(noted.body.note, /every scene/)
  assert.equal(noted.body.warnings.find(item => item.code === 'hands_or_held_object').action, 'none')
})

test('crawling into a cave sets the place, and hut and glacier beats keep a PLACE line', () => {
  const found = detectProse('Nadia, 34, short black hair, red parka, waits on the helipad. Nadia crawls into a small ice cave. Nadia lights a flare. Nadia wraps her ankle. Nadia opens the hut. Nadia crosses the glacier.')
  assert.deepEqual(found.scenes.map(scene => scene.where), ['Helipad', 'Ice cave', 'Ice cave', 'Ice cave', 'Hut', 'Glacier'])
  const planned = plan({ input: 'prose', prose: 'Nadia, 34, short black hair, red parka, waits on the helipad. Nadia crawls into a small ice cave. Nadia lights a flare. Nadia opens the hut. Nadia crosses the glacier.', model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  const places = planned.body.shots.map(shot => (shot.prompt.match(/PLACE: ([^\n.]+)/) || ['', ''])[1])
  assert.match(places[1], /Ice cave/i)
  assert.match(places[2], /Ice cave/i)
  assert.match(places[3], /Hut/i)
  assert.match(places[4], /Glacier/i)
})

test('a lock never keeps a verb phrase, and a returned ring comes back', () => {
  const prose = 'Theo, 36, short brown hair, wears a green velvet blazer and a silver ring, waits in the hall. Theo irons his blazer. Theo drops his ring. Kofi, 29, black hair, wears a grey coat. Kofi picks up the ring and returns it. Theo nods.'
  const planned = plan({ input: 'prose', prose, model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  const theo = planned.body.shots.map(shot => lockLine(shot.prompt, 'Theo')).filter(Boolean)
  assert.ok(theo.length >= 3)
  for (const line of theo) assert.doesNotMatch(line, /irons|drops his ring/)
  assert.match(theo[0], /silver ring/)
  assert.doesNotMatch(theo[1], /silver ring/)
  assert.match(theo.at(-1), /silver ring/)
  const nadia = plan({ input: 'prose', prose: 'Nadia, 34, short black hair, wears a red parka and goggles, waits on the helipad. Nadia laces her boots. Nadia pulls her goggles down. Nadia waves.', model: 'grok', compact: true })
  for (const shot of nadia.body.shots) assert.doesNotMatch(lockLine(shot.prompt, 'Nadia'), /laces her boots|goggles down/)
})

test('opening the church door, boats, aircraft, waterfalls, and surf school', () => {
  const church = detectProse('Odete, 52 anos, cabelo grisalho, veste um tailleur azul e pérolas, espera na oficina. Odete abre a porta da igreja. Odete acende uma vela. Odete senta.')
  assert.equal(church.language, 'pt')
  assert.deepEqual(church.scenes.map(scene => scene.where), ['Oficina', 'Igreja', 'Igreja', 'Igreja'])
  for (const scene of church.scenes) {
    const line = `${scene.what}`
    if (!/Odete/.test(line) && scene.who !== 'Odete') continue
  }
  const planned = plan({ input: 'prose', prose: 'Odete, 52 anos, cabelo grisalho, veste um tailleur azul e pérolas, espera na oficina. Odete abre a porta da igreja. Odete acende uma vela. Nuno, 40 anos, barba curta, veste um casaco cinzento. Nuno acena para Odete.', model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  const odeteShots = planned.body.shots.filter(shot => /Odete —/.test(shot.prompt))
  assert.ok(odeteShots.length >= 3)
  for (const shot of odeteShots) {
    const line = lockLine(shot.prompt, 'Odete')
    assert.match(line, /tailleur/)
    assert.match(line, /pérolas/)
  }
  const shared = planned.body.shots.find(shot => /Nuno acena para Odete/.test(shot.prompt))
  assert.ok(shared)
  assert.match(lockLine(shared.prompt, 'Nuno'), /casaco cinzento/)
  assert.match(lockLine(shared.prompt, 'Odete'), /tailleur/)
  const places = detectProse('Rui, 40 anos, barba curta, casaco azul, espera no cais. Rui sobe para o barco. Rui entra no avião. Rui nada na água da cascata. Rui entra na escola de surf.')
  assert.deepEqual(places.scenes.map(scene => scene.where), ['Cais', 'Barco', 'Avião', 'Cascata', 'Escola de surf'])
  assert.equal(places.scenes.some(scene => /água/i.test(scene.where || '')), false)
})
