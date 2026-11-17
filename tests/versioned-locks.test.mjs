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

function warning(body, field, value) {
  return (body.warnings || []).find(item => item.field === field && item.value === value)
}

test('a thin English sheet is filled with warnings and strict_sheet stays 400', () => {
  const places = [{ name: 'Workshop', description: 'a warm workshop' }]
  const scenes = [
    { who: 'Branca', where: 'Workshop', what: 'Branca is 19 and wears a plum cloak and carries a tin whistle' },
    { who: 'Branca', where: 'Workshop', what: 'Branca sits' }
  ]
  const scenario = {
    characters: [{ name: 'Branca', look: 'short hair', outfit: 'boots' }],
    places,
    scenes
  }
  const filled = plan({ premise: 'Branca waits in the workshop.', model: 'grok', compact: true, scenario })
  assert.equal(filled.status, 200, filled.body.message)
  assert.equal(filled.body.shots.length, 2)
  for (const expected of [
    { character: 'Branca', field: 'age', value: '19', source: 'scene 1' },
    { character: 'Branca', field: 'outfit', value: 'plum cloak', source: 'scene 1' },
    { character: 'Branca', field: 'items', value: 'tin whistle', source: 'scene 1' }
  ]) {
    const found = warning(filled.body, expected.field, expected.value)
    assert.ok(found, JSON.stringify(filled.body.warnings))
    assert.equal(found.character, expected.character)
    assert.equal(found.source, expected.source)
  }
  for (const shot of filled.body.shots) {
    assert.match(shot.prompt, /Branca — 19, short hair, boots, plum cloak, tin whistle\./)
  }
  const strict = plan({ premise: 'Branca waits in the workshop.', strict_sheet: true, scenario })
  assert.equal(strict.status, 400)
  assert.equal(strict.body.error, 'invalid_scenario')
  assert.match(strict.body.message, /missing age "19"/)
  assert.match(strict.body.message, /missing outfit "plum cloak"/)
  assert.match(strict.body.message, /missing items "tin whistle"/)
  const bare = plan({
    premise: 'Branca waits in the workshop.',
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{ name: 'Branca', look: 'short hair', outfit: 'boots' }],
      places,
      scenes: [
        { who: 'Branca', where: 'Workshop', what: 'Branca waits' },
        { who: 'Branca', where: 'Workshop', what: 'Branca sits' }
      ]
    }
  })
  assert.equal(bare.status, 200, bare.body.message)
  assert.equal((bare.body.warnings || []).some(item => item.code === 'sheet_filled'), false)
  assert.match(bare.body.shots[0].prompt, /short hair/)
  assert.match(bare.body.shots[0].prompt, /boots/)
  assert.doesNotMatch(bare.body.shots[0].prompt, /19|plum cloak|tin whistle|velvet/)
})

test('a thin Portuguese sheet is filled with warnings and strict_sheet stays 400', () => {
  const scenario = {
    characters: [{ name: 'Branca', look: 'cabelo curto', outfit: 'botas' }],
    places: [{ name: 'Oficina', description: 'uma oficina quente' }],
    scenes: [
      { who: 'Branca', where: 'Oficina', what: 'Branca tem 19 anos e veste um casaco azul e carrega um apito' },
      { who: 'Branca', where: 'Oficina', what: 'Branca senta' }
    ]
  }
  const filled = plan({ premise: 'Branca espera na oficina.', model: 'grok', compact: true, promptLanguage: 'pt', scenario })
  assert.equal(filled.status, 200, filled.body.message)
  const age = (filled.body.warnings || []).find(item => item.character === 'Branca' && item.field === 'age')
  const outfit = (filled.body.warnings || []).find(item => item.character === 'Branca' && item.field === 'outfit')
  const items = (filled.body.warnings || []).find(item => item.character === 'Branca' && item.field === 'items')
  assert.ok(age && /19/.test(age.value) && age.source === 'scene 1', JSON.stringify(filled.body.warnings))
  assert.ok(outfit && /casaco azul/.test(outfit.value) && outfit.source === 'scene 1', JSON.stringify(outfit))
  assert.ok(items && /apito/.test(items.value) && items.source === 'scene 1', JSON.stringify(items))
  for (const shot of filled.body.shots) {
    assert.match(shot.prompt, /19/)
    assert.match(shot.prompt, /casaco azul/)
    assert.match(shot.prompt, /apito/)
    assert.match(shot.prompt, /botas/)
  }
  const strict = plan({ premise: 'Branca espera na oficina.', strictSheet: true, scenario })
  assert.equal(strict.status, 400)
  assert.equal(strict.body.error, 'invalid_scenario')
  assert.match(strict.body.message, /missing age/)
  assert.match(strict.body.message, /missing outfit/)
  assert.match(strict.body.message, /missing items/)
})

function lineOf(prompt, name) {
  return prompt.split('\n').find(item => item.startsWith(`${name} —`) || item.startsWith(`SUBJECT: ${name} —`)) || ''
}

test('an English story keeps the earlier lock until a cloak, a pickup, and a drop', () => {
  const intro = 'Nila is 31. Nila has copper hair and wears an olive parka. Calder is 47. Calder has a grey beard and wears a russet waistcoat and carries an oak cane.'
  const beats = []
  for (let index = 1; index <= 18; index += 1) beats.push(`Nila checks the dial ${index} in the workshop.`)
  beats.push('Nila puts on a plum cloak.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Nila nods in the church ${index}.`)
  beats.push('Nila picks up a tin whistle.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Nila taps the rail ${index} in the church.`)
  beats.push('Nila sets down the tin whistle.')
  for (let index = 1; index <= 10; index += 1) beats.push(`Calder waves in the workshop ${index}.`)
  beats.push('Nila stacks bowls in the kiln.')
  const prose = [intro, ...beats].join(' ')
  const planned = plan({ input: 'prose', prose, model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45, String(planned.body.shots.length))
  assert.ok(planned.body.parts.length >= 2)
  assert.ok(planned.body.parts.every(part => part.to - part.from + 1 <= 40))
  for (let index = 1; index <= 18; index += 1) {
    assert.ok(planned.body.shots.some(shot => shot.prompt.includes(`checks the dial ${index}`)), `dial ${index}`)
  }
  assert.ok(planned.body.shots.some(shot => shot.prompt.includes('puts on a plum cloak')))
  assert.ok(planned.body.shots.some(shot => shot.prompt.includes('picks up a tin whistle')))
  assert.ok(planned.body.shots.some(shot => shot.prompt.includes('sets down the tin whistle')))
  const cloak = planned.body.shots.find(shot => shot.prompt.includes('puts on a plum cloak'))
  const pickup = planned.body.shots.find(shot => shot.prompt.includes('picks up a tin whistle'))
  const drop = planned.body.shots.find(shot => shot.prompt.includes('sets down the tin whistle'))
  assert.ok(cloak.order < pickup.order && pickup.order < drop.order)
  const nilaParts = new Set()
  const ottoParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const nila = lineOf(shot.prompt, 'Nila')
    const otto = lineOf(shot.prompt, 'Calder')
    if (nila) {
      nilaParts.add(part.index)
      assert.match(nila, /31/)
      assert.match(nila, /copper hair/)
      assert.match(nila, /olive parka/)
      assert.doesNotMatch(nila, /grey beard|russet waistcoat|oak cane/)
      if (shot.order < cloak.order) assert.doesNotMatch(nila, /plum cloak/)
      else assert.match(nila, /plum cloak/)
      if (shot.order < pickup.order || shot.order >= drop.order) assert.doesNotMatch(nila, /tin whistle/)
      else assert.match(nila, /tin whistle/)
    }
    if (otto) {
      ottoParts.add(part.index)
      assert.match(otto, /47/)
      assert.match(otto, /grey beard/)
      assert.match(otto, /russet waistcoat/)
      assert.match(otto, /oak cane/)
      assert.doesNotMatch(otto, /plum cloak|tin whistle|olive parka|copper hair|31/)
    }
  })
  assert.ok(nilaParts.size >= 2)
  assert.ok(ottoParts.size >= 1)
  assert.ok([...nilaParts].some(index => index >= 2))
})

test('a Portuguese story keeps the earlier lock until a colete, a pickup, and a drop', () => {
  const intro = 'Branca, 19 anos, cabelo curto, casaco azul, espera na oficina. Duarte, 52 anos, barba grisalha, jaqueta verde, bengala de carvalho, espera na oficina.'
  const beats = []
  for (let index = 1; index <= 18; index += 1) beats.push(`Branca abre a caixa ${index} na oficina.`)
  beats.push('Branca veste o colete.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Branca acena na igreja ${index}.`)
  beats.push('Branca pega uma lanterna.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Branca fecha o livro ${index} na igreja.`)
  beats.push('Branca larga a lanterna.')
  for (let index = 1; index <= 10; index += 1) beats.push(`Duarte acena na oficina ${index}.`)
  beats.push('Branca entra no forno.')
  beats.push('Branca acena.')
  const prose = [intro, ...beats].join(' ')
  const planned = plan({ input: 'prose', prose, model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45, String(planned.body.shots.length))
  assert.ok(planned.body.parts.length >= 2)
  for (let index = 1; index <= 18; index += 1) {
    assert.ok(planned.body.shots.some(shot => shot.prompt.includes(`abre a caixa ${index}`)), `caixa ${index}`)
  }
  assert.ok(planned.body.shots.some(shot => shot.prompt.includes('veste o colete')))
  assert.ok(planned.body.shots.some(shot => shot.prompt.includes('pega uma lanterna')))
  assert.ok(planned.body.shots.some(shot => shot.prompt.includes('larga a lanterna')))
  const colete = planned.body.shots.find(shot => shot.prompt.includes('veste o colete'))
  const pickup = planned.body.shots.find(shot => shot.prompt.includes('pega uma lanterna'))
  const drop = planned.body.shots.find(shot => shot.prompt.includes('larga a lanterna'))
  assert.ok(colete.order < pickup.order && pickup.order < drop.order)
  const brancaParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const branca = lineOf(shot.prompt, 'Branca')
    const duarte = lineOf(shot.prompt, 'Duarte')
    if (branca) {
      brancaParts.add(part.index)
      assert.match(branca, /19/)
      assert.match(branca, /cabelo curto/)
      assert.match(branca, /casaco azul/)
      assert.doesNotMatch(branca, /barba grisalha|jaqueta verde|bengala/)
      if (shot.order < colete.order) assert.doesNotMatch(branca, /colete/)
      else assert.match(branca, /colete/)
      if (shot.order < pickup.order || shot.order >= drop.order) assert.doesNotMatch(branca, /lanterna/)
      else assert.match(branca, /lanterna/)
    }
    if (duarte) {
      assert.match(duarte, /52/)
      assert.match(duarte, /barba grisalha/)
      assert.match(duarte, /jaqueta verde/)
      assert.match(duarte, /bengala/)
      assert.doesNotMatch(duarte, /colete|lanterna|casaco azul|cabelo curto/)
    }
  })
  assert.ok([...brancaParts].some(index => index >= 2))
})

test('a declared lock version starts at that shot and an out-of-range version is not applied', () => {
  const places = [{ name: 'Workshop', description: 'a warm workshop' }]
  const scenes = [
    { who: 'Nila', where: 'Workshop', what: 'Nila waves' },
    { who: 'Nila', where: 'Workshop', what: 'Nila sits' },
    { who: 'Nila', where: 'Workshop', what: 'Nila nods' },
    { who: 'Nila', where: 'Workshop', what: 'Nila bows' }
  ]
  const planned = plan({
    premise: 'Nila works in the workshop.',
    model: 'grok',
    compact: true,
    format: 'agent',
    scenario: {
      characters: [{
        name: 'Nila',
        age: '31',
        look: 'copper hair',
        outfit: 'olive parka',
        items: 'tin whistle',
        locks: [
          { fromOrder: 3, outfit: 'plum cloak' },
          { fromOrder: 9, outfit: 'velvet cape' }
        ]
      }],
      places,
      scenes
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.equal(planned.body.shots.length, 4)
  planned.body.shots.forEach(shot => {
    const line = lineOf(shot.prompt, 'Nila')
    assert.match(line, /31/)
    assert.match(line, /copper hair/)
    assert.match(line, /olive parka/)
    assert.match(line, /tin whistle/)
    assert.doesNotMatch(line, /velvet cape/)
    if (shot.order < 3) assert.doesNotMatch(line, /plum cloak/)
    else assert.match(line, /plum cloak/)
  })
  const rejected = (planned.body.warnings || []).find(item => item.field === 'fromOrder' && item.value === '9')
  assert.ok(rejected, JSON.stringify(planned.body.warnings))
  assert.equal(rejected.character, 'Nila')
  assert.equal(rejected.source, 'sheet')
  assert.ok(planned.body.filmSheet.characters[0].locks.length >= 2)
})

test('handing an item moves it to the receiver and does not copy the rest of the lock', () => {
  const planned = plan({
    premise: 'Nila and Otto share the workshop.',
    model: 'grok',
    compact: true,
    scenario: {
      characters: [
        { name: 'Nila', age: '31', look: 'copper hair', outfit: 'olive parka', items: 'tin whistle' },
        { name: 'Otto', age: '47', look: 'grey beard', outfit: 'russet waistcoat', items: 'oak cane' }
      ],
      places: [{ name: 'Workshop', description: 'a warm workshop' }],
      scenes: [
        { who: 'Nila', where: 'Workshop', what: 'Nila waves' },
        { who: 'Nila and Otto', where: 'Workshop', what: 'Nila hands the tin whistle to Otto' },
        { who: 'Otto', where: 'Workshop', what: 'Otto bows' },
        { who: 'Nila', where: 'Workshop', what: 'Nila sits' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  const [first, hand, bow, last] = planned.body.shots
  assert.match(lineOf(first.prompt, 'Nila'), /tin whistle/)
  assert.doesNotMatch(lineOf(first.prompt, 'Nila'), /oak cane|grey beard/)
  assert.match(lineOf(hand.prompt, 'Nila'), /olive parka/)
  assert.doesNotMatch(lineOf(hand.prompt, 'Nila'), /tin whistle/)
  assert.match(lineOf(hand.prompt, 'Otto'), /oak cane/)
  assert.match(lineOf(hand.prompt, 'Otto'), /tin whistle/)
  assert.doesNotMatch(lineOf(hand.prompt, 'Otto'), /olive parka|copper hair/)
  assert.match(lineOf(bow.prompt, 'Otto'), /tin whistle/)
  assert.match(lineOf(bow.prompt, 'Otto'), /russet waistcoat/)
  assert.doesNotMatch(lineOf(last.prompt, 'Nila'), /tin whistle/)
  assert.match(lineOf(last.prompt, 'Nila'), /31/)
  assert.match(lineOf(last.prompt, 'Nila'), /olive parka/)
})
