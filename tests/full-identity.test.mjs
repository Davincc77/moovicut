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

function shotPrompt(shot) {
  return shot.prompt || ''
}

test('an opening action keeps age and every garment, and traits do not cross characters', () => {
  const text = 'Twenty-nine-year-old Petra pulls on a saffron coat and linen gloves in the kiln. Petra carries a brass compass. Ivo is 58. Ivo has grey sideburns and wears an indigo jacket and carries an oak cane. Petra, in a saffron coat and linen gloves, watches Ivo lift an oak cane beside his grey sideburns. Petra waves. Ivo grips the hawser with both hands.'
  const found = detectProse(text)
  const petra = derivedLockLine(found.characters.find(person => person.name === 'Petra'))
  const ivo = derivedLockLine(found.characters.find(person => person.name === 'Ivo'))
  for (const part of [/Twenty-nine/, /saffron coat/, /linen gloves/, /brass compass/]) assert.match(petra, part, petra)
  assert.doesNotMatch(petra, /(?<!year-)\bold\b|sideburns|indigo|oak cane|hawser/i, petra)
  for (const part of [/58/, /grey sideburns/, /indigo jacket/, /oak cane/]) assert.match(ivo, part, ivo)
  assert.doesNotMatch(ivo, /saffron|linen gloves|brass compass|hawser|Twenty-nine/i, ivo)
  assert.equal(found.scenes.some(scene => /grips the hawser/.test(scene.what)), true)
})

test('a short beat and a definite Portuguese dressing line stay shots', () => {
  const english = detectProse('Mara, 30, brown bob, grey coat, waits in the hall. Mara applauds. Mara sits.')
  assert.deepEqual(english.scenes.map(scene => scene.what), [
    'Mara, 30, brown bob, grey coat, waits in the hall',
    'Mara applauds',
    'Mara sits'
  ])
  const portuguese = detectProse('Inês, 28 anos, cabelo curto, casaco azul, espera no cais. Inês veste o fato. Inês acena.')
  assert.equal(portuguese.language, 'pt')
  assert.equal(portuguese.scenes.some(scene => scene.what === 'Inês veste o fato'), true)
  assert.match(derivedLockLine(portuguese.characters.find(person => person.name === 'Inês')), /fato/)
  const wearing = detectProse('Lia tem 12 anos. Lia tem tranças castanhas. Lia veste um vestido verde e carrega uma mochila roxa. Lia espera no cais. Lia acena.')
  assert.equal(wearing.scenes.some(scene => /veste|tranças|12 anos/i.test(scene.what)), false)
})

test('a new place named mid-story replaces the carried place, including an unknown noun', () => {
  const english = detectProse('Owen, 44, grey beard, navy coat, waits in the workshop. The church is quiet. Owen waves. Owen waits in the dining car. The sleeper car is quiet at night. Owen sits. Owen waits in the vineyard. The cellar is quiet. Owen waves. Owen waits in the security room. The gallery is quiet. Owen waves. Owen waits at the box office. On stage, Owen bows. Helen stacks bowls in the oast.')
  assert.deepEqual(english.scenes.map(scene => scene.where), [
    'Workshop',
    'Church',
    'Dining car',
    'Sleeper car',
    'Vineyard',
    'Cellar',
    'Security room',
    'Gallery',
    'Box office',
    'Stage',
    'Oast'
  ])
  const portuguese = detectProse('Teresa, 40 anos, cabelo preto, casaco azul, espera na oficina. A igreja está calma. Teresa espera. Teresa espera na bilheteira. O palco está calmo. Teresa acena. Teresa entra no forno. Teresa acena.')
  assert.equal(portuguese.language, 'pt')
  assert.deepEqual(portuguese.scenes.map(scene => scene.where), ['Oficina', 'Igreja', 'Bilheteira', 'Palco', 'Forno', 'Forno'])
  const planned = plan({ input: 'prose', prose: 'Helen, 31, black bob, wool coat, waits in the yard. Helen stacks bowls in the oast. Helen waves.', model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(planned.body.shots[1].prompt, /PLACE: Oast/i)
})

test('a 45-shot English story repeats each full lock in both parts', () => {
  const intro = 'Twenty-nine-year-old Petra pulls on a saffron coat and linen gloves in the kiln. Petra carries a brass compass. Ivo is 58. Ivo has grey sideburns and wears an indigo jacket and carries an oak cane.'
  const beats = []
  for (let index = 1; index <= 18; index += 1) beats.push(`Petra checks the dial ${index} in the workshop.`)
  beats.push('The church is quiet. Petra applauds.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Petra nods in the church ${index}.`)
  beats.push('Ivo waits in the dining car.')
  beats.push('The sleeper car is quiet at night. Ivo sits.')
  beats.push('Ivo waits in the vineyard.')
  beats.push('The cellar is quiet. Ivo waves.')
  beats.push('Ivo waits in the security room.')
  beats.push('The gallery is quiet. Ivo waves.')
  beats.push('Ivo waits at the box office.')
  beats.push('On stage, Ivo bows.')
  for (let index = 1; index <= 12; index += 1) beats.push(`Ivo taps the rail ${index} in the church.`)
  beats.push('Petra stacks bowls in the kiln.')
  const prose = [intro, ...beats].join(' ')
  const found = detectProse(prose)
  assert.ok(found.scenes.length >= 45, String(found.scenes.length))
  assert.equal(found.scenes.some(scene => scene.what === 'Petra applauds'), true)
  const petra = derivedLockLine(found.characters.find(person => person.name === 'Petra'))
  const ivo = derivedLockLine(found.characters.find(person => person.name === 'Ivo'))
  for (const part of [/Twenty-nine/, /saffron coat/, /linen gloves/, /brass compass/]) assert.match(petra, part, petra)
  for (const part of [/58/, /grey sideburns/, /indigo jacket/, /oak cane/]) assert.match(ivo, part, ivo)
  const planned = plan({ input: 'prose', prose, model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45)
  assert.ok(planned.body.parts.length >= 2)
  assert.ok(planned.body.parts.every(part => part.to - part.from + 1 <= 40))
  const petraParts = new Set()
  const ivoParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const prompt = shotPrompt(shot)
    if (/Petra/.test(prompt) && /SUBJECT|Petra —/.test(prompt)) {
      petraParts.add(part.index)
      for (const piece of [/Twenty-nine/, /saffron coat/, /linen gloves/, /brass compass/]) assert.match(prompt, piece, prompt)
      assert.doesNotMatch(prompt, /sideburns|indigo jacket|oak cane|hawser/i, prompt)
    }
    if (/Ivo —/.test(prompt)) {
      ivoParts.add(part.index)
      for (const piece of [/58/, /grey sideburns/, /indigo jacket/, /oak cane/]) assert.match(prompt, piece, prompt)
      assert.doesNotMatch(prompt, /saffron|linen gloves|brass compass|Twenty-nine/i, prompt)
    }
  })
  assert.ok(petraParts.size >= 2)
  assert.ok(ivoParts.size >= 2)
  assert.match(planned.body.shots.at(-1).prompt, /PLACE: Kiln/i)
})

test('a 45-shot Portuguese story repeats each full lock in both parts', () => {
  const intro = 'Rita, 33 anos, cabelo curto, casaco verde, luvas de lã, espera na oficina. Gil, 61 anos, barba grisalha, jaqueta azul, bengala de carvalho, espera na oficina.'
  const beats = []
  for (let index = 1; index <= 20; index += 1) beats.push(`Rita abre a caixa ${index} na oficina.`)
  beats.push('A igreja está calma. Rita espera.')
  beats.push('Rita veste o fato.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Rita acena na igreja ${index}.`)
  beats.push('Gil espera na bilheteira.')
  beats.push('O palco está calmo. Gil acena.')
  for (let index = 1; index <= 14; index += 1) beats.push(`Gil fecha o livro ${index} no palco.`)
  beats.push('Rita entra no forno.')
  beats.push('Rita acena.')
  const prose = [intro, ...beats].join(' ')
  const found = detectProse(prose)
  assert.equal(found.language, 'pt')
  assert.ok(found.scenes.length >= 45)
  assert.equal(found.scenes.some(scene => scene.what === 'Rita veste o fato'), true)
  const rita = derivedLockLine(found.characters.find(person => person.name === 'Rita'))
  const gil = derivedLockLine(found.characters.find(person => person.name === 'Gil'))
  for (const part of [/33 anos/, /cabelo curto/, /casaco verde/, /luvas de lã/, /fato/]) assert.match(rita, part, rita)
  assert.doesNotMatch(rita, /barba|jaqueta azul|bengala/i, rita)
  for (const part of [/61 anos/, /barba grisalha/, /jaqueta azul/, /bengala de carvalho/]) assert.match(gil, part, gil)
  assert.doesNotMatch(gil, /casaco verde|luvas|fato/i, gil)
  const planned = plan({ input: 'prose', prose, model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45)
  assert.ok(planned.body.parts.length >= 2)
  const ritaParts = new Set()
  const gilParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const prompt = shotPrompt(shot)
    if (/Rita —/.test(prompt)) {
      ritaParts.add(part.index)
      for (const piece of [/33 anos/, /cabelo curto/, /casaco verde/, /luvas de lã/]) assert.match(prompt, piece, prompt)
      const dressed = planned.body.shots.find(item => /veste o fato/.test(item.prompt))
      if (shot.order >= dressed.order) assert.match(prompt, /fato/)
      else assert.doesNotMatch(prompt, /fato/)
      assert.doesNotMatch(prompt, /barba grisalha|jaqueta azul|bengala/i, prompt)
    }
    if (/Gil —/.test(prompt)) {
      gilParts.add(part.index)
      for (const piece of [/61 anos/, /barba grisalha/, /jaqueta azul/, /bengala de carvalho/]) assert.match(prompt, piece, prompt)
      assert.doesNotMatch(prompt, /casaco verde|luvas de lã|fato/i, prompt)
    }
  })
  assert.ok(ritaParts.size >= 2)
  assert.ok(gilParts.size >= 2)
  assert.equal(planned.body.parts.at(-1).place, 'Palco')
  assert.match(planned.body.shots.at(-1).prompt, /PLACE: Forno/i)
})

test('a thin character sheet is filled unless strict_sheet is set, and a complete sheet is repeated on every shot', () => {
  const premise = 'Petra is 29 and wears a saffron coat and carries a brass compass.'
  const places = [{ name: 'Kiln', description: 'a hot kiln' }]
  const scenes = [
    { who: 'Petra', where: 'Kiln', what: 'Petra waves' },
    { who: 'Petra', where: 'Kiln', what: 'Petra sits' }
  ]
  const thin = plan({
    premise,
    strict_sheet: true,
    scenario: {
      characters: [{ name: 'Petra', look: 'short hair', outfit: 'boots' }],
      places,
      scenes
    }
  })
  assert.equal(thin.status, 400)
  assert.equal(thin.body.error, 'invalid_scenario')
  assert.match(thin.body.message, /missing age "29"/)
  assert.match(thin.body.message, /missing outfit "saffron coat"/)
  assert.match(thin.body.message, /missing items "brass compass"/)
  const filled = plan({
    premise,
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{ name: 'Petra', look: 'short hair', outfit: 'boots' }],
      places,
      scenes
    }
  })
  assert.equal(filled.status, 200, filled.body.message)
  for (const warning of [
    { character: 'Petra', field: 'age', value: '29', source: 'premise' },
    { character: 'Petra', field: 'outfit', value: 'saffron coat', source: 'premise' },
    { character: 'Petra', field: 'items', value: 'brass compass', source: 'premise' }
  ]) {
    assert.ok(filled.body.warnings.some(item => item.character === warning.character && item.field === warning.field && item.value === warning.value && item.source === warning.source), JSON.stringify(filled.body.warnings))
  }
  for (const shot of filled.body.shots) {
    assert.match(shot.prompt, /29/)
    assert.match(shot.prompt, /saffron coat/)
    assert.match(shot.prompt, /brass compass/)
  }
  const full = plan({
    premise,
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{ name: 'Petra', age: '29', look: 'short hair', outfit: 'saffron coat', items: 'brass compass' }],
      places,
      scenes
    }
  })
  assert.equal(full.status, 200, full.body.message)
  assert.equal(full.body.shots.length, 2)
  for (const shot of full.body.shots) {
    assert.match(shot.prompt, /Petra — 29, short hair, saffron coat, brass compass\./)
    assert.match(shot.prompt, /PLACE: Kiln/i)
  }
})
