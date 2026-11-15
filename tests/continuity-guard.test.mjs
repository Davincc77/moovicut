import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { describeParts, partitionShots } from '../app/utils/parts.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function detected(text) {
  return detectProse(text)
}

function names(text) {
  return detected(text).characters.map(item => item.name)
}

function person(text, name) {
  const found = detected(text).characters.find(item => item.name === name)
  assert.ok(found, names(text).join(', '))
  return `${found.look} ${found.outfit}`
}

function places(text) {
  return detected(text).places.map(item => item.name)
}

test('N1 a short name aliases the full-name character', () => {
  const stories = [
    ['Petra Solano, 44, grey bob, navy coat, waits in the apiary. Petra checks the frames.', 'Petra Solano', /44/, /grey bob/, /navy coat/],
    ['Idris Okonkwo, 36, black hair, grey coat, waits in the boathouse. Idris lifts the lamp.', 'Idris Okonkwo', /36/, /black hair/, /grey coat/],
    ['Maren Solberg, 38, auburn curls, red scarf, waits on the rope bridge. Maren lifts the coil.', 'Maren Solberg', /38/, /auburn curls/, /red scarf/]
  ]
  for (const [text, name, age, look, outfit] of stories) {
    assert.deepEqual(names(text), [name])
    const line = person(text, name)
    assert.match(line, age)
    assert.match(line, look)
    assert.match(line, outfit)
  }
})

test('N2 a trait list stops at the clause and weekdays are not people', () => {
  const thursday = detected('On Thursday, Callum, 33, red beard, wool coat, walks in the print shop. Callum lifts a page.')
  assert.deepEqual(thursday.characters.map(item => item.name), ['Callum'])
  assert.match(`${thursday.characters[0].look} ${thursday.characters[0].outfit}`, /33/)
  assert.doesNotMatch(`${thursday.characters[0].look} ${thursday.characters[0].outfit}`, /Thursday|print shop|lifts a page/)

  const neighbour = detected('Callum, 33, red beard, wool coat, and his neighbour spend the afternoon in the print shop. Callum lifts a page.')
  assert.equal(neighbour.characters.some(item => /saturday|thursday|neighbour/i.test(item.name)), false)
  assert.doesNotMatch(`${neighbour.characters[0].look} ${neighbour.characters[0].outfit}`, /neighbour|spend the afternoon/)

  const june = detected('June, the loft is quiet. Noor, 41, white bun, green cloak, walks in the loft. Noor waits.')
  assert.deepEqual(june.characters.map(item => item.name), ['Noor'])
  assert.doesNotMatch(june.characters[0].look, /loft is quiet|June/)
})

test('N3 traits stay with the named subject of the clause', () => {
  const dye = detected('Bram, red beard, leather apron, waits in the dye works. His cousin Nils is thirty, with a short beard and a brown cap. Nils lifts the cloth.')
  const bram = dye.characters.find(item => item.name === 'Bram')
  const nils = dye.characters.find(item => item.name === 'Nils')
  assert.match(`${bram.look} ${bram.outfit}`, /red beard/)
  assert.match(`${bram.look} ${bram.outfit}`, /leather apron/)
  assert.match(`${nils.look} ${nils.outfit}`, /short beard/)
  assert.match(`${nils.look} ${nils.outfit}`, /brown cap/)
  assert.doesNotMatch(`${bram.look} ${bram.outfit}`, /brown cap/)
  assert.doesNotMatch(`${nils.look} ${nils.outfit}`, /leather apron/)

  const yard = detected('Ezra Hale, 28, black curls, grey hoodie, waits in the yard. His uncle Tomas is fifty, with a grey beard and a brown coat. Tomas opens the gate.')
  const ezra = yard.characters.find(item => item.name === 'Ezra Hale')
  const tomas = yard.characters.find(item => item.name === 'Tomas')
  assert.match(`${ezra.look} ${ezra.outfit}`, /black curls/)
  assert.match(`${ezra.look} ${ezra.outfit}`, /grey hoodie/)
  assert.match(`${tomas.look} ${tomas.outfit}`, /grey beard/)
  assert.match(`${tomas.look} ${tomas.outfit}`, /brown coat/)
  assert.doesNotMatch(`${ezra.look} ${ezra.outfit}`, /grey beard/)

  const kitchen = detected('Ada, green eyes, linen jacket, pours the tea in the kitchen. Her sister Pilar is sixty, with a white bun and a blue coat. Pilar reads the note.')
  const ada = kitchen.characters.find(item => item.name === 'Ada')
  const pilar = kitchen.characters.find(item => item.name === 'Pilar')
  assert.match(`${ada.look} ${ada.outfit}`, /green eyes/)
  assert.match(`${ada.look} ${ada.outfit}`, /linen jacket/)
  assert.match(`${pilar.look} ${pilar.outfit}`, /white bun/)
  assert.match(`${pilar.look} ${pilar.outfit}`, /blue coat/)
  assert.doesNotMatch(`${ada.look} ${ada.outfit}`, /white bun/)
  assert.doesNotMatch(`${pilar.look} ${pilar.outfit}`, /green eyes/)
})

test('N4 capital words need person evidence', () => {
  assert.deepEqual(names('Sawdust covers the bench. Together they wait. Early, steam rises. Water runs. Idris, 36, black hair, grey coat, waits in the boathouse.'), ['Idris'])
  assert.deepEqual(names('Flamingos stand in the pool. A T-shirt dries on the rail. Saint Bavo is quiet. Noor, 29, short curls, blue jacket, waits in the boathouse.'), ['Noor'])
  assert.deepEqual(names('Frost coats the rail. Suddenly a bell rings. Monday, the yard is empty. Kenzo, 40, grey stubble, black coat, waits in the yard.'), ['Kenzo'])
})

test('N5 a locative noun phrase is a place and the description stays in its sentence', () => {
  const apiary = detected('Hester Quinn, 44, grey bob, navy coat, waits in the apiary. Hester checks the frames.')
  assert.ok(apiary.places.some(place => /apiary/i.test(place.name)))
  assert.equal(apiary.places.some(place => /setting/i.test(place.name)), false)
  assert.doesNotMatch(apiary.characters[0].look, /checks the frames/)

  const mill = detected('In the sawmill, Tomas, 51, grey beard, brown coat, lifts a plank. Tomas waits.')
  assert.ok(mill.places.some(place => /sawmill/i.test(place.name)))
  assert.doesNotMatch(`${mill.characters[0].look} ${mill.characters[0].outfit}`, /lifts a plank|Tomas waits/)

  const rink = detected('Leona Varga is twenty-eight. She has a black bob and wears a wool coat. Leona waits inside the ice rink.')
  assert.ok(rink.places.some(place => /ice rink/i.test(place.name)))
  assert.equal(rink.scenes.some(scene => /twenty-eight|black bob/.test(scene.what)), false)
  assert.equal(rink.places.some(place => /setting/i.test(place.name)), false)
})

test('N6 quoted speech and personal names are not places', () => {
  const foundry = detected('Paavo said "Meet me in Edinburgh". Paavo, 45, grey beard, brown jacket, walks in the foundry.')
  assert.deepEqual(foundry.characters.map(item => item.name), ['Paavo'])
  assert.equal(foundry.places.some(place => /edinburgh/i.test(place.name)), false)
  assert.ok(foundry.places.some(place => /foundry/i.test(place.name)))

  const shop = detected('Ada folds a page in the print shop. Ada said "Seun will come tomorrow". Ada waits.')
  assert.deepEqual(shop.characters.map(item => item.name), ['Ada'])
  assert.equal(shop.places.some(place => /seun/i.test(place.name)), false)
  assert.ok(shop.places.some(place => /print shop/i.test(place.name)))

  const glass = detected('Sera reads aloud, "We will meet in Lisbon". Sera, 29, short curls, blue jacket, waits in the greenhouse.')
  assert.deepEqual(glass.characters.map(item => item.name), ['Sera'])
  assert.equal(glass.places.some(place => /lisbon/i.test(place.name)), false)
  assert.ok(glass.places.some(place => /greenhouse/i.test(place.name)))
})

test('N7 time of day starts at the cue and does not leak backward', () => {
  const stories = [
    'In the morning, Nia walks in the yard. That night, Nia waits by the gate.',
    'At dawn, in the greenhouse, Sera pours water. That night, in the loft, Sera waits.',
    'One morning, Kenzo walks in the shed. At night, Kenzo waits by the door.'
  ]
  for (const text of stories) {
    const found = detected(text)
    assert.equal(found.scenes[0].light, 'dawn')
    assert.equal(found.scenes.at(-1).light, 'night')
    assert.notEqual(found.light, 'night')
    const response = dispatchAgentRequest({
      method: 'POST',
      pathname: '/api/v1/storyboard',
      body: JSON.stringify({ input: 'prose', prose: text, model: 'grok', compact: true })
    })
    assert.equal(response.status, 200)
    const body = JSON.parse(response.body)
    assert.match(body.shots[0].prompt, /dawn/i)
    assert.doesNotMatch(body.shots[0].prompt, /\bnight\b/i)
    assert.match(body.shots.at(-1).prompt, /\bnight\b/i)
  }
})

test('N8 part place and time come from the first shot', () => {
  const shots = [
    { id: 'a', where: 'Kitchen', light: 'dawn' },
    { id: 'b', where: 'Kitchen', light: 'dawn' },
    { id: 'c', where: 'Garden', light: 'night' }
  ]
  const project = { shots, filmSheet: { light: 'dawn', places: [{ name: 'Kitchen' }] } }
  const parts = describeParts(project, partitionShots(shots, 2))
  assert.deepEqual(parts.map(part => [part.place, part.time]), [['Kitchen', 'dawn'], ['Garden', 'night']])
})

test('N9 a place description uses the text or the name', () => {
  const house = detected('In the creaking timber house, Yasmin, 61, white bun, green cloak, waits. Yasmin lifts the latch.')
  const home = house.places.find(place => /house/i.test(place.name))
  assert.ok(home)
  assert.match(home.description, /creaking/)
  assert.match(home.description, /timber/)
  assert.doesNotMatch(home.description, /named in the text/i)

  const cottage = detected('In the whitewashed cottage by the canal, Oskar waits. Oskar, 47, grey stubble, brown jacket, lifts the latch.')
  const hut = cottage.places.find(place => /cottage/i.test(place.name))
  assert.ok(hut)
  assert.match(hut.description, /whitewashed/)
  assert.doesNotMatch(hut.description, /named in the text/i)

  const kitchen = detected('In the kitchen, Callum waits. Callum, 33, red beard, wool coat, lifts a page.')
  const room = kitchen.places.find(place => /kitchen/i.test(place.name))
  assert.equal(room.description.toLowerCase(), room.name.toLowerCase())
  assert.doesNotMatch(room.description, /named in the text/i)
})

const STORIES = [
  {
    text: 'Petra Solano, 44, grey bob, navy coat, waits in the apiary. Petra checks the frames.',
    names: ['Petra Solano'],
    shots: [{ where: /apiary/i, light: '' }, { where: /apiary/i, light: '' }]
  },
  {
    text: 'Idris Okonkwo, 36, black hair, grey coat, waits in the boathouse. Idris lifts the lamp.',
    names: ['Idris Okonkwo'],
    shots: [{ where: /boathouse/i, light: '' }, { where: /boathouse/i, light: '' }]
  },
  {
    text: 'Maren Solberg, 38, auburn curls, red scarf, waits on the rope bridge. Maren lifts the coil.',
    names: ['Maren Solberg'],
    shots: [{ where: /bridge/i, light: '' }, { where: /bridge/i, light: '' }]
  },
  {
    text: 'On Thursday, Callum, 33, red beard, wool coat, waits in the print shop. Callum lifts a page.',
    names: ['Callum'],
    shots: [{ where: /print shop/i, light: '' }, { where: /print shop/i, light: '' }]
  },
  {
    text: 'Sera, 29, short curls, blue jacket, waits in the greenhouse. That night, Sera lifts the lamp.',
    names: ['Sera'],
    shots: [{ where: /greenhouse/i, light: '' }, { where: /greenhouse/i, light: 'night' }]
  },
  {
    text: 'Bram, red beard, leather apron, waits in the dye works. His cousin Nils is thirty, with a short beard and a brown cap. Nils lifts the cloth.',
    names: ['Bram', 'Nils'],
    shots: [{ where: /dye works/i, light: '' }, { where: /dye works/i, light: '' }]
  },
  {
    text: 'Ezra Hale, 28, black curls, grey hoodie, waits in the yard. His uncle Tomas is fifty, with a grey beard and a brown coat. Tomas opens the gate.',
    names: ['Ezra Hale', 'Tomas'],
    shots: [{ where: /yard/i, light: '' }, { where: /yard/i, light: '' }]
  },
  {
    text: 'Sawdust covers the bench. Together they wait. Idris, 36, black hair, grey coat, waits in the boathouse.',
    names: ['Idris'],
    shots: [{ where: /^$/, light: '' }, { where: /^$/, light: '' }, { where: /boathouse/i, light: '' }]
  },
  {
    text: 'Flamingos stand in the pool. Noor, 29, short curls, blue jacket, waits in the boathouse.',
    names: ['Noor'],
    shots: [{ where: /pool/i, light: '' }, { where: /boathouse/i, light: '' }]
  },
  {
    text: 'Hester Quinn, 44, grey bob, navy coat, waits in the apiary.',
    names: ['Hester Quinn'],
    shots: [{ where: /apiary/i, light: '' }]
  },
  {
    text: 'In the sawmill, Tomas, 51, grey beard, brown coat, lifts a plank.',
    names: ['Tomas'],
    shots: [{ where: /sawmill/i, light: '' }]
  },
  {
    text: 'Paavo said "Meet me in Edinburgh". Paavo, 45, grey beard, brown jacket, walks in the foundry.',
    names: ['Paavo'],
    shots: [{ where: /^$/, light: '' }, { where: /foundry/i, light: '' }]
  },
  {
    text: 'In the morning, Nia walks in the yard. That night, Nia waits by the gate.',
    names: ['Nia'],
    shots: [{ where: /yard/i, light: 'dawn' }, { where: /yard/i, light: 'night' }]
  },
  {
    text: 'In the creaking timber house, Yasmin, 61, white bun, green cloak, waits.',
    names: ['Yasmin'],
    shots: [{ where: /house/i, light: '' }]
  },
  {
    text: 'At dawn, in the greenhouse, Sera pours water. That night, in the loft, Sera waits.',
    names: ['Sera'],
    shots: [{ where: /greenhouse/i, light: 'dawn' }, { where: /loft/i, light: 'night' }]
  }
]

test('a varied set of short stories keeps characters, places, and times', () => {
  assert.ok(STORIES.length >= 15)
  for (const story of STORIES) {
    const found = detected(story.text)
    assert.deepEqual(found.characters.map(item => item.name), story.names, story.text)
    assert.equal(found.scenes.length, story.shots.length, `${story.text}\n${found.scenes.map(scene => `${scene.where}: ${scene.what}`).join(' | ')}`)
    story.shots.forEach((expected, index) => {
      assert.match(found.scenes[index].where, expected.where, story.text)
      assert.equal(found.scenes[index].light, expected.light, `${story.text} :: ${found.scenes[index].what}`)
    })
  }
})
