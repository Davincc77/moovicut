import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { detectProse } from '../app/utils/prose-detect.js'
import { characterSheetGaps, keptTrait } from '../app/utils/prose-extra.js'
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

function placeLine(prompt) {
  return (prompt || '').split('\n').find(line => /^PLACE/.test(line)) || ''
}

function lockLine(prompt, name) {
  return (prompt || '').split('\n').find(line => line.includes(`${name} —`)) || ''
}

function placesOf(prose) {
  return detectProse(prose).scenes.map(scene => scene.where || '')
}

test('rules prose carries dawn into midday and afternoon', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Nia, 38, bobbed hair, olive coat, waits on the pier at dawn. At midday Nia coils a rope. In the afternoon Nia waves.',
    model: 'grok',
    compact: true
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(lightLine(planned.body.shots[0].prompt), /Dawn light/)
  assert.match(lightLine(planned.body.shots[1].prompt), /Midday light/)
  assert.match(lightLine(planned.body.shots[2].prompt), /Afternoon light/)
  assert.doesNotMatch(lightLine(planned.body.shots[1].prompt), /Dawn/)
  assert.doesNotMatch(lightLine(planned.body.shots[2].prompt), /Dawn|Midday/)
})

test('Portuguese dusk cues replace daylight and carry', () => {
  const dusk = plan({
    input: 'prose',
    prose: 'Clara, 36 anos, cabelo preto, casaco verde, espera na doca. Ao entardecer Clara acende um fósforo. Clara senta.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(dusk.status, 200, dusk.body.message)
  assert.match(lightLine(dusk.body.shots[1].prompt), /crepúsculo|entardecer/i)
  assert.match(lightLine(dusk.body.shots[2].prompt), /crepúsculo|entardecer/i)
  assert.doesNotMatch(lightLine(dusk.body.shots[1].prompt), /Noite, azul-marinho/)
  const sunset = plan({
    input: 'prose',
    prose: 'Clara, 36 anos, cabelo preto, casaco verde, espera na doca de dia. Ao pôr do sol Clara senta no banco. Clara acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.match(lightLine(sunset.body.shots[1].prompt), /crepúsculo|entardecer/i)
  assert.doesNotMatch(lightLine(sunset.body.shots[1].prompt), /luz suave de janela|Luz do dia/i)
  const afternoon = plan({
    input: 'prose',
    prose: 'Clara, 36 anos, cabelo preto, casaco verde, espera na doca ao meio-dia. À tarde Clara acena. Clara senta.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.match(lightLine(afternoon.body.shots[0].prompt), /meio-dia/i)
  assert.match(lightLine(afternoon.body.shots[1].prompt), /tarde/i)
  assert.doesNotMatch(lightLine(afternoon.body.shots[1].prompt), /meio-dia|luz do dia natural/i)
})

test('movement verbs and full place phrases replace the previous room', () => {
  assert.deepEqual(placesOf('Nia, 38, bobbed hair, olive coat, waits on the porch. Nia waits at the base cabin. Nia crosses the ridge on a rope. Nia returns to the cabin.'), ['Porch', 'Base cabin', 'Ridge', 'Cabin'])
  const boat = placesOf('Tomás, 44 anos, barba curta, casaco verde, espera no posto de abastecimento. Tomás pilota o barco pelo canal. Tomás embarca na aeronave. Tomás acena.')
  assert.match(boat[0], /Posto de abastecimento/)
  assert.notEqual(boat[1], boat[0])
  assert.match(boat[2], /Aeronave|Avião/)
  assert.match(boat[3], /Aeronave|Avião/)
  const school = placesOf('Tomás, 44 anos, barba curta, casaco verde, espera no posto de abastecimento. Tomás entra na escola de música. Tomás acena.')
  assert.equal(school[0], 'Posto de abastecimento')
  assert.equal(school[1], 'Escola de música')
  const planned = plan({
    input: 'prose',
    prose: 'Tomás, 44 anos, barba curta, casaco verde, espera no posto de abastecimento. Tomás entra na escola de música. Tomás acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.match(placeLine(planned.body.shots[0].prompt), /Posto de abastecimento/)
  assert.match(placeLine(planned.body.shots[1].prompt), /Escola de música/)
})

test('giving an item back and dropping it updates both sheet and rules locks', () => {
  const prose = plan({
    input: 'prose',
    prose: 'Nia, 38, bobbed hair, olive coat, wears a copper ring, waits in the hall. Nia gives the ring to Omar. Omar, 31, black hair, grey jacket, waits. Omar gives the ring back. Nia nods.',
    model: 'grok',
    compact: true
  })
  assert.equal(prose.status, 200, prose.body.message)
  const handed = prose.body.shots.find(shot => /gives the ring to Omar/.test(shot.prompt))
  assert.doesNotMatch(lockLine(handed.prompt, 'Nia'), /ring/)
  assert.match(lockLine(handed.prompt, 'Omar'), /ring/)
  const back = prose.body.shots.find(shot => /gives the ring back/.test(shot.prompt))
  assert.doesNotMatch(lockLine(back.prompt, 'Omar'), /ring/)
  const nod = prose.body.shots.find(shot => /Nia nods/.test(shot.prompt))
  assert.match(lockLine(nod.prompt, 'Nia'), /copper ring/)
  const sheet = createStoryboard({
    model: 'grok',
    promptLanguage: 'en',
    scenario: {
      characters: [
        { name: 'Lilia', look: '33, brown hair', outfit: 'navy coat', items: 'tin whistle' },
        { name: 'Nils', look: '40, grey hair', outfit: 'wool coat' }
      ],
      places: [{ name: 'Yard', description: 'a small yard' }],
      scenes: [
        { who: 'Lilia', where: 'Yard', what: 'Lilia hands the whistle to Nils' },
        { who: 'Nils', where: 'Yard', what: 'Nils returns the whistle to Lilia' },
        { who: 'Lilia', where: 'Yard', what: 'Lilia smiles' }
      ]
    }
  })
  assert.doesNotMatch(lockLine(sheet.shots[0].prompt, 'Lilia'), /whistle/)
  assert.match(lockLine(sheet.shots[0].prompt, 'Nils'), /whistle/)
  assert.match(lockLine(sheet.shots[1].prompt, 'Lilia'), /tin whistle|whistle/)
  assert.doesNotMatch(lockLine(sheet.shots[1].prompt, 'Nils'), /whistle/)
  const dropped = plan({
    input: 'prose',
    prose: 'Bia, 29 anos, cabelo curto, casaco verde, traz um apito e um cachecol, espera no cais. Bia deixa cair o apito. Bia perde o cachecol. Bia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const first = lockLine(dropped.body.shots[0].prompt, 'Bia')
  assert.match(first, /apito/)
  assert.match(first, /cachecol/)
  assert.doesNotMatch(first, /cair|traz um|perde/)
  assert.doesNotMatch(lockLine(dropped.body.shots[1].prompt, 'Bia'), /apito/)
  assert.match(lockLine(dropped.body.shots[1].prompt, 'Bia'), /cachecol/)
  assert.doesNotMatch(lockLine(dropped.body.shots[2].prompt, 'Bia'), /cachecol|apito/)
})

test('verb phrases stay out of locks and a surf garment on a sheet is kept', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Nia, 38, bobbed hair, olive coat, carries a brass compass, waits in the hall. Nia loses the locket. Nia hangs the compass. Nia waves.',
    model: 'grok',
    compact: true
  })
  for (const shot of planned.body.shots) {
    assert.doesNotMatch(lockLine(shot.prompt, 'Nia'), /loses|hangs|will /)
  }
  assert.doesNotMatch(lockLine(planned.body.shots.at(-1).prompt, 'Nia'), /compass/)
  assert.equal(keptTrait('fato de surf', 'outfit'), 'fato de surf')
  assert.equal(keptTrait('surfa a onda', 'outfit'), '')
  const gaps = characterSheetGaps(
    [{ name: 'Bia', look: '27 anos, cabelo curto', outfit: 'fato de surf' }],
    'Bia surfa a onda. Bia espera na praia.'
  )
  assert.equal(gaps.some(item => item.value === 'fato de surf' || item.value === 'fato' || /surfa/.test(item.value)), false)
  const worn = plan({
    input: 'prose',
    prose: 'Bia, 27 anos, cabelo curto, fato de surf, espera na praia. Bia surfa a onda. Bia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  for (const shot of worn.body.shots) assert.match(lockLine(shot.prompt, 'Bia'), /fato de surf/)
})

test('plural, kinship, titles, and later Portuguese clothes keep full locks', () => {
  const pair = plan({
    input: 'prose',
    prose: 'Bia, 30 anos, cabelo curto, casaco azul, espera no atelier. Rosa, 68 anos, cabelo branco, vestido preto, é a avó. Bia ajuda a avó. Os dois pintam lado a lado.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const help = pair.body.shots.find(shot => /ajuda a avó/.test(shot.prompt))
  const both = pair.body.shots.find(shot => /pintam lado a lado/.test(shot.prompt))
  assert.match(lockLine(help.prompt, 'Rosa'), /vestido preto/)
  assert.match(lockLine(help.prompt, 'Bia'), /casaco azul/)
  assert.match(lockLine(both.prompt, 'Rosa'), /68 anos/)
  assert.match(lockLine(both.prompt, 'Bia'), /cabelo curto/)
  const intro = plan({
    input: 'prose',
    prose: 'Bia, 30 anos, cabelo curto, casaco azul, espera no cais. A irmã, Iracema, tem 50 anos, cabelo branco e veste um vestido preto. Iracema acena. Bia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.doesNotMatch(lockLine(intro.body.shots.find(shot => /Bia acena/.test(shot.prompt)).prompt, 'Bia'), /vestido|50 anos/)
  assert.match(lockLine(intro.body.shots.find(shot => /Iracema acena/.test(shot.prompt)).prompt, 'Iracema'), /50 anos/)
  assert.match(lockLine(intro.body.shots.find(shot => /Iracema acena/.test(shot.prompt)).prompt, 'Iracema'), /vestido preto/)
  const dona = detectProse('Dona Celeste, 70 anos, cabelo branco, xaile preto, acende uma vela. Dona Celeste senta.')
  assert.deepEqual(dona.scenes.map(scene => scene.what), [
    'Dona Celeste, 70 anos, cabelo branco, xaile preto, acende uma vela',
    'Dona Celeste senta'
  ])
  const donaPlan = plan({ input: 'prose', prose: 'Dona Celeste, 70 anos, cabelo branco, xaile preto, acende uma vela. Dona Celeste senta.', model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(donaPlan.body.shots.length, 2)
  for (const shot of donaPlan.body.shots) {
    assert.match(lockLine(shot.prompt, 'Dona Celeste'), /70 anos/)
    assert.match(lockLine(shot.prompt, 'Dona Celeste'), /xaile preto/)
  }
  const coat = plan({
    input: 'prose',
    prose: 'Bia, 30 anos, cabelo curto, veste um casaco azul, espera no cais. Bia veste um impermeável amarelo. Bia acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const wear = coat.body.shots.find(shot => /impermeável amarelo/.test(shot.prompt))
  assert.ok(wear)
  assert.doesNotMatch(lockLine(coat.body.shots[0].prompt, 'Bia'), /impermeável/)
  assert.match(lockLine(wear.prompt, 'Bia'), /impermeável amarelo/)
  assert.match(lockLine(coat.body.shots.at(-1).prompt, 'Bia'), /casaco azul/)
})

test('bald, careca, and small carried nouns are captured without a trailing article', () => {
  const english = plan({
    input: 'prose',
    prose: 'Samir, 51, bald, grey coat, carries a pencil, waits in the shop. Samir waves.',
    model: 'grok',
    compact: true
  })
  assert.match(lockLine(english.body.shots[0].prompt, 'Samir'), /bald/)
  assert.match(lockLine(english.body.shots[1].prompt, 'Samir'), /pencil/)
  const portuguese = plan({
    input: 'prose',
    prose: 'Heitor, 62 anos, careca, cachecol cinzento, traz um cachimbo e um chapéu, espera na loja. Heitor segura o lápis. Heitor mostra as argolas. Heitor acena.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const line = lockLine(portuguese.body.shots.at(-1).prompt, 'Heitor')
  for (const part of [/careca/, /cachecol cinzento/, /cachimbo/, /chapéu/, /lápis/, /argolas/]) assert.match(line, part, line)
  assert.doesNotMatch(line, /\bum\b|mostra|segura/)
})

test('stage and palco do not survive snow or water, and objects are not places', () => {
  assert.deepEqual(placesOf('Omar, 31, black hair, grey jacket, waits on the stage. Omar walks through the snow. Omar wades into the water.'), ['Stage', 'Snow', 'Water'])
  assert.deepEqual(placesOf('Bia, 30 anos, cabelo curto, casaco azul, espera no palco. Bia caminha na neve. Bia entra na água.'), ['Palco', 'Neve', 'Água'])
  const objects = placesOf('Nia, 38, bobbed hair, olive coat, waits in the hall. Nia lifts the piano lid. Nia leaves the book in the shop. Nia waves.')
  assert.equal(objects.some(place => /Piano|Lid|Book/i.test(place)), false)
  assert.equal(objects.at(-1), 'Shop')
  const book = placesOf('Bia, 30 anos, cabelo curto, casaco azul, espera na sala. Bia abre o piano. Bia deixa o livro na loja. Bia acena.')
  assert.equal(book.some(place => /Piano|Livro/i.test(place)), false)
  assert.equal(book.at(-1), 'Loja')
})

test('leaving an interior returns to the outdoor place already used', () => {
  assert.deepEqual(placesOf('Nia, 38, bobbed hair, olive coat, waits on the helipad. Nia crawls into the ice cave. Nia leaves the ice cave. Nia waves.'), ['Helipad', 'Ice cave', 'Helipad', 'Helipad'])
  assert.deepEqual(placesOf('Nia, 38, bobbed hair, olive coat, waits on the porch. Nia enters the cabin. Nia leaves the cabin. Nia waves.'), ['Porch', 'Cabin', 'Porch', 'Porch'])
})
