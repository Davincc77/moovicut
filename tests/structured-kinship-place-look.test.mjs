import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    search: '?compact=1',
    body: JSON.stringify({ model: 'grok', compact: true, ...body })
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function shotOf(result, pattern) {
  return (result.body.shots || []).find(shot => pattern.test(shot.prompt || ''))
}

function lockOf(shot, name) {
  return ((shot && shot.prompt) || '').split('\n').find(line => line.includes(`${name} —`)) || ''
}

function placeNames(result) {
  return (result.body.scenario?.places || []).map(place => place.name).join(' | ')
}

function optionText(result) {
  return (result.body.warnings || []).flatMap(item => item.options || []).join(' | ')
}

const taberna = [{ name: 'Taberna', description: 'uma taberna à noite' }]
const tavern = [{ name: 'Tavern', description: 'a tavern at night' }]
const quay = [{ name: 'Quay', description: 'the quay' }]

test('structured Portuguese scenes lock the father on Marta dança com o pai', () => {
  const planned = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'pescador de cinquenta e oito anos, barba grisalha', outfit: 'camisola de lã azul-marinho', items: 'cachimbo' },
        { name: 'Marta Costa', look: 'vinte e oito anos, cabelo preto curto', outfit: 'impermeável amarelo, botas de borracha' }
      ],
      places: taberna,
      scenes: [
        { who: 'Rui Costa', where: 'Taberna', what: 'Rui Costa é um pescador de cinquenta e oito anos, de barba grisalha, com uma camisola de lã azul-marinho e um cachimbo.' },
        { who: 'Marta Costa', where: 'Taberna', what: 'A filha, Marta Costa, tem vinte e oito anos, cabelo preto curto, um impermeável amarelo e botas de borracha.' },
        { who: 'Marta Costa', where: 'Taberna', what: 'Marta dança com o pai.' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  const dance = shotOf(planned, /dança com o pai/)
  assert.ok(dance)
  assert.match(lockOf(dance, 'Marta Costa'), /impermeável amarelo/)
  assert.match(lockOf(dance, 'Rui Costa'), /camisola/)
  assert.match(dance.prompt, /PLACE: Taberna/)
  assert.doesNotMatch(placeNames(planned), /Cachimbo/)
})

test('a sheet that only says A filha locks the one other character as the father', () => {
  const planned = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'pescador, barba grisalha', outfit: 'camisola azul' },
        { name: 'Marta Costa', look: 'A filha', outfit: 'impermeável amarelo' }
      ],
      places: taberna,
      scenes: [{ who: 'Marta Costa', where: 'Taberna', what: 'Marta dança com o pai.' }]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  const dance = shotOf(planned, /dança com o pai/)
  assert.match(lockOf(dance, 'Marta Costa'), /impermeável/)
  assert.match(lockOf(dance, 'Rui Costa'), /camisola/)
})

test('filha de Rui on the sheet locks Rui even when the beard is the only gender cue', () => {
  const planned = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'barba grisalha', outfit: 'camisola azul' },
        { name: 'Marta Costa', look: 'A filha de Rui Costa, vinte e oito anos', outfit: 'impermeável amarelo' }
      ],
      places: taberna,
      scenes: [{ who: 'Marta Costa', where: 'Taberna', what: 'Marta dança com o pai.' }]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  const dance = shotOf(planned, /dança com o pai/)
  assert.match(lockOf(dance, 'Rui Costa'), /barba grisalha/)
  assert.equal(lockOf(shotOf(plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'barba grisalha', outfit: 'camisola azul' },
        { name: 'Marta Costa', look: 'A filha', outfit: 'impermeável amarelo' }
      ],
      places: taberna,
      scenes: [{ who: 'Marta Costa', where: 'Taberna', what: 'Marta dança com a mãe.' }]
    }
  }), /mãe/), 'Rui Costa'), '')
})

test('structured English scenes lock her father and his mother', () => {
  const amy = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Tom Reed', look: 'fifty-eight-year-old fisherman, grey beard', outfit: 'navy wool sweater', items: 'pipe' },
        { name: 'Amy Reed', look: 'twenty-eight, short black hair', outfit: 'yellow raincoat, rubber boots' }
      ],
      places: tavern,
      scenes: [
        { who: 'Tom Reed', where: 'Tavern', what: 'Tom Reed is a fifty-eight-year-old fisherman with a grey beard, a navy wool sweater and a pipe.' },
        { who: 'Amy Reed', where: 'Tavern', what: 'His daughter, Amy Reed, is twenty-eight, with short black hair, a yellow raincoat and rubber boots.' },
        { who: 'Amy Reed', where: 'Tavern', what: 'Amy dances with her father.' }
      ]
    }
  })
  assert.equal(amy.status, 200, amy.body.message)
  const dance = shotOf(amy, /dances with her father/)
  assert.match(lockOf(dance, 'Amy Reed'), /yellow raincoat/)
  assert.match(lockOf(dance, 'Tom Reed'), /navy wool sweater/)
  const leo = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Ana Cole', look: 'forty-year-old teacher, short hair', outfit: 'blue coat' },
        { name: 'Leo Cole', look: 'ten, black hair', outfit: 'green sweater' }
      ],
      places: quay,
      scenes: [
        { who: 'Ana Cole', where: 'Quay', what: 'Ana Cole is a forty-year-old teacher with short hair and a blue coat.' },
        { who: 'Leo Cole', where: 'Quay', what: 'Her son, Leo Cole, is ten, with black hair and a green sweater.' },
        { who: 'Leo Cole', where: 'Quay', what: 'Leo calls his mother.' }
      ]
    }
  })
  assert.equal(leo.status, 200, leo.body.message)
  const call = shotOf(leo, /calls his mother/)
  assert.match(lockOf(call, 'Leo Cole'), /green sweater/)
  assert.match(lockOf(call, 'Ana Cole'), /blue coat/)
})

test('English sheets lock her father and his mother when the kinship is only on the sheet', () => {
  const amy = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Tom Reed', look: 'grey beard', outfit: 'navy wool sweater' },
        { name: 'Amy Reed', look: "Tom Reed's daughter, short black hair", outfit: 'yellow raincoat' }
      ],
      places: tavern,
      scenes: [{ who: 'Amy Reed', where: 'Tavern', what: 'Amy dances with her father.' }]
    }
  })
  assert.equal(amy.status, 200, amy.body.message)
  const dance = shotOf(amy, /dances with her father/)
  assert.match(lockOf(dance, 'Amy Reed'), /yellow raincoat/)
  assert.match(lockOf(dance, 'Tom Reed'), /navy wool sweater/)
  const labeled = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Tom Reed', look: 'fifty-eight-year-old fisherman', outfit: 'navy wool sweater' },
        { name: 'Amy Reed', look: 'his daughter, short black hair', outfit: 'yellow raincoat' }
      ],
      places: tavern,
      scenes: [{ who: 'Amy Reed', where: 'Tavern', what: 'Amy dances with her father.' }]
    }
  })
  assert.match(lockOf(shotOf(labeled, /her father/), 'Tom Reed'), /sweater/)
  const leo = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Ana Cole', look: 'forty-year-old teacher, short hair', outfit: 'blue coat' },
        { name: 'Leo Cole', look: "Ana Cole's son, black hair", outfit: 'green sweater' }
      ],
      places: quay,
      scenes: [{ who: 'Leo Cole', where: 'Quay', what: 'Leo calls his mother.' }]
    }
  })
  assert.equal(leo.status, 200, leo.body.message)
  const call = shotOf(leo, /calls his mother/)
  assert.match(lockOf(call, 'Leo Cole'), /green sweater/)
  assert.match(lockOf(call, 'Ana Cole'), /blue coat/)
  const herSon = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Ana Cole', look: 'short hair', outfit: 'blue coat' },
        { name: 'Leo Cole', look: 'her son, black hair', outfit: 'green sweater' }
      ],
      places: quay,
      scenes: [{ who: 'Leo Cole', where: 'Quay', what: 'Leo calls his mother.' }]
    }
  })
  assert.match(lockOf(shotOf(herSon, /his mother/), 'Ana Cole'), /blue coat/)
})

test('two fathers, a bare um pai, and a bare a father add nobody', () => {
  const two = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'pescador, barba grisalha', outfit: 'camisola azul' },
        { name: 'Nuno Silva', look: 'homem, barba curta', outfit: 'casaco castanho' },
        { name: 'Marta Costa', look: 'vinte e oito anos, cabelo preto', outfit: 'impermeável amarelo' }
      ],
      places: [{ name: 'Cais', description: 'o cais' }],
      scenes: [
        { who: 'Rui Costa', where: 'Cais', what: 'Rui é o pai de Marta.' },
        { who: 'Nuno Silva', where: 'Cais', what: 'Nuno é o pai de Marta.' },
        { who: 'Marta Costa', where: 'Cais', what: 'Marta dança com o pai.' }
      ]
    }
  })
  assert.equal(two.status, 200, two.body.message)
  const dance = shotOf(two, /dança com o pai/)
  assert.match(lockOf(dance, 'Marta Costa'), /impermeável/)
  assert.equal(lockOf(dance, 'Rui Costa'), '')
  assert.equal(lockOf(dance, 'Nuno Silva'), '')
  const bareSheet = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'pescador', outfit: 'camisola' },
        { name: 'Nuno Silva', look: 'homem', outfit: 'casaco' },
        { name: 'Marta Costa', look: 'A filha', outfit: 'impermeável' }
      ],
      places: taberna,
      scenes: [{ who: 'Marta Costa', where: 'Taberna', what: 'Marta dança com o pai.' }]
    }
  })
  const ambiguous = shotOf(bareSheet, /dança com o pai/)
  assert.equal(lockOf(ambiguous, 'Rui Costa'), '')
  assert.equal(lockOf(ambiguous, 'Nuno Silva'), '')
  const walker = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'pescador, barba grisalha', outfit: 'camisola azul' },
        { name: 'Marta Costa', look: 'A filha de Rui', outfit: 'impermeável amarelo' }
      ],
      places: [{ name: 'Praia', description: 'a praia' }],
      scenes: [{ who: 'Marta Costa', where: 'Praia', what: 'Um pai passeia na praia.' }]
    }
  })
  assert.equal(lockOf(shotOf(walker, /passeia/), 'Rui Costa'), '')
  const father = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Tom Reed', look: 'grey beard', outfit: 'navy wool sweater' },
        { name: 'Amy Reed', look: "Tom's daughter", outfit: 'yellow raincoat' }
      ],
      places: [{ name: 'Beach', description: 'the beach' }],
      scenes: [{ who: 'Amy Reed', where: 'Beach', what: 'A father walks on the beach.' }]
    }
  })
  assert.equal(lockOf(shotOf(father, /walks on the beach/), 'Tom Reed'), '')
})

test('clothing and props from a character look are not place options in Portuguese or English', () => {
  const portuguese = plan({
    input: 'prose',
    promptLanguage: 'pt',
    prose: 'Rui Costa é um pescador de cinquenta e oito anos, de barba grisalha, com uma camisola azul e um cachimbo. Marta Costa tem vinte e oito anos, cabelo preto curto, um impermeável amarelo. Marta acena.'
  })
  assert.equal(portuguese.status, 200, portuguese.body.message)
  assert.doesNotMatch(`${placeNames(portuguese)} ${optionText(portuguese)}`, /cachimbo|camisola|impermeável/i)
  assert.ok((portuguese.body.warnings || []).some(item => item.code === 'missing_place' || item.code === 'empty_where'))
  const venue = plan({
    input: 'prose',
    promptLanguage: 'pt',
    prose: 'Rui Costa é um pescador, de barba grisalha, com uma camisola azul e um cachimbo. Rui espera no cais.'
  })
  assert.match(placeNames(venue), /Cais/)
  assert.doesNotMatch(`${placeNames(venue)} ${optionText(venue)}`, /cachimbo|camisola/i)
  assert.match(shotOf(venue, /cais/).prompt, /PLACE: Cais/)
  const english = plan({
    input: 'prose',
    promptLanguage: 'en',
    prose: 'Tom Reed is a fifty-eight-year-old fisherman with a grey beard, a navy wool sweater and a pipe. Amy Reed is twenty-eight, with short black hair and a yellow raincoat. Amy waves.'
  })
  assert.equal(english.status, 200, english.body.message)
  assert.doesNotMatch(`${placeNames(english)} ${optionText(english)}`, /pipe|sweater|raincoat/i)
  assert.ok((english.body.warnings || []).some(item => item.code === 'missing_place' || item.code === 'empty_where'))
  const sheets = plan({
    promptLanguage: 'pt',
    scenario: {
      characters: [
        { name: 'Rui Costa', look: 'barba grisalha, cachimbo', outfit: 'camisola azul' },
        { name: 'Marta Costa', look: 'cabelo preto curto', outfit: 'impermeável amarelo' }
      ],
      places: [{ name: 'Cais', description: 'o cais' }],
      scenes: [{ who: 'Rui Costa', where: 'Cais', what: 'Rui acena com o cachimbo.' }]
    }
  })
  assert.match(shotOf(sheets, /acena/).prompt, /PLACE: Cais/)
  assert.doesNotMatch(shotOf(sheets, /acena/).prompt, /PLACE: Cachimbo/)
  assert.doesNotMatch(optionText(sheets), /cachimbo/i)
})

test('Tom Reed has no missing_look when the story already describes him', () => {
  const planned = plan({
    input: 'prose',
    promptLanguage: 'en',
    prose: 'Tom Reed is a fifty-eight-year-old fisherman with a grey beard, a navy wool sweater and a pipe. His daughter, Amy Reed, is twenty-eight, with short black hair, a yellow raincoat and rubber boots. At dawn Tom unties the ropes on the quay. Amy carries the nets to the boat. At night Amy grills sardines in the tavern. Amy dances with her father. Tom sleeps in the chair.'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const dance = shotOf(planned, /dances with her father/)
  assert.match(lockOf(dance, 'Tom Reed'), /pipe/)
  assert.match(lockOf(dance, 'Tom Reed'), /fifty-eight-year-old fisherman/)
  assert.match(lockOf(dance, 'Tom Reed'), /grey beard/)
  assert.match(lockOf(dance, 'Tom Reed'), /navy wool sweater/)
  const looks = (planned.body.warnings || []).filter(item => item.code === 'missing_look')
  assert.equal(looks.some(item => item.name === 'Tom Reed' || item.name === 'Tom'), false)
  const sheets = plan({
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Tom Reed', look: 'fifty-eight-year-old fisherman with a grey beard', outfit: 'navy wool sweater', items: 'pipe' },
        { name: 'Amy Reed', look: 'short black hair', outfit: 'yellow raincoat' }
      ],
      places: tavern,
      scenes: [{ who: 'Tom Reed', where: 'Tavern', what: 'Tom sleeps in the chair.' }]
    }
  })
  assert.equal((sheets.body.warnings || []).some(item => item.code === 'missing_look'), false)
  assert.match(lockOf(shotOf(sheets, /sleeps/), 'Tom Reed'), /grey beard/)
  const bare = plan({ input: 'prose', promptLanguage: 'en', prose: 'Jules enters the cafe. Jules waits by the counter.' })
  assert.equal(bare.status, 200, bare.body.message)
  assert.ok((bare.body.warnings || []).some(item => item.code === 'missing_look' && item.name === 'Jules'))
})
