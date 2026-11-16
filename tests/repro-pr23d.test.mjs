import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectProse } from '../app/utils/prose-detect.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { placeTag } from '../app/utils/place-lexicon.js'

function plan(prose) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose })
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function places(body) {
  return (body.filmSheet?.places || []).map(place => place.name)
}

function wheres(body) {
  return (body.shots || []).map(shot => shot.where || '')
}

function names(body) {
  return (body.filmSheet?.characters || []).map(person => person.name)
}

const EN = 'Mara Lindqvist, 30, short black hair, a green raincoat, carries a lantern.'

test('R1 a shallow dish and a narrow bar are not places', () => {
  const body = plan(`${EN}\n\nIn the morning, Mara walks into a narrow sandwich bar. She lifts a shallow tin dish. She sets the lantern on the counter.`).body
  const found = places(body)
  assert.equal(found.some(name => /^narrow$/i.test(name) || /^shallow$/i.test(name)), false, found.join(', '))
})

test('R3 a later school does not replace the mine', () => {
  const body = plan(`${EN}\n\nAt dawn, Mara climbs down into the old tin mine. Mara taps the wall with a hammer. Mara reads a map.\n\nIn the evening, Mara walks to the tennis court behind the school. Mara serves the ball.`).body
  const where = wheres(body)
  assert.ok(where.length > 1, where.join(' | '))
  assert.notEqual(where[1], 'School')
  assert.equal(where.slice(0, 3).some(name => /mine/i.test(name)), true, where.join(' | '))
})

test('R4 Japanese prose is not planned as Japanese', () => {
  const result = plan('岸本透は七十歳で、禿げ頭に茶色のエプロンをして、鍬を担いでいる。\n\n朝、岸本さんは畑に出た。岸本さんは鍬で土を起こした。\n\n夕方、岸本さんは小学校の校庭で旗を振った。岸本さんは笑った。')
  assert.notEqual(result.body.language, 'ja')
})

test('R5 Italian action sentences stay shots when the verb is not on a short list', () => {
  const result = plan('Ludovica Ferraresi, 38 anni, caschetto nero, giacca di pelle rossa, porta una macchina fotografica.\n\nAl mattino Ludovica arriva al porto. Ludovica ripara una rete. Ludovica fotografa le barche. Ludovica accende la pipa.')
  assert.equal(result.status, 200, result.body.message)
  assert.ok(wheres(result.body).length >= 4, wheres(result.body).join(' | '))
})

test('R7 Chinese prose is not planned as Chinese', () => {
  const result = plan('林国栋五十八岁，花白的平头，穿一件灰色毛背心，腰间别着一支竹笛。\n\n中午，林国栋去镇上的银行。林国栋在柜台前填了一张表。林国栋坐在长椅上轻轻吹着竹笛。')
  assert.notEqual(result.body.language, 'zh-Hans')
})

test('R8 a later night does not light the morning shots', () => {
  const body = plan('Quirin Ostertag, 31 Jahre, rasierter Kopf, orange Warnweste, ein Schlüsselbund.\n\nAm Morgen betritt Quirin die Bank. Quirin legt den Schlüsselbund auf den Schalter. Quirin öffnet die Tür.\n\nIn der Nacht sitzt Quirin vor dem Schloss. Quirin liest einen Brief.').body
  const prompts = (body.shots || []).map(shot => shot.prompt || '')
  assert.ok(prompts.length >= 2)
  assert.equal(prompts[0].includes('Night'), false)
  assert.equal(prompts[1].includes('Night'), false)
})

test('R8b Japanese prose is not planned as Japanese', () => {
  const result = plan('岸本透は七十歳で、禿げ頭に茶色のエプロンをして、鍬を担いでいる。\n\n朝、岸本さんは畑に出た。岸本さんは鍬で土を起こした。\n\n夕方、岸本さんは校庭で旗を振った。')
  assert.notEqual(result.body.language, 'ja')
})

test('R9 French prose is not planned as French', () => {
  const result = plan('Léonie Vasseur, 19 ans, longue tresse châtain, ciré jaune, un sifflet.\n\nAu lever du soleil, Léonie entre dans le moulin. Léonie souffle dans son sifflet. Léonie ramasse une plume.')
  assert.notEqual(result.body.language, 'fr')
  assert.equal(placeTag('fr', 'son'), '')
})

test('R10 Japanese common nouns with が are not characters', () => {
  const found = detectProse('森健太郎は四十歳で、白髪まじりの短髪に紺の作業着を着て、古い地図を持っている。\n\n朝、森さんは森に入った。鳥の声が森に響いた。夜、満月が見えた。')
  const cast = found.characters.map(person => person.name)
  assert.equal(cast.includes('声'), false, cast.join(', '))
  assert.equal(cast.includes('満月'), false, cast.join(', '))
})

test('R11a adjectives and garments are not sure places', () => {
  for (const word of ['shallow', 'narrow', 'deep', 'stairs']) assert.notEqual(placeTag('en', word), 's', word)
  assert.equal(placeTag('fr', 'son'), '')
})

test('R11b a locative noun is kept even when it was not copied from a test report', () => {
  const samples = [
    ['pt', 'Rui tem 40 anos e entra na mina. Rui lê uma carta.', /mina/i]
  ]
  for (const [language, text, place] of samples) {
    const found = detectProse(text)
    assert.equal(found.language, language, text)
    assert.ok(found.places.some(item => place.test(item.name)) || found.scenes.some(scene => place.test(scene.where || '')), `${language} ${found.places.map(item => item.name).join(', ')}`)
  }
})

test('an Italian portrait is not answered as Italian', () => {
  const result = plan('Chiara Bellandi, 40 anni, capelli corti, cappotto blu.')
  assert.notEqual(result.body.language, 'it')
  const rejected = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.', promptLanguage: 'it' })
  })
  assert.equal(rejected.status, 400)
  assert.match(JSON.parse(rejected.body).message, /promptLanguage must be one of: en, pt/)
})

test('Luxembourgish cue tables are gone from the detectors', () => {
  for (const file of ['scene-split.js', 'prose-extra.js', 'prose-detect.js']) {
    const source = readFileSync(new URL(`../app/utils/${file}`, import.meta.url), 'utf8')
    assert.equal(/\blb:/.test(source), false, file)
  }
})
