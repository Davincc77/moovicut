import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectProse } from '../app/utils/prose-detect.js'
import { editCut, isFunctionWord, isNeverPlace, splitNarrative, supportedCueLanguages } from '../app/utils/scene-split.js'
import { foldName } from '../app/utils/scenario.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const KEY = JSON.parse(readFileSync(new URL('./fixtures/prose/expected_scenes.json', import.meta.url), 'utf8'))

function storyText(name) {
  return readFileSync(new URL(`./fixtures/prose/${name}.txt`, import.meta.url), 'utf8')
}

const RULES = {
  en: {
    places: [{ name: 'Kitchen', keys: ['kitchen'] }, { name: 'Station', keys: ['station'] }, { name: 'Beach', keys: ['beach'] }, { name: 'Street', keys: ['street'] }],
    opening: 'Maya reads a letter in the station.',
    combined: 'After that, in the kitchen, at 10 a.m., Maya opens the fridge.',
    sequence: 'Then she pours water.',
    cueOnly: 'The next day.',
    silence: 'She waits in a silence.',
    memory: 'She thinks of the beach.',
    dialogue: 'He says, "We should go to the beach."',
    eyes: 'She looks in his eyes.',
    closeClock: 'At 10:05 she smiles.',
    uncertain: 'She walks toward the station.',
    glance: 'She glances toward the street, without leaving the room.',
    functions: ['Then', 'In', 'We', 'So', 'Suddenly', 'At', 'Only', 'After'],
    neverPlaces: ['eye', 'eyes', 'sleeve', 'eyebrow', 'light', 'distance', 'drawing', 'silence']
  },
  fr: {
    places: [{ name: 'Cuisine', keys: ['cuisine'] }, { name: 'Gare', keys: ['gare'] }, { name: 'Plage', keys: ['plage'] }, { name: 'Rue', keys: ['rue'] }],
    opening: 'Maya lit une lettre à la gare.',
    combined: 'Ensuite, dans la cuisine, à 10h, Maya ouvre le frigo.',
    sequence: 'Puis elle verse de l\'eau.',
    cueOnly: 'Le lendemain.',
    silence: 'Elle attend dans un silence.',
    memory: 'Elle pense à la plage.',
    dialogue: 'Il dit : « On devrait aller à la plage. »',
    eyes: 'Elle regarde dans ses yeux.',
    closeClock: 'À 10h05 elle sourit.',
    uncertain: 'Elle marche vers la gare.',
    glance: 'Elle jette un regard vers la rue, sans quitter la pièce.',
    functions: ['Ensuite', 'Soudain', 'Alors', 'Puis', 'Hier', 'Elle', 'Dans'],
    neverPlaces: ['sourcil', 'manche', 'yeux', 'silence', 'lumière', 'dessin', 'dos']
  },
  pt: {
    places: [{ name: 'Cozinha', keys: ['cozinha'] }, { name: 'Estação', keys: ['estação', 'estacao'] }, { name: 'Praia', keys: ['praia'] }],
    opening: 'Maya lê uma carta na estação.',
    combined: 'Depois, na cozinha, às 10h, Maya abre o frigorífico.',
    sequence: 'Então ela verte água.',
    cueOnly: 'No dia seguinte.',
    silence: 'Ela espera em silêncio.',
    memory: 'Ela pensa na praia.',
    dialogue: 'Ele diz: "Devíamos ir à praia."',
    eyes: 'Ela olha nos olhos dele.',
    closeClock: 'Às 10h05 ela sorri.',
    uncertain: 'Ela caminha para a estação.',
    glance: 'Ela olha para a rua, sem sair.',
    functions: ['Então', 'Depois', 'Ela', 'Nos'],
    neverPlaces: ['olho', 'olhos', 'manga', 'silêncio', 'luz', 'desenho']
  },
  de: {
    places: [{ name: 'Küche', keys: ['küche', 'kuche'] }, { name: 'Bahnhof', keys: ['bahnhof'] }, { name: 'Strand', keys: ['strand'] }],
    opening: 'Maya liest einen Brief im Bahnhof.',
    combined: 'Danach, in der Küche, um 10 Uhr, öffnet Maya den Kühlschrank.',
    sequence: 'Dann gießt sie Wasser ein.',
    cueOnly: 'Am nächsten Tag.',
    silence: 'Sie wartet in der Stille.',
    memory: 'Sie denkt an den Strand.',
    dialogue: 'Er sagt: "Wir sollten an den Strand gehen."',
    eyes: 'Sie sieht in seine Augen.',
    closeClock: 'Um 10:05 Uhr lächelt sie.',
    uncertain: 'Sie geht in Richtung Bahnhof.',
    glance: 'Sie blickt zur Straße, ohne zu verlassen.',
    functions: ['Dann', 'Danach', 'Wir', 'So'],
    neverPlaces: ['auge', 'augen', 'ärmel', 'stille', 'licht', 'zeichnung']
  },
  it: {
    places: [{ name: 'Cucina', keys: ['cucina'] }, { name: 'Stazione', keys: ['stazione'] }, { name: 'Spiaggia', keys: ['spiaggia'] }],
    opening: 'Maya legge una lettera nella stazione.',
    combined: 'Poi, nella cucina, alle 10, Maya apre il frigo.',
    sequence: 'Quindi versa l\'acqua.',
    cueOnly: 'Il giorno dopo.',
    silence: 'Aspetta in silenzio.',
    memory: 'Pensa alla spiaggia.',
    dialogue: 'Lui dice: "Dovremmo andare alla spiaggia."',
    eyes: 'Lo guarda negli occhi.',
    closeClock: 'Alle 10:05 sorride.',
    uncertain: 'Cammina verso la stazione.',
    glance: 'Guarda verso la strada, senza lasciare.',
    functions: ['Poi', 'Quindi', 'Allora', 'Lei'],
    neverPlaces: ['occhio', 'occhi', 'manica', 'silenzio', 'luce', 'disegno']
  },
  lb: {
    places: [{ name: 'Kichen', keys: ['kichen'] }, { name: 'Gare', keys: ['gare'] }, { name: 'Strand', keys: ['strand'] }],
    opening: 'D\'Maya liest e Bréif an der Gare.',
    combined: 'Duerno, an der Kichen, ëm 10 Auer, mécht d\'Maya de Frigo op.',
    sequence: 'Dann geet si Waasser.',
    cueOnly: 'Den aneren Dag.',
    silence: 'Si waart an der Rou.',
    memory: 'Si denkt un de Strand.',
    dialogue: 'Hie seet: "Mir sollten op de Strand goen."',
    eyes: 'Si kuckt an seng Aen.',
    closeClock: 'Ëm 10:05 Auer laacht si.',
    uncertain: 'Si geet a Richtung Gare.',
    glance: 'Si kuckt op d\'Strooss, ouni ze verloossen.',
    functions: ['Dann', 'Duerno', 'Mir'],
    neverPlaces: ['a', 'ae', 'aermel', 'rou', 'liicht']
  },
  ja: {
    places: [{ name: '厨房', keys: ['厨房', 'キッチン'] }, { name: '駅', keys: ['駅'] }, { name: '海岸', keys: ['海岸'] }],
    opening: '麻耶は駅で手紙を読む。',
    combined: 'それから、厨房で、10時、麻耶は冷蔵庫を開ける。',
    sequence: 'そして水を注ぐ。',
    cueOnly: '翌日。',
    silence: '彼女は沈黙で待つ。',
    memory: '彼女は海岸を思い出す。',
    dialogue: '彼は「海岸に行こう」と言う。',
    eyes: '彼女は目を見る。',
    closeClock: '10時05分彼女は笑う。',
    uncertain: '彼女は駅の方へ歩く。',
    glance: '彼女は通りをちらっと見る。',
    functions: ['それから', 'そして', '突然'],
    neverPlaces: ['目', '沈黙']
  },
  'zh-Hans': {
    places: [{ name: '厨房', keys: ['厨房'] }, { name: '车站', keys: ['车站'] }, { name: '海边', keys: ['海边'] }],
    opening: '玛雅在车站读信。',
    combined: '然后，在厨房，10点，玛雅打开冰箱。',
    sequence: '接着她倒水。',
    cueOnly: '第二天。',
    silence: '她在沉默里等。',
    memory: '她想起海边。',
    dialogue: '他说：“我们去海边吧。”',
    eyes: '她看着他的眼睛。',
    closeClock: '10点05分她笑了。',
    uncertain: '她朝着车站走。',
    glance: '她望向街道，没有离开。',
    functions: ['然后', '接着', '突然'],
    neverPlaces: ['眼睛', '沉默', '光']
  }
}

function runCase(language, sample) {
  const text = [sample.opening, sample.sequence, sample.cueOnly, sample.combined, sample.silence, sample.memory, sample.dialogue, sample.eyes, sample.closeClock].join(' ')
    return splitNarrative(text, { language, places: sample.places })
}

for (const language of supportedCueLanguages()) {
  test(`${language}: one cut per sentence, and the traps do not move the scene`, () => {
    const sample = RULES[language]
    assert.ok(sample, language)
    sample.functions.forEach(word => assert.equal(isFunctionWord(word, language), true, word))
    sample.neverPlaces.forEach(word => assert.equal(isNeverPlace(word), true, word))
    const result = runCase(language, sample)
    assert.equal(result.shots.some(shot => foldName(shot.what) === foldName(sample.cueOnly.replace(/[.。]+$/u, ''))), false, 'cue-only sentence')
    const sceneCuts = result.cuts.filter(cut => cut.kind === 'scene')
    assert.ok(sceneCuts.length >= 1, 'a later place or time opens a scene')
    assert.ok(sceneCuts.every(cut => cut.reason), 'every scene cut has a reason')
    const kitchen = result.shots.filter(shot => /kitchen|cuisine|cozinha|küche|kuche|cucina|kichen|厨房|キッチン/i.test(`${shot.where} ${shot.what}`))
    assert.ok(kitchen.length >= 1, 'the combined sentence reaches the kitchen')
    assert.equal(kitchen.filter(shot => shot.sceneCut).length <= 1, true, 'one cut for the combined sentence')
    const sequence = result.shots.find(shot => foldName(shot.what).includes(foldName(sample.sequence).slice(0, 12)) || shot.cutKind === 'shot')
    if (sequence?.cutKind === 'shot') {
      assert.equal(sequence.sceneCut, false)
      assert.match(sequence.cutReason, /Sequence cue/i)
    }
    assert.equal(result.shots.some(shot => /beach|plage|praia|strand|spiaggia|海岸|海边/i.test(shot.where)), false, 'memory and dialogue do not move the place')
    assert.equal(result.shots.some(shot => /eye|yeux|olho|auge|occhio|目|眼睛|silence|silêncio|stille|silenzio/i.test(shot.where)), false)
    const uncertain = splitNarrative(`${sample.opening} ${sample.uncertain}`, { language, places: sample.places, verbs: ['walks', 'marche', 'caminha', 'geht', 'cammina', 'geet', '歩く', '走'] })
    const weak = uncertain.cuts.find(cut => cut.kind === 'scene')
    if (weak) {
      assert.equal(weak.uncertain, true, 'a toward-cue is marked uncertain')
      assert.match(weak.reason, /Uncertain/i)
    }
    const glance = splitNarrative(`${sample.opening} ${sample.glance}`, { language, places: [...sample.places, { name: 'Street', keys: ['street', 'rue', 'rua', 'straße', 'strasse', 'strada', 'strooss', '通り', '街道'] }] })
    assert.equal(glance.shots.some(shot => /street|rue|rua|straße|strada|strooss|通り|街道/i.test(shot.where)), false, 'a glance is not a place change')
  })
}

test('10:05 after 10:00 is not a new scene, and a cue-only line attaches forward', () => {
  const places = [{ name: 'Kitchen', keys: ['kitchen'] }]
  const result = splitNarrative('At 10 a.m. Maya opens the fridge in the kitchen. At 10:05 she smiles. The next day.', {
    language: 'en',
    places,
    verbs: ['opens', 'smiles']
  })
  assert.equal(result.shots.length, 2)
  assert.equal(result.shots.filter(shot => shot.sceneCut).length, 0)
  assert.equal(result.shots.some(shot => /next day/i.test(shot.what)), false)
})

test('merge drops a scene boundary and split promotes a shot cue', () => {
  const cuts = [
    { kind: 'scene', cue: 'le lendemain', reason: 'Time cue: le lendemain', uncertain: false },
    { kind: 'shot', cue: 'puis', reason: 'Sequence cue: puis', uncertain: false }
  ]
  const merged = editCut(cuts, 0, 'merge')
  assert.equal(merged[0].kind, 'shot')
  assert.equal(merged[0].merged, true)
  const split = editCut(cuts, 1, 'split')
  assert.equal(split[1].kind, 'scene')
  assert.match(split[1].reason, /Split/)
})

test('sentence-initial connectors are not characters, and a missing look does not reject the board', () => {
  const french = detectProse('Ensuite Maya ouvre la porte. Soudain Maya sourit. Elle pense à Paris.')
  assert.equal(french.characters.some(item => /^(Ensuite|Soudain|Elle|Paris)$/i.test(item.name)), false)
  const english = detectProse('In the early evening Maya reads. Suddenly Maya smiles. We should go. So Maya waits.')
  assert.equal(english.characters.some(item => /^(In|Suddenly|We|So|At|Only)$/.test(item.name)), false)
  const bare = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: 'Jules enters the cafe. Jules waits by the counter.', promptLanguage: 'fr' })
  })
  assert.equal(bare.status, 200)
  const body = JSON.parse(bare.body)
  const warning = body.warnings.find(item => item.code === 'missing_look' && item.name === 'Jules')
  assert.ok(warning)
  assert.match(warning.message, /Jules/)
  assert.match(warning.message, /apparence/i)
  const strict = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ scenario: { characters: [{ name: 'Maya' }], places: [{ name: 'Quay' }], scenes: [{ who: 'Maya', where: 'Quay' }] } })
  })
  assert.equal(strict.status, 400)
  assert.match(JSON.parse(strict.body).message, /missing a look/)
})

function canonicalPlace(name, story) {
  const key = foldName(name)
  if (!key) return ''
  for (const place of story.gold_places) {
    if (place.aliases.some(alias => {
      const folded = foldName(alias)
      return key === folded || (folded.length >= 4 && (key.includes(folded) || folded.includes(key)))
    })) return place.name
  }
  return ''
}

function collapse(shots, story) {
  const sequence = []
  shots.forEach(shot => {
    const id = canonicalPlace(shot.where, story) || (shot.where ? `other:${foldName(shot.where)}` : '')
    if (!id) return
    if (sequence[sequence.length - 1] !== id) sequence.push(id)
  })
  return sequence
}

function scoreStory(name) {
  const story = KEY.stories[name]
  const text = storyText(name)
  const detected = detectProse(text)
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: text, model: 'grok' })
  })
  const body = JSON.parse(response.body)
  const goldNames = new Set(story.gold_characters.map(item => foldName(item.name)))
  const foundNames = detected.characters.map(item => foldName(item.name))
  const characterHits = foundNames.filter(item => goldNames.has(item))
  const goldPlaces = story.gold_places
  const foundPlaces = detected.places.map(place => place.name)
  const placeHits = foundPlaces.filter(place => canonicalPlace(place, story))
  const recalledPlaces = goldPlaces.filter(place => foundPlaces.some(found => canonicalPlace(found, story) === place.name))
  const expected = story.scenes.map(scene => {
    const id = goldPlaces.find(place => scene.place_aliases.some(alias => place.aliases.includes(alias) || place.name === alias))
    return id?.name || scene.place
  })
  const api = collapse(detected.scenes, story)
  const expectedPairs = expected.slice(1).map((place, index) => [expected[index], place])
  const apiPairs = api.slice(1).map((place, index) => [api[index], place])
  let cursor = 0
  let boundaryHits = 0
  expectedPairs.forEach(pair => {
    const found = apiPairs.slice(cursor).findIndex(item => item[0] === pair[0] && item[1] === pair[1])
    if (found < 0) return
    boundaryHits += 1
    cursor += found + 1
  })
  const falseCuts = apiPairs.filter(pair => !expectedPairs.some(item => item[0] === pair[0] && item[1] === pair[1])).length
  return {
    name,
    status: response.status,
    characters: detected.characters.map(item => item.name),
    places: foundPlaces,
    characterPrecision: foundNames.length ? characterHits.length / foundNames.length : 0,
    characterRecall: characterHits.length / goldNames.size,
    characterHits: characterHits.length,
    characterFound: foundNames.length,
    characterGold: goldNames.size,
    placePrecision: foundPlaces.length ? placeHits.length / foundPlaces.length : 0,
    placeRecall: recalledPlaces.length / goldPlaces.length,
    placeHits: placeHits.length,
    placeFound: foundPlaces.length,
    placeGold: goldPlaces.length,
    boundaryHits,
    boundaryGold: expectedPairs.length,
    falseCuts,
    cuts: (body.cuts || []).length,
    warnings: (body.warnings || []).filter(item => item.code === 'missing_look' || item.code === 'missing_outfit').length
  }
}

test('the four baseline stories return 200 and beat the live detector', () => {
  const rows = ['fr_medium', 'en_medium', 'fr_long', 'en_long'].map(scoreStory)
  let characterHits = 0
  let characterFound = 0
  let characterGold = 0
  let placeHits = 0
  let placeFound = 0
  let placeGold = 0
  let boundaryHits = 0
  let boundaryGold = 0
  let falseCuts = 0
  rows.forEach(row => {
    assert.equal(row.status, 200, row.name)
    assert.equal(row.falseCuts, 0, `${row.name} ${row.places.join(', ')}`)
    assert.equal(row.boundaryHits, row.boundaryGold, row.name)
    characterHits += new Set(row.characters.map(item => foldName(item)).filter(item => KEY.stories[row.name].gold_characters.some(gold => foldName(gold.name) === item))).size
    characterFound += row.characterFound
    characterGold += row.characterGold
    placeHits += row.placeHits
    placeFound += row.placeFound
    placeGold += KEY.stories[row.name].gold_places.filter(place => row.places.some(found => canonicalPlace(found, KEY.stories[row.name]) === place.name)).length
    boundaryHits += row.boundaryHits
    boundaryGold += row.boundaryGold
    falseCuts += row.falseCuts
  })
  const summary = {
    characterPrecision: characterHits / characterFound,
    characterRecall: characterHits / characterGold,
    placePrecision: placeHits / placeFound,
    placeRecall: placeGold / ['fr_medium', 'en_medium', 'fr_long', 'en_long'].reduce((sum, name) => sum + KEY.stories[name].gold_places.length, 0),
    boundary: `${boundaryHits}/${boundaryGold}`,
    falseCuts,
    statuses: rows.map(row => row.status)
  }
  assert.ok(summary.characterPrecision >= 0.9, JSON.stringify(summary))
  assert.equal(summary.characterRecall, 1)
  assert.ok(summary.placePrecision >= 0.9, JSON.stringify(summary))
  assert.equal(summary.placeRecall, 1)
  assert.equal(falseCuts, 0)
  rows.forEach(row => {
    assert.equal(row.places.some(place => /plage|beach|sourcil|manche|street|rue|light|distance/i.test(place)), false, row.places.join(', '))
  })
})
