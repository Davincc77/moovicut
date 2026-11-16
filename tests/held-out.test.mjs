import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProse } from '../app/utils/prose-detect.js'
import { parseFountain } from '../app/utils/fountain.js'
import { placeLexiconLemmas, usePlaceLexicon } from '../app/utils/place-lexicon.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

/**
 * Held-out stories. Written as ordinary scenes, not copied from the bug notes.
 * Each one names who, where, and when in the text itself.
 */
const STORIES = [
  { lang: 'en', text: 'Hope, 34, short brown hair, grey coat, waits in the kitchen. Hope pours tea.', names: ['Hope'], where: /kitchen/i, light: '' },
  { lang: 'en', text: 'Will, 41, grey beard, navy jacket, waits in the garden. That night, Will locks the gate.', names: ['Will'], where: /garden/i, lights: ['', 'night'] },
  { lang: 'en', text: 'Rose, 29, black curls, red scarf, waits in the library. Rose reads a letter.', names: ['Rose'], where: /library/i },
  { lang: 'en', text: 'Mark, 52, white hair, brown coat, waits in the station. Mark lifts a bag.', names: ['Mark'], where: /station/i },
  { lang: 'pt', text: 'Lia, 30, cabelo curto, casaco cinza, espera na cozinha. Ela abre uma porta.', names: ['Lia'], where: /cozinha/i },
  { lang: 'pt', text: 'Rui, 48, barba grisalha, casaco azul, espera no parque. Ele lê uma carta.', names: ['Rui'], where: /parque/i },
  { lang: 'pt', text: 'Ana, 27, cabelo preto, vestido verde, espera na estação. Ela sorri com calma.', names: ['Ana'], where: /estação|estacao/i },
  { lang: 'zh-Hans', text: '「林」三十出头，黑色短发，灰色大衣。林在咖啡馆等待。林打开门。', names: ['林'], where: /咖啡馆/ },
  { lang: 'zh-Hans', text: '「周」五十多岁，灰白胡茬，棕色大衣。周在车站等待。周笑。', names: ['周'], where: /车站/ },
  { lang: 'en', text: 'In the morning, Hope waits in the kitchen. That night, Hope waits in the garden.', names: ['Hope'], where: /kitchen/i, lights: ['dawn', 'night'], wheres: [/kitchen/i, /garden/i] }
]

function score(stories, detect = detectProse) {
  let names = 0
  let places = 0
  let nameGold = 0
  let placeGold = 0
  for (const story of stories) {
    const found = detect(story.text)
    nameGold += story.names.length
    placeGold += 1
    names += story.names.filter(name => found.characters.some(item => item.name === name)).length
    const where = found.scenes.map(scene => scene.where).join(' ')
    if (story.where.test(where) || story.where.test(found.places.map(place => place.name).join(' '))) places += 1
  }
  return { names: names / nameGold, places: places / placeGold, count: stories.length }
}

test('held-out stories across the three site languages keep the named person and place', () => {
  assert.ok(STORIES.length >= 8)
  const languages = new Set(STORIES.map(story => story.lang))
  assert.deepEqual([...languages].sort(), ['en', 'pt', 'zh-Hans'])
  for (const code of ['fr', 'ja', 'it']) assert.equal(languages.has(code), false, code)
  for (const story of STORIES) {
    const found = detectProse(story.text)
    for (const name of story.names) {
      assert.ok(found.characters.some(item => item.name === name), `${story.lang} ${name} in ${found.characters.map(item => item.name).join(',')}`)
    }
    const where = `${found.places.map(place => place.name).join(' ')} ${found.scenes.map(scene => scene.where).join(' ')}`
    assert.match(where, story.where, story.text)
    if (story.lights) {
      assert.deepEqual(found.scenes.map(scene => scene.light), story.lights, story.text)
    }
    if (story.wheres) {
      story.wheres.forEach((pattern, index) => assert.match(found.scenes[index]?.where || '', pattern, story.text))
    }
  }
})

test('renaming a person or swapping a place keeps the shot structure', () => {
  const left = detectProse('Hope, 34, short brown hair, grey coat, waits in the kitchen. That night, Hope pours tea.')
  const right = detectProse('Will, 34, short brown hair, grey coat, waits in the garden. That night, Will pours tea.')
  assert.equal(left.scenes.length, right.scenes.length)
  assert.deepEqual(left.scenes.map(scene => scene.light), right.scenes.map(scene => scene.light))
  assert.notEqual(left.scenes.at(-1).where, right.scenes.at(-1).where)
  assert.equal(left.characters.length, 1)
  assert.equal(right.characters.length, 1)
  assert.equal(left.characters[0].name, 'Hope')
  assert.equal(right.characters[0].name, 'Will')
  assert.match(`${left.characters[0].look} ${left.characters[0].outfit}`, /34/)
  assert.match(`${right.characters[0].look} ${right.characters[0].outfit}`, /34/)
})

test('dropping a fifth of the place lexicon lowers place recall gently', () => {
  const full = score(STORIES.filter(story => story.lang === 'en'))
  const lemmas = placeLexiconLemmas()
  const kept = lemmas.filter((_, index) => index % 5 !== 0)
  usePlaceLexicon(kept)
  try {
    const reduced = score(STORIES.filter(story => story.lang === 'en'))
    assert.ok(reduced.places <= full.places)
    assert.ok(reduced.places >= full.places * 0.5, `${reduced.places} vs ${full.places}`)
    assert.equal(reduced.names, full.names)
  } finally {
    usePlaceLexicon()
  }
})

test('a Fountain sheet plans through the scenario path', () => {
  const sheet = `CHARACTERS
Hope — 34, short brown hair — grey coat

INT. KITCHEN - MORNING
Hope pours tea.

EXT. GARDEN - NIGHT
Hope waits.`
  const parsed = parseFountain(sheet)
  assert.equal(parsed.characters[0].name, 'Hope')
  assert.equal(parsed.scenes.length, 2)
  assert.equal(parsed.scenes[0].light, 'dawn')
  assert.equal(parsed.scenes[1].light, 'night')
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'fountain', text: sheet, model: 'grok', compact: true })
  })
  assert.equal(response.status, 200, response.body)
  const body = JSON.parse(response.body)
  assert.equal(body.shots.length, 2)
  assert.match(body.shots[0].prompt, /Hope/)
  assert.match(body.shots[0].prompt, /kitchen/i)
  assert.match(body.shots[1].prompt, /night/i)
})
