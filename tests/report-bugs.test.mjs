import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { readFileSync } from 'node:fs'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function names(found) {
  return found.characters.map(person => person.name)
}

test('D1 a shared intro keeps both looks and a colon intro keeps the age', () => {
  const shared = detectProse('Imogen Achebe, 52, silver box braids, oxblood leather apron, a pair of tongs, and Lorcan, 19, short fade, grey hoodie, wait in the yard.')
  const imogen = shared.characters.find(person => person.name === 'Imogen Achebe')
  const lorcan = shared.characters.find(person => person.name === 'Lorcan')
  assert.ok(imogen, names(shared).join(', '))
  assert.ok(lorcan, names(shared).join(', '))
  assert.match(imogen.look, /52/)
  assert.match(`${imogen.look} ${imogen.outfit}`, /tongs/i)
  assert.match(lorcan.look, /19/)
  assert.match(`${lorcan.look} ${lorcan.outfit}`, /fade|hoodie/i)
  const late = detectProse('Ignatius Varela steps out of the ring: sixty-six, a white flat-top, a faded robe. Ignatius waits.')
  const ignatius = late.characters.find(person => /Ignatius/.test(person.name))
  assert.ok(ignatius)
  assert.match(`${ignatius.look} ${ignatius.outfit}`, /sixty-six/)
  assert.match(`${ignatius.look} ${ignatius.outfit}`, /flat-top|robe/i)
})

test('D2 a verb after the age is not part of the look and parking is not Park', () => {
  const found = detectProse('Darius, 58, waits in a parking lot by the ring road. Darius checks the gate.')
  const darius = found.characters.find(person => person.name === 'Darius')
  assert.ok(darius)
  assert.match(darius.look, /58/)
  assert.doesNotMatch(`${darius.look} ${darius.outfit}`, /waits|parking/i)
  assert.equal(found.places.some(place => place.name === 'Park'), false)
  assert.ok(found.places.some(place => /parking/i.test(place.name)))
})

test('D3 a French material is not a place', () => {
  const found = detectProse('Apolline, 40, cheveux courts, canne en bois, marche dans la rue. Apolline attend.')
  assert.equal(found.language, 'fr')
  assert.equal(found.places.some(place => /forêt|foret/i.test(place.name)), false)
  assert.equal(found.places.some(place => /canne/i.test(`${place.name} ${place.description}`)), false)
  assert.ok(found.places.some(place => /rue/i.test(place.name)))
})

test('D4 German nouns are not people and the actions stay', () => {
  const text = 'Hannelore, 60, graue Locken, wartet in der Küche. Sie hebt den Kristall. Hannelore liest den Brief. Hannelore geht zur Tür. Am Morgen wartet Hannelore. In der Nacht liest Hannelore.'
  const found = detectProse(text)
  assert.equal(found.language, 'de')
  assert.deepEqual(names(found), ['Hannelore'])
  assert.ok(found.scenes.length >= 4, found.scenes.map(scene => scene.what).join(' | '))
  assert.equal(found.places.some(place => /locken|kristall/i.test(place.name)), false)
  const morning = found.scenes.find(scene => /morgen/i.test(scene.what))
  const night = found.scenes.find(scene => /nacht/i.test(scene.what))
  assert.equal(morning?.light, 'dawn')
  assert.equal(night?.light, 'night')
})

test('D5 Japanese without quotes keeps the person, the place, and more than one shot', () => {
  const text = '佐伯美咲は台所で待つ。美咲は手紙を読む。二人は座る。'
  const found = detectProse(text)
  assert.equal(found.language, 'ja')
  assert.equal(names(found).includes('二人'), false)
  assert.equal(names(found).filter(name => name.includes('美咲')).length, 1)
  assert.ok(found.places.some(place => /台所/.test(place.name)))
  assert.ok(found.scenes.length >= 2, String(found.scenes.length))
  const planned = plan({ input: 'prose', prose: text, model: 'grok', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  assert.ok(planned.body.shots.length >= 2)
})

test('D6 a Chinese name stays and a holding fragment does not, and night is not dawn', () => {
  const text = '赵明远拿着一封信。赵明远在咖啡馆等待。黎明时赵明远出门。夜里赵明远回来。'
  const found = detectProse(text)
  assert.equal(found.language, 'zh-Hans')
  assert.ok(names(found).includes('赵明远'), names(found).join(', '))
  assert.equal(names(found).some(name => name.includes('拿') || name.includes('着')), false)
  assert.equal(found.places.some(place => place.name.includes('等待')), false)
  const night = found.scenes.find(scene => /夜/.test(scene.what))
  const dawn = found.scenes.find(scene => /黎明/.test(scene.what))
  assert.equal(dawn?.light, 'dawn')
  assert.equal(night?.light, 'night')
  const planned = plan({ input: 'prose', prose: text, model: 'grok', promptLanguage: 'zh-Hans', compact: true })
  assert.equal(planned.status, 200, planned.body.message)
  assert.match(planned.body.shots.find(shot => /夜/.test(shot.prompt)).prompt, /夜/)
  assert.doesNotMatch(planned.body.shots.find(shot => /夜/.test(shot.prompt)).prompt, /黎明|日出/)
})

test('D7 evening and sunrise set the light from that sentence on', () => {
  const found = detectProse('In the evening, Nia waits in the kitchen. At sunrise, Nia opens the door.')
  assert.equal(found.scenes[0].light, 'dusk')
  assert.equal(found.scenes[1].light, 'dawn')
  const planned = plan({ input: 'prose', prose: 'In the evening, Nia waits in the kitchen. At sunrise, Nia opens the door.', model: 'grok', compact: true })
  assert.equal(planned.status, 200)
  assert.match(planned.body.shots[0].prompt, /dusk/i)
  assert.doesNotMatch(planned.body.shots[0].prompt, /soft window light/i)
  assert.match(planned.body.shots[1].prompt, /dawn/i)
  assert.doesNotMatch(planned.body.shots[1].prompt, /\bnight\b/i)
})

test('D8 a description sentence is not the first shot', () => {
  const text = 'His niece Tamsin Okoro is twenty-four, with a cropped afro and a yellow coat. Tamsin waits in the kitchen.'
  const found = detectProse(text)
  assert.ok(found.characters.some(person => person.name === 'Tamsin Okoro'))
  assert.doesNotMatch(found.scenes[0]?.what || '', /twenty-four/)
  assert.match(found.scenes[0]?.what || '', /waits/i)
  const planned = plan({ input: 'prose', prose: text, model: 'grok', compact: true })
  assert.equal(planned.status, 200)
  assert.match(planned.body.shots[0].prompt, /waits/i)
  assert.doesNotMatch(planned.body.shots[0].prompt.split('\n')[0], /is twenty-four|niece/i)
})

test('D9 an object or a position is not a place', () => {
  const text = 'A leaking pipe drips. At the bottom, a nail sticks out. Nia, 30, short black hair, grey coat, waits in the kitchen.'
  const found = detectProse(text)
  const labels = found.places.map(place => `${place.name} ${place.description}`).join(' | ')
  assert.doesNotMatch(labels, /pipe|bottom|nail/i)
  const planned = plan({ input: 'prose', prose: text, model: 'grok', format: 'agent' })
  assert.equal(planned.status, 200, planned.body.message)
  const sheet = (planned.body.filmSheet?.places || []).map(place => place.name).join(' | ')
  assert.doesNotMatch(sheet, /pipe|bottom|nail/i)
})

test('D10 a locative place noun is kept when it is in the lexicon', () => {
  const text = 'Nia waits in the pawnshop. Nia trains in the boxing gym. Nia waits on the fire escape. Nia walks on the embankment. Nia rinses the car at the car wash. Nia waits in the greenhouse. Nia waits in the sawmill.'
  const found = detectProse(text)
  const where = found.scenes.map(scene => scene.where).join(' | ')
  for (const place of ['Pawnshop', 'Boxing gym', 'Fire escape', 'Embankment', 'Car wash', 'Greenhouse', 'Sawmill']) {
    assert.match(where, new RegExp(place, 'i'), where)
  }
  assert.equal(found.places.some(place => /setting/i.test(place.name)), false)
})

test('D11 the public guide lists seven languages and does not mention the removed checker', () => {
  const full = readFileSync('public/llms-full.txt', 'utf8')
  const llms = readFileSync('public/llms.txt', 'utf8')
  const readme = readFileSync('README.md', 'utf8')
  for (const text of [full, llms, readme]) {
    assert.doesNotMatch(text, /Luxembourgish|\blb\b|verifier|roberta-ner|MOOVICUT_NER|zero AI/i)
  }
  assert.doesNotMatch(full, /English and French only/i)
  assert.match(full, /English, Simplified Chinese, Portuguese, Japanese, French, German, and Italian/)
  assert.match(full, /40 shots/)
})
