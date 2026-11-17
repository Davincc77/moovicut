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

function lineOf(prompt, name) {
  return String(prompt || '').split('\n').find(item => item.startsWith(`${name} —`) || item.startsWith(`SUBJECT: ${name} —`)) || ''
}

function beat(who, where, what) {
  return { who, where, what, duration: 3 }
}

function numbered(who, where, verb, count) {
  return Array.from({ length: count }, (_, index) => beat(who, where, `${who} ${verb} ${index + 1}`))
}

test('a carried concrete noun stays beside the coat and the other item, and despe removes only that garment', () => {
  const carried = plan({
    premise: 'Orla works in the workshop.',
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{ name: 'Orla', age: '34', look: 'ash hair', outfit: 'navy coat', items: 'cedar box' }],
      places: [{ name: 'Workshop', description: 'a warm workshop' }],
      scenes: [
        beat('Orla', 'Workshop', 'Orla waves'),
        beat('Orla', 'Workshop', 'Orla carries a linen sack'),
        beat('Orla', 'Workshop', 'Orla bows')
      ]
    }
  })
  assert.equal(carried.status, 200, carried.body.message)
  const [first, carry, last] = carried.body.shots
  for (const shot of [first, carry, last]) {
    const line = lineOf(shot.prompt, 'Orla')
    assert.match(line, /34/)
    assert.match(line, /navy coat/)
    assert.match(line, /cedar box/)
  }
  for (const shot of [first, carry, last]) assert.match(lineOf(shot.prompt, 'Orla'), /linen sack/)
  const despe = plan({
    premise: 'Nessa trabalha na oficina.',
    model: 'grok',
    compact: true,
    format: 'agent',
    promptLanguage: 'pt',
    scenario: {
      characters: [{ name: 'Nessa', age: '27', look: 'cabelo ruivo', outfit: 'casaco verde, lenço creme', items: 'caixa de cedro' }],
      places: [{ name: 'Oficina', description: 'uma oficina quente' }],
      scenes: [
        beat('Nessa', 'Oficina', 'Nessa acena'),
        beat('Nessa', 'Oficina', 'Nessa despe o casaco')
      ]
    }
  })
  assert.equal(despe.status, 200, despe.body.message)
  assert.match(lineOf(despe.body.shots[0].prompt, 'Nessa'), /casaco verde/)
  const bare = lineOf(despe.body.shots[1].prompt, 'Nessa')
  assert.doesNotMatch(bare, /casaco/)
  assert.match(bare, /lenço creme/)
  assert.match(bare, /caixa de cedro/)
  assert.match(bare, /27/)
  assert.equal((despe.body.warnings || []).some(item => item.code === 'undeclared_wardrobe'), false)
})

test('a note removes one garment and puts on adds one, keeping age, the rest, and items', () => {
  const places = [{ name: 'Workshop', description: 'a warm workshop' }]
  const removed = plan({
    premise: 'Orla works in the workshop.',
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{
        name: 'Orla',
        age: '34',
        look: 'ash hair',
        outfit: 'navy coat, cream scarf',
        items: 'cedar box',
        states: [{ fromOrder: 3, change: 'coat removed' }]
      }],
      places,
      scenes: [
        beat('Orla', 'Workshop', 'Orla waves'),
        beat('Orla', 'Workshop', 'Orla sits'),
        beat('Orla', 'Workshop', 'Orla nods'),
        beat('Orla', 'Workshop', 'Orla bows')
      ]
    }
  })
  assert.equal(removed.status, 200, removed.body.message)
  removed.body.shots.forEach(shot => {
    const line = lineOf(shot.prompt, 'Orla')
    assert.match(line, /34/)
    assert.match(line, /ash hair/)
    assert.match(line, /cream scarf/)
    assert.match(line, /cedar box/)
    assert.doesNotMatch(line, /coat removed/)
    if (shot.order < 3) assert.match(line, /navy coat/)
    else assert.doesNotMatch(line, /navy coat|peacoat/)
  })
  const added = plan({
    premise: 'Orla works in the workshop.',
    model: 'grok',
    compact: true,
    scenario: {
      characters: [{
        name: 'Orla',
        age: '34',
        look: 'ash hair',
        outfit: 'navy coat, cream scarf',
        items: 'cedar box',
        states: [{ fromOrder: 2, change: 'puts on a plum cloak' }]
      }],
      places,
      scenes: [
        beat('Orla', 'Workshop', 'Orla waves'),
        beat('Orla', 'Workshop', 'Orla sits')
      ]
    }
  })
  assert.equal(added.status, 200, added.body.message)
  const before = lineOf(added.body.shots[0].prompt, 'Orla')
  const after = lineOf(added.body.shots[1].prompt, 'Orla')
  assert.doesNotMatch(before, /plum cloak/)
  assert.match(after, /plum cloak/)
  for (const line of [before, after]) {
    assert.match(line, /34/)
    assert.match(line, /navy coat/)
    assert.match(line, /cream scarf/)
    assert.match(line, /cedar box/)
  }
})

test('a Portuguese note removes one garment and põe adds one', () => {
  const places = [{ name: 'Oficina', description: 'uma oficina quente' }]
  const removed = plan({
    premise: 'Nessa trabalha na oficina.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt',
    scenario: {
      characters: [{
        name: 'Nessa',
        age: '27',
        look: 'cabelo ruivo',
        outfit: 'casaco verde, lenço creme',
        items: 'caixa de cedro',
        states: [{ fromOrder: 2, change: 'casaco tirado' }]
      }],
      places,
      scenes: [
        beat('Nessa', 'Oficina', 'Nessa acena'),
        beat('Nessa', 'Oficina', 'Nessa senta')
      ]
    }
  })
  assert.equal(removed.status, 200, removed.body.message)
  const early = lineOf(removed.body.shots[0].prompt, 'Nessa')
  const later = lineOf(removed.body.shots[1].prompt, 'Nessa')
  assert.match(early, /casaco verde/)
  assert.doesNotMatch(later, /casaco/)
  for (const line of [early, later]) {
    assert.match(line, /27/)
    assert.match(line, /cabelo ruivo/)
    assert.match(line, /lenço creme/)
    assert.match(line, /caixa de cedro/)
    assert.doesNotMatch(line, /tirado/)
  }
  const added = plan({
    premise: 'Nessa trabalha na oficina.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt',
    scenario: {
      characters: [{
        name: 'Nessa',
        age: '27',
        look: 'cabelo ruivo',
        outfit: 'casaco verde, lenço creme',
        items: 'caixa de cedro',
        states: [{ fromOrder: 2, change: 'põe um colete' }]
      }],
      places,
      scenes: [
        beat('Nessa', 'Oficina', 'Nessa acena'),
        beat('Nessa', 'Oficina', 'Nessa senta')
      ]
    }
  })
  assert.equal(added.status, 200, added.body.message)
  assert.doesNotMatch(lineOf(added.body.shots[0].prompt, 'Nessa'), /colete/)
  const dressed = lineOf(added.body.shots[1].prompt, 'Nessa')
  assert.match(dressed, /colete/)
  assert.match(dressed, /casaco verde/)
  assert.match(dressed, /lenço creme/)
  assert.match(dressed, /caixa de cedro/)
  assert.match(dressed, /27/)
})

test('an abstract noun or a place is not a carried item, and a basket or key is', () => {
  const english = plan({
    premise: 'Orla and Jory share the workshop.',
    model: 'grok',
    compact: true,
    scenario: {
      characters: [
        { name: 'Orla', age: '34', look: 'ash hair', outfit: 'navy coat', items: 'cedar box' },
        { name: 'Jory', age: '46', look: 'black beard', outfit: 'slate jacket', items: 'brass pen' }
      ],
      places: [{ name: 'Workshop', description: 'a warm workshop' }],
      scenes: [
        beat('Orla', 'Workshop', 'Orla picks up hope'),
        beat('Orla', 'Workshop', 'Orla picks up the workshop'),
        beat('Orla', 'Workshop', 'Orla picks up a wicker basket'),
        beat('Orla', 'Workshop', 'Orla drops the wicker basket'),
        beat('Orla', 'Workshop', 'Orla picks up a brass key'),
        beat('Orla and Jory', 'Workshop', 'Orla hands the letter to Jory'),
        beat('Jory', 'Workshop', 'Jory bows')
      ]
    }
  })
  assert.equal(english.status, 200, english.body.message)
  const basket = english.body.shots.find(shot => shot.prompt.includes('picks up a wicker basket'))
  const drop = english.body.shots.find(shot => shot.prompt.includes('drops the wicker basket'))
  const key = english.body.shots.find(shot => shot.prompt.includes('picks up a brass key'))
  const hand = english.body.shots.find(shot => shot.prompt.includes('hands the letter to Jory'))
  english.body.shots.forEach(shot => {
    const orla = lineOf(shot.prompt, 'Orla')
    const jory = lineOf(shot.prompt, 'Jory')
    if (orla) {
      assert.match(orla, /34/)
      assert.match(orla, /ash hair/)
      assert.match(orla, /navy coat/)
      assert.match(orla, /cedar box/)
      assert.doesNotMatch(orla, /hope|workshop|black beard|slate jacket|brass pen|letter/)
      if (shot.order >= basket.order && shot.order < drop.order) assert.match(orla, /wicker basket/)
      else assert.doesNotMatch(orla, /basket/)
      if (shot.order >= key.order) assert.match(orla, /brass key/)
      else assert.doesNotMatch(orla, /key/)
    }
    if (jory) {
      assert.match(jory, /46/)
      assert.match(jory, /black beard/)
      assert.match(jory, /slate jacket/)
      assert.match(jory, /brass pen/)
      assert.doesNotMatch(jory, /ash hair|navy coat|cedar box|wicker basket|brass key|hope/)
      if (shot.order >= hand.order) assert.match(jory, /letter/)
      else assert.doesNotMatch(jory, /letter/)
    }
  })
  const portuguese = plan({
    premise: 'Nessa trabalha na oficina.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt',
    scenario: {
      characters: [{ name: 'Nessa', age: '27', look: 'cabelo ruivo', outfit: 'casaco verde', items: 'caixa de cedro' }],
      places: [{ name: 'Oficina', description: 'uma oficina quente' }],
      scenes: [
        beat('Nessa', 'Oficina', 'Nessa pega a esperança'),
        beat('Nessa', 'Oficina', 'Nessa pega a oficina'),
        beat('Nessa', 'Oficina', 'Nessa pega um cesto de vime'),
        beat('Nessa', 'Oficina', 'Nessa larga o cesto de vime'),
        beat('Nessa', 'Oficina', 'Nessa pega uma chave de latão'),
        beat('Nessa', 'Oficina', 'Nessa tira o chapéu')
      ]
    }
  })
  assert.equal(portuguese.status, 200, portuguese.body.message)
  const cesto = portuguese.body.shots.find(shot => shot.prompt.includes('pega um cesto de vime'))
  const larga = portuguese.body.shots.find(shot => shot.prompt.includes('larga o cesto de vime'))
  const chave = portuguese.body.shots.find(shot => shot.prompt.includes('pega uma chave de latão'))
  portuguese.body.shots.forEach(shot => {
    const line = lineOf(shot.prompt, 'Nessa')
    assert.match(line, /27/)
    assert.match(line, /casaco verde/)
    assert.match(line, /caixa de cedro/)
    assert.doesNotMatch(line, /esperança|esperanca|oficina/)
    if (shot.order >= cesto.order && shot.order < larga.order) assert.match(line, /cesto de vime/)
    else assert.doesNotMatch(line, /cesto/)
    if (shot.order >= chave.order) assert.match(line, /chave de latão/)
    else assert.doesNotMatch(line, /chave/)
  })
  const hat = (portuguese.body.warnings || []).find(item => item.code === 'undeclared_wardrobe')
  assert.ok(hat, JSON.stringify(portuguese.body.warnings))
  assert.equal(hat.phrase, 'chapéu removed')
  assert.match(lineOf(portuguese.body.shots.at(-1).prompt, 'Nessa'), /casaco verde/)
})

test('a long English story versions a handed letter, a pastry, a coat note, and a takes off', () => {
  const scenes = [
    ...numbered('Orla', 'Workshop', 'checks the dial', 12),
    ...numbered('Orla', 'Workshop', 'nods at the rail', 8),
    beat('Orla and Jory', 'Workshop', 'Orla hands the letter to Jory'),
    ...numbered('Orla', 'Workshop', 'taps the gauge', 7),
    ...numbered('Jory', 'Workshop', 'waves at the bench', 4),
    beat('Orla', 'Workshop', 'Orla picks up a pastry'),
    ...numbered('Orla', 'Workshop', 'stacks the bowl', 5),
    beat('Orla', 'Workshop', 'Orla takes off the scarf'),
    ...numbered('Orla', 'Workshop', 'folds the cloth', 7),
    beat('Jory', 'Workshop', 'Jory sits by the stove')
  ]
  const planned = plan({
    premise: 'Orla and Jory share the workshop.',
    model: 'grok',
    compact: true,
    format: 'agent',
    scenario: {
      characters: [
        {
          name: 'Orla',
          age: '34',
          look: 'ash hair',
          outfit: 'navy coat, cream scarf',
          items: 'cedar box',
          states: [{ fromOrder: 13, change: 'coat removed' }]
        },
        { name: 'Jory', age: '46', look: 'black beard', outfit: 'slate jacket', items: 'brass pen' }
      ],
      places: [{ name: 'Workshop', description: 'a warm workshop' }],
      scenes
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45, String(planned.body.shots.length))
  assert.equal(planned.body.shots.length, scenes.length)
  assert.ok(planned.body.parts.length >= 2)
  assert.ok(planned.body.parts.every(part => part.to - part.from + 1 <= 40))
  for (let index = 1; index <= 12; index += 1) {
    assert.ok(planned.body.shots.some(shot => shot.prompt.includes(`checks the dial ${index}`)), `dial ${index}`)
  }
  for (let index = 1; index <= 7; index += 1) {
    assert.ok(planned.body.shots.some(shot => shot.prompt.includes(`folds the cloth ${index}`)), `cloth ${index}`)
  }
  const hand = planned.body.shots.find(shot => shot.prompt.includes('hands the letter to Jory'))
  const pastry = planned.body.shots.find(shot => shot.prompt.includes('picks up a pastry'))
  const scarf = planned.body.shots.find(shot => shot.prompt.includes('takes off the scarf'))
  assert.ok(hand && pastry && scarf)
  assert.ok(hand.order < pastry.order && pastry.order < scarf.order)
  assert.ok(scarf.order <= 40)
  const orlaParts = new Set()
  const joryParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const orla = lineOf(shot.prompt, 'Orla')
    const jory = lineOf(shot.prompt, 'Jory')
    if (orla) {
      orlaParts.add(part.index)
      assert.match(orla, /34/)
      assert.match(orla, /ash hair/)
      assert.match(orla, /cedar box/)
      assert.doesNotMatch(orla, /black beard|slate jacket|brass pen|letter/)
      assert.doesNotMatch(orla, /coat removed/)
      if (shot.order < 13) assert.match(orla, /navy coat/)
      else assert.doesNotMatch(orla, /navy coat/)
      if (shot.order < scarf.order) assert.match(orla, /cream scarf/)
      else assert.doesNotMatch(orla, /scarf/)
      if (shot.order < pastry.order) assert.doesNotMatch(orla, /pastry/)
      else assert.match(orla, /pastry/)
    }
    if (jory) {
      joryParts.add(part.index)
      assert.match(jory, /46/)
      assert.match(jory, /black beard/)
      assert.match(jory, /slate jacket/)
      assert.match(jory, /brass pen/)
      assert.doesNotMatch(jory, /ash hair|navy coat|cream scarf|cedar box|pastry|34/)
      if (shot.order < hand.order) assert.doesNotMatch(jory, /letter/)
      else assert.match(jory, /letter/)
    }
  })
  assert.ok([...orlaParts].some(index => index >= 2))
  assert.ok([...joryParts].some(index => index >= 2))
  const later = planned.body.shots.filter(shot => shot.order > 40 && lineOf(shot.prompt, 'Orla'))
  assert.ok(later.length >= 1)
  later.forEach(shot => {
    const line = lineOf(shot.prompt, 'Orla')
    assert.match(line, /34/)
    assert.match(line, /cedar box/)
    assert.match(line, /pastry/)
    assert.doesNotMatch(line, /navy coat|cream scarf/)
  })
  assert.equal((planned.body.warnings || []).some(item => item.code === 'undeclared_wardrobe'), false)
})

test('a long Portuguese story versions a handed carta, a pastel, a casaco note, and tira', () => {
  const scenes = [
    ...numbered('Nessa', 'Oficina', 'abre a gaveta', 12),
    ...numbered('Nessa', 'Oficina', 'fecha o livro', 8),
    beat('Nessa and Tadeu', 'Oficina', 'Nessa entrega a carta a Tadeu'),
    ...numbered('Nessa', 'Oficina', 'conta a ficha', 7),
    ...numbered('Tadeu', 'Oficina', 'acena na bancada', 4),
    beat('Nessa', 'Oficina', 'Nessa pega um pastel'),
    ...numbered('Nessa', 'Oficina', 'empilha a tigela', 5),
    beat('Nessa', 'Oficina', 'Nessa tira o lenço'),
    ...numbered('Nessa', 'Oficina', 'dobra o mapa', 7),
    beat('Tadeu', 'Oficina', 'Tadeu senta no banco')
  ]
  const planned = plan({
    premise: 'Nessa e Tadeu partilham a oficina.',
    model: 'grok',
    compact: true,
    format: 'agent',
    promptLanguage: 'pt',
    scenario: {
      characters: [
        {
          name: 'Nessa',
          age: '27',
          look: 'cabelo ruivo',
          outfit: 'casaco verde, lenço creme',
          items: 'caixa de cedro',
          states: [{ fromOrder: 13, change: 'casaco tirado' }]
        },
        { name: 'Tadeu', age: '51', look: 'barba preta', outfit: 'jaqueta azul', items: 'caneta de bronze' }
      ],
      places: [{ name: 'Oficina', description: 'uma oficina quente' }],
      scenes
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45, String(planned.body.shots.length))
  assert.equal(planned.body.shots.length, scenes.length)
  assert.ok(planned.body.parts.length >= 2)
  for (let index = 1; index <= 12; index += 1) {
    assert.ok(planned.body.shots.some(shot => shot.prompt.includes(`abre a gaveta ${index}`)), `gaveta ${index}`)
  }
  for (let index = 1; index <= 7; index += 1) {
    assert.ok(planned.body.shots.some(shot => shot.prompt.includes(`dobra o mapa ${index}`)), `mapa ${index}`)
  }
  const hand = planned.body.shots.find(shot => shot.prompt.includes('entrega a carta a Tadeu'))
  const pastel = planned.body.shots.find(shot => shot.prompt.includes('pega um pastel'))
  const lenco = planned.body.shots.find(shot => shot.prompt.includes('tira o lenço'))
  assert.ok(hand && pastel && lenco)
  assert.ok(hand.order < pastel.order && pastel.order < lenco.order)
  const nessaParts = new Set()
  const tadeuParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const nessa = lineOf(shot.prompt, 'Nessa')
    const tadeu = lineOf(shot.prompt, 'Tadeu')
    if (nessa) {
      nessaParts.add(part.index)
      assert.match(nessa, /27/)
      assert.match(nessa, /cabelo ruivo/)
      assert.match(nessa, /caixa de cedro/)
      assert.doesNotMatch(nessa, /barba preta|jaqueta azul|caneta de bronze|carta/)
      assert.doesNotMatch(nessa, /tirado/)
      if (shot.order < 13) assert.match(nessa, /casaco verde/)
      else assert.doesNotMatch(nessa, /casaco/)
      if (shot.order < lenco.order) assert.match(nessa, /lenço creme/)
      else assert.doesNotMatch(nessa, /lenço|lenco/)
      if (shot.order < pastel.order) assert.doesNotMatch(nessa, /pastel/)
      else assert.match(nessa, /pastel/)
    }
    if (tadeu) {
      tadeuParts.add(part.index)
      assert.match(tadeu, /51/)
      assert.match(tadeu, /barba preta/)
      assert.match(tadeu, /jaqueta azul/)
      assert.match(tadeu, /caneta de bronze/)
      assert.doesNotMatch(tadeu, /cabelo ruivo|casaco verde|lenço|caixa de cedro|pastel|27/)
      if (shot.order < hand.order) assert.doesNotMatch(tadeu, /carta/)
      else assert.match(tadeu, /carta/)
    }
  })
  assert.ok([...nessaParts].some(index => index >= 2))
  assert.ok([...tadeuParts].some(index => index >= 2))
  assert.equal((planned.body.warnings || []).some(item => item.code === 'undeclared_wardrobe'), false)
})
