import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectProse } from '../app/utils/prose-detect.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { parseFountain } from '../app/utils/fountain.js'
import { libraryHits } from '../app/utils/place-lexicon.js'

function plan(prose) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose, format: 'agent' })
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

test('an opening scene keeps its own noun instead of a later place', () => {
  const result = plan('Wilhelmina Quarrie, 50, grey bob, yellow oilskin jacket, carries a tin whistle. At dawn Wilhelmina walks up to the old bothy on the moor. At noon Wilhelmina reaches the lighthouse.')
  assert.equal(result.status, 200, result.body.message)
  const where = result.body.shots.map(shot => shot.where)
  assert.equal(result.body.shots.some(shot => /tin whistle|oilskin/i.test(shot.what || '')), false)
  const bothy = result.body.shots.find(shot => /bothy/i.test(shot.source || shot.what || ''))
  assert.match(bothy?.where || '', /bothy/i)
  assert.match(where.at(-1) || '', /lighthouse/i)
  assert.equal(where.slice(0, 1).some(name => /lighthouse/i.test(name || '')), false)
})

test('the first noun after at is the place, not a later below-phrase', () => {
  const result = plan('Perpetua Dunmore, 61, white plait, navy swimsuit, carries a striped towel. In the morning Perpetua swims at the lido below the headland.')
  const swimming = result.body.shots.find(shot => /lido/i.test(shot.source || shot.what || ''))
  assert.equal(swimming.where, 'Lido')
})

test('Italian and Japanese prose are not planned as those languages', () => {
  const italian = plan("Teodoro Saltamacchia, 70 anni, barba grigia, grembiule verde. All'alba Teodoro apre il frantoio del paese. Teodoro entra nella biblioteca.")
  const japanese = plan('中村宗一郎は五十歳で、灰色の短髪に紺のシャツを着て、いつも黒い傘を持っている。朝、宗一郎は公園で新聞を読んだ。')
  assert.notEqual(italian.body.language, 'it')
  assert.notEqual(japanese.body.language, 'ja')
  for (const code of ['fr', 'ja', 'it']) {
    const rejected = dispatchAgentRequest({
      method: 'POST',
      pathname: '/api/v1/storyboard',
      body: JSON.stringify({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.', promptLanguage: code })
    })
    assert.equal(rejected.status, 400, code)
    assert.match(JSON.parse(rejected.body).message, /en, pt/)
  }
})

test('a place kanji does not match inside a longer Japanese name', () => {
  const hits = libraryHits('姪の小野寺さゆりは十歳。', 'ja').map(hit => hit.lemma)
  assert.equal(hits.includes('小野'), false)
})

test('a pronoun continues the last person, and each shot keeps its sentence and flags', () => {
  const result = plan('Nia waits in the kitchen. She reads a letter.')
  const second = result.body.shots[1]
  assert.equal(second.who, 'Nia')
  assert.match(second.source, /She reads/)
  assert.equal(second.flags.some(flag => flag.field === 'who' && flag.code === 'who_pronoun'), true)
})

test('Fountain dialogue keeps the speaker and the heading place', () => {
  const parsed = parseFountain(`CHARACTERS
Hope — 34, short brown hair — grey coat

INT. KITCHEN - MORNING
Hope pours tea.

MARA
You're late.`)
  assert.equal(parsed.scenes.at(-1).who, 'MARA')
  assert.equal(parsed.scenes.at(-1).where, 'KITCHEN')
  assert.match(parsed.scenes.at(-1).what, /late/)
})

test('the place supplement does not contain blind-test vocabulary', () => {
  const source = readFileSync(new URL('../scripts/build-place-lexicon.py', import.meta.url), 'utf8')
  const block = source.slice(source.indexOf('SUPPLEMENT'), source.indexOf('def fold'))
  for (const word of ['bois', 'moulin', 'konditorei', 'biergarten', 'miniera', 'miradouro', '銭湯', '火锅店', '竹林', '商店街']) {
    assert.equal(block.includes(`'${word}'`), false, word)
  }
})
