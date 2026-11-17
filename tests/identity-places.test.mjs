import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { identityTraits, namedWornAndCarried } from '../app/utils/prose-extra.js'
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
  return (prompt || '').split('\n').find(item => item.startsWith(`${name} —`) || item.startsWith(`SUBJECT: ${name} —`)) || ''
}

test('Portuguese identity keeps the whole phrase, the garment, and the carried item', () => {
  const text = 'Caetana tem quarenta e seis anos e o cabelo preto liso até os ombros. Caetana veste uma camisa vermelha e traz um facão. Caetana espera no forno. Caetana acena.'
  const found = detectProse(text)
  assert.equal(found.language, 'pt')
  const person = found.characters.find(item => item.name === 'Caetana')
  const traits = identityTraits(text, 'Caetana', ['Caetana'])
  const blob = `${person.look} ${person.outfit} ${traits.looks.join(' ')} ${traits.outfits.join(' ')}`
  assert.match(blob, /quarenta e seis/)
  assert.match(blob, /até os ombros/)
  assert.match(blob, /camisa vermelha/)
  assert.match(blob, /facão|facao/)
  assert.doesNotMatch(blob, /cabelo preto liso até$/)
  assert.equal(found.scenes[0].where, 'Forno')
  assert.equal(found.scenes.some(scene => scene.what === 'Caetana acena'), true)
})

test('Portuguese hair, age words, and items are not truncated or translated', () => {
  const text = 'Lígia, trinta anos, cabelo curto, impermeável azul, traz um caderno. Lígia espera no cais. Lígia acena. Delfim tem cabelo castanho rapado dos lados. Delfim tem quinze anos e veste uma t-shirt amarela. Delfim traz uma prancha. Delfim espera na praia. Delfim acena. Márcia tem o cabelo preto em tranças. Márcia veste um vestido azul. Márcia espera no mercado. Márcia acena. Nuno traz conchas e veste um casaco azul. Nuno espera na praia. Nuno acena.'
  const found = detectProse(text)
  const ligia = found.characters.find(item => item.name === 'Lígia')
  const delfim = found.characters.find(item => item.name === 'Delfim')
  const marcia = found.characters.find(item => item.name === 'Márcia')
  const nuno = found.characters.find(item => item.name === 'Nuno')
  assert.match(`${ligia.look} ${ligia.outfit}`, /impermeável azul/)
  assert.match(`${ligia.look} ${ligia.outfit}`, /caderno/)
  assert.match(`${delfim.look} ${delfim.outfit}`, /rapado dos lados/)
  assert.match(`${delfim.look} ${delfim.outfit}`, /quinze/)
  assert.match(`${delfim.look} ${delfim.outfit}`, /t-shirt amarela/)
  assert.match(`${delfim.look} ${delfim.outfit}`, /t-shirt amarela/)
  assert.equal(`${delfim.look} ${delfim.outfit}`.replace(/t-shirt/g, '').includes('shirt'), false)
  assert.match(`${delfim.look} ${delfim.outfit}`, /prancha/)
  assert.match(`${marcia.look} ${marcia.outfit}`, /tranças/)
  assert.match(`${nuno.look} ${nuno.outfit}`, /conchas/)
})

test('English locks keep the garment and the item and do not repeat a cut-off age or an action', () => {
  assert.deepEqual(namedWornAndCarried('a green cape').garments, ['green cape'])
  const text = 'Theo is a thirty-year-old actor with slicked-back black hair, a velvet blazer and a silver ring. Theo waits in the suite. Theo waves. Kofi, 40, short hair, grey coat, carries a microphone. Kofi waits on the stage. Kofi waves. Ottilie, 28, curly hair, striped coat, wears a red nose. Ottilie waits under the big top. Ottilie waves. Mei, 35, black hair, white coat, carries a stethoscope. Mei waits in the clinic. Mei waves. Nadia, 29, brown hair, grey coat, pulls her goggles down. Nadia waits in the workshop. Nadia waves.'
  const found = detectProse(text)
  const theo = found.characters.find(item => item.name === 'Theo')
  const blob = name => {
    const person = found.characters.find(item => item.name === name)
    return `${person.look} ${person.outfit}`
  }
  assert.equal(theo.name, 'Theo')
  assert.match(blob('Theo'), /thirty-year-old/)
  assert.match(blob('Theo'), /velvet blazer/)
  assert.match(blob('Theo'), /silver ring/)
  assert.doesNotMatch(blob('Theo'), /thirty-year(?!-old)/)
  assert.match(blob('Kofi'), /microphone/)
  assert.match(blob('Ottilie'), /red nose/)
  assert.match(blob('Mei'), /stethoscope/)
  assert.match(blob('Nadia'), /goggles/)
  assert.doesNotMatch(blob('Nadia'), /pulls her goggles/)
  const petra = detectProse('Twenty-nine-year-old Petra pulls on a saffron coat. Petra waits in the kiln. Petra waves.')
  const line = `${petra.characters[0].look} ${petra.characters[0].outfit}`
  assert.match(line, /[Tt]wenty-nine/)
  assert.equal((line.match(/twenty-nine/gi) || []).length <= 2, true)
})

test('a change starts a later version and does not enter the starting lock', () => {
  const english = plan({
    input: 'prose',
    prose: 'Idony, 30, brown hair, wool peacoat, waits in the hall. Idony waves. Idony takes off the wool peacoat. Idony waves again.',
    model: 'grok',
    compact: true
  })
  assert.equal(english.status, 200, english.body.message)
  const off = english.body.shots.find(shot => /takes off the wool peacoat/.test(shot.prompt))
  const before = english.body.shots.filter(shot => shot.order < off.order)
  assert.ok(before.length)
  for (const shot of before) {
    assert.match(lineOf(shot.prompt, 'Idony'), /wool peacoat/)
    assert.doesNotMatch(lineOf(shot.prompt, 'Idony'), /off the wool/)
  }
  assert.doesNotMatch(lineOf(off.prompt, 'Idony'), /wool peacoat|off the/)
  const cape = plan({
    input: 'prose',
    prose: 'Idony, 30, brown hair, grey coat, waits in the hall. Idony waves. Idony puts on a green cape. Idony waves again.',
    model: 'grok',
    compact: true
  })
  const puts = cape.body.shots.find(shot => /green cape/.test(shot.prompt) && /puts on/.test(shot.prompt))
  assert.ok(puts)
  for (const shot of cape.body.shots) {
    const line = lineOf(shot.prompt, 'Idony')
    assert.doesNotMatch(line, /green cap(?!e)/)
    if (shot.order < puts.order) assert.doesNotMatch(line, /green cape/)
    else assert.match(line, /green cape/)
  }
})

test('Portuguese veste and tira change the version and do not copy the sentence or another person', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Celina, 40 anos, cabelo preto, casaco de lã, espera na oficina. Celina acena. Celina tira o casaco de lã. Celina veste a capa verde. Celina acena de novo. Pascoal lava as luvas. Celina sorri.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const tira = planned.body.shots.find(shot => /tira o casaco/.test(shot.prompt))
  const veste = planned.body.shots.find(shot => /veste a capa/.test(shot.prompt))
  assert.ok(tira && veste && tira.order < veste.order)
  for (const shot of planned.body.shots) {
    const line = lineOf(shot.prompt, 'Celina')
    if (!line) continue
    assert.doesNotMatch(line, /tira o casaco|Iria|Pascoal|luvas/)
    if (shot.order < tira.order) assert.match(line, /casaco de lã/)
    else assert.doesNotMatch(line, /casaco/)
    if (shot.order < veste.order) assert.doesNotMatch(line, /capa verde/)
    else assert.match(line, /capa verde/)
  }
  const fato = plan({
    input: 'prose',
    prose: 'Gervásio, 15 anos, cabelo curto, camisa amarela, espera na praia. Gervásio acena. Gervásio veste o fato. Gervásio acena de novo.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const wears = fato.body.shots.find(shot => /veste o fato/.test(shot.prompt))
  assert.ok(wears)
  for (const shot of fato.body.shots) {
    const line = lineOf(shot.prompt, 'Gervásio')
    if (shot.order < wears.order) assert.doesNotMatch(line, /fato/)
    else assert.match(line, /fato/)
  }
})

test('objects and surfaces do not replace the place, and a named place does', () => {
  const english = detectProse('Willa, 30, brown hair, grey coat, waits in the suite. Willa practises a bow in the mirror. Willa waits in the square. Willa pushes through the crowd. Willa waits on the beach. Willa writes in the sand. Willa smiles at the moonlit sea. Willa waves.')
  assert.deepEqual(english.scenes.map(scene => scene.where), [
    'Suite', 'Suite', 'Square', 'Square', 'Beach', 'Beach', 'Beach', 'Beach'
  ])
  const places = detectProse('Willa, 30, brown hair, grey coat, waits on the helipad. Willa enters the cave. Willa leads the horse into the stables. Willa waits under the big top. Willa waits in the hall. Willa writes at the desk. Willa waits at the lake. Willa waits in the yard. Willa climbs into the carriage. Willa waits in the hut. Willa checks the base board in the snow. Willa crosses onto the glacier. Willa waves.')
  const where = places.scenes.map(scene => scene.where).join(' | ')
  for (const name of ['Helipad', 'Cave', 'Stables', 'Big top', 'Hall', 'Lake', 'Yard', 'Hut', 'Glacier']) {
    assert.match(where, new RegExp(name, 'i'), where)
  }
  assert.doesNotMatch(where, /Mirror|Crowd|Sand|Sea|Desk|Carriage|Trapeze|Snow|Air|Base|Board/)
  const portuguese = detectProse('Celina, 40 anos, cabelo preto, casaco azul, espera na oficina. Celina olha para o espelho. Celina atravessa a multidão. Celina escreve na areia. Celina entra na igreja. Celina acena. Celina espera no forno. Celina sorri.')
  assert.equal(portuguese.language, 'pt')
  const ptWhere = portuguese.scenes.map(scene => scene.where)
  assert.equal(ptWhere[0], 'Oficina')
  assert.equal(ptWhere.includes('Igreja'), true)
  assert.equal(ptWhere.at(-1), 'Forno')
  assert.equal(ptWhere.some(name => /Espelho|Multidão|Areia|Espelho/i.test(name || '')), false)
})

test('a yawn and coming up to watch are shots', () => {
  const yawn = detectProse('Leif, 40, grey beard, navy coat, waits on the beach. Leif yawns. Leif waves.')
  assert.deepEqual(yawn.scenes.map(scene => scene.what), [
    'Leif, 40, grey beard, navy coat, waits on the beach',
    'Leif yawns',
    'Leif waves'
  ])
  const watch = detectProse('Freya, 30, brown hair, grey coat, waits on the quay. Freya comes up to watch. Freya waves.')
  assert.equal(watch.scenes.some(scene => scene.what === 'Freya comes up to watch'), true)
})

test('format agent on prose with named characters returns sheets_missing and the sheets', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Idony, 30, brown hair, grey coat, waits in the hall. Idony waves.',
    model: 'grok',
    format: 'agent'
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.equal(planned.body.sheets_missing, true)
  assert.match(planned.body.message, /do not send input "prose"/i)
  assert.equal(planned.body.warnings[0].code, 'sheets_missing')
  const sheet = planned.body.sheets.find(item => item.name === 'Idony')
  assert.ok(sheet)
  assert.match(`${sheet.look} ${sheet.outfit}`, /grey coat/)
  assert.match(`${sheet.age || ''} ${sheet.look}`, /30/)
  const quiet = plan({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.', model: 'grok', compact: true })
  assert.equal(quiet.status, 200)
  assert.equal(quiet.body.sheets_missing, undefined)
})

test('a long Portuguese story keeps both locks, a veste, a tira, igreja, and forno', () => {
  const intro = 'Noémia, quarenta e dois anos, cabelo preto em tranças compridas, casaco de lã, traz um caderno e conchas, espera na oficina. Eusébio, trinta e cinco anos, cabelo castanho rapado dos lados, t-shirt amarela, traz uma prancha, espera na oficina.'
  const beats = []
  for (let index = 1; index <= 22; index += 1) beats.push(`Noémia abre a caixa ${index} na oficina.`)
  beats.push('Noémia veste a capa verde.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Noémia acena na igreja ${index}.`)
  beats.push('Noémia tira o casaco de lã.')
  for (let index = 1; index <= 8; index += 1) beats.push(`Eusébio fecha o livro ${index} na igreja.`)
  beats.push('Noémia olha para o espelho.')
  beats.push('Noémia atravessa a multidão.')
  beats.push('Noémia escreve na areia.')
  beats.push('Noémia espera no forno.')
  beats.push('Noémia acena.')
  const planned = plan({ input: 'prose', prose: [intro, ...beats].join(' '), model: 'grok', compact: true, promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 45, String(planned.body.shots.length))
  assert.ok(planned.body.parts.length >= 2)
  assert.ok(planned.body.parts.every(part => part.to - part.from + 1 <= 40))
  const veste = planned.body.shots.find(shot => /veste a capa verde/.test(shot.prompt))
  const tira = planned.body.shots.find(shot => /tira o casaco de lã/.test(shot.prompt))
  assert.ok(veste && tira && veste.order < tira.order)
  const noemiaParts = new Set()
  planned.body.shots.forEach(shot => {
    const part = planned.body.parts.find(item => shot.order >= item.from && shot.order <= item.to)
    const noemia = lineOf(shot.prompt, 'Noémia')
    const eusebio = lineOf(shot.prompt, 'Eusébio')
    if (noemia) {
      noemiaParts.add(part.index)
      assert.match(noemia, /quarenta e dois|42/)
      assert.match(noemia, /tranças/)
      assert.match(noemia, /caderno/)
      assert.doesNotMatch(noemia, /prancha|t-shirt|Eusébio/)
      if (shot.order < veste.order) assert.doesNotMatch(noemia, /capa verde/)
      else assert.match(noemia, /capa verde/)
      if (shot.order < tira.order) assert.match(noemia, /casaco de lã/)
      else assert.doesNotMatch(noemia, /casaco/)
    }
    if (eusebio) {
      assert.match(eusebio, /trinta e cinco|35/)
      assert.match(eusebio, /rapado dos lados/)
      assert.match(eusebio, /t-shirt/)
      assert.equal(eusebio.replace(/t-shirt/g, '').includes('shirt'), false)
      assert.match(eusebio, /prancha/)
      assert.doesNotMatch(eusebio, /tranças|casaco de lã|caderno/)
    }
  })
  assert.ok([...noemiaParts].some(index => index >= 2))
  const where = planned.body.shots.map(shot => (shot.prompt.match(/PLACE: ([^\n.]+)/) || ['', ''])[1])
  assert.ok(where.some(name => /igreja/i.test(name)))
  assert.ok(where.some(name => /forno/i.test(name)))
  assert.equal(where.some(name => /espelho|multidão|areia/i.test(name)), false)
})
