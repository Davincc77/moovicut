import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectProse } from '../app/utils/prose-detect.js'
import { editCut, findPlaceCue, isCastLine, isCueStopword, isFunctionWord, isNeverPlace, isNumberWord, matchesVerb, namedVenues, splitNarrative, supportedCueLanguages } from '../app/utils/scene-split.js'
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

const PLACE_ARTICLES = new Set(['the', 'le', 'la', 'les', 'l', 'der', 'die', 'das', 'el', 'il', 'lo', 'os', 'as', 'um', 'uma', 'ein', 'eine'])

function placeKey(value) {
  return foldName(value).split(/\s+/).filter(token => token && !PLACE_ARTICLES.has(token)).join(' ')
}

function canonicalPlace(name, story) {
  const key = placeKey(name)
  if (!key) return ''
  for (const place of story.gold_places) {
    if (place.aliases.some(alias => {
      const folded = placeKey(alias)
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

test('the four baseline stories beat the live detector, and a story past 40 shots is refused', () => {
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
    assert.equal(row.status, row.name.endsWith('_long') ? 400 : 200, row.name)
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

const NUMBER_CASES = [
  ['en', 'Three days later. Kenji, round steel glasses, rust-red cardigan, waits in the kitchen.', 'Three'],
  ['fr', 'Trois jours plus tard. Hélène, lunettes fines, attend dans la cuisine.', 'Trois'],
  ['pt', 'Três dias depois. Inês espera na cozinha. Inês sorri.', 'Três'],
  ['it', 'Tre giorni dopo. Giulia aspetta in cucina. Giulia sorride.', 'Tre'],
  ['ja', '三日後。麻耶は厨房で待つ。', '三'],
  ['zh-Hans', '三天后。玛雅在厨房等。', '三']
]

test('number words are never characters in any site language', () => {
  for (const [language, text, word] of NUMBER_CASES) {
    assert.equal(isNumberWord(word, language), true, word)
    assert.equal(isNumberWord('12', language), true)
    const detected = detectProse(text)
    assert.equal(detected.characters.some(item => foldName(item.name) === foldName(word)), false, `${language} ${word}`)
  }
})

const VENUE_CASES = [
  ['fr', "Ensuite, dans la librairie Atlas, ils s'assoient près de la vitrine.", 'Librairie Atlas', 'Atlas'],
  ['fr', 'Dans le café Lumière, Léa ouvre la porte.', 'Café Lumière', 'Lumière'],
  ['en', "After that, in Harbottle's bookshop, they sit down by the window.", "Harbottle's bookshop", 'Harbottle'],
  ['en', 'Atlas bookshop opens at dawn. Maya opens the door.', 'Atlas bookshop', 'Atlas'],
  ['en', 'In the Blue Moon bar, Bridget waits.', 'Blue Moon bar', 'Moon'],
  ['pt', 'Na livraria Atlas, Inês abre a porta.', 'Livraria Atlas', 'Atlas'],
  ['it', 'Nella libreria Atlas, Giulia apre la porta.', 'Libreria Atlas', 'Atlas'],
  ['ja', '麻耶は光書店でドアを開ける。', '光書店', '光'],
  ['zh-Hans', '玛雅在光明书店打开门。', '光明书店', '光明']
]

test('a venue type plus a proper name is a place, not a character', () => {
  for (const [language, text, place, person] of VENUE_CASES) {
    const found = namedVenues(text, language)
    assert.ok(found.some(item => foldName(item.name) === foldName(place)), `${language} ${found.map(item => item.name).join(', ')}`)
    const narrative = splitNarrative(text, {
      language,
      places: found.map(item => ({ name: item.name, keys: item.keys })),
      verbs: ['ouvre', 'opens', 'open', 'sit', 'sits', 'assoient', 'abre', 'apre', 'öffnet', 'wartet', 'mécht', '開ける', '打开', 'pours', 'entre', 'enters']
    })
    assert.ok(narrative.shots.some(scene => foldName(scene.where) === foldName(place)), `${language} ${narrative.shots.map(scene => scene.where).join(' > ')}`)
    const detected = detectProse(text)
    if (detected.language === language || language === 'en' || language === 'fr') {
      assert.equal(detected.characters.some(item => foldName(item.name) === foldName(person)), false, `${language} character ${person} in ${detected.characters.map(item => item.name).join(',')}`)
      assert.ok(detected.places.some(item => foldName(item.name) === foldName(place)), `${language} places ${detected.places.map(item => item.name).join(', ')}`)
    }
  }
})

test('an uncertain toward-cue does not leave a firm cut from that place', () => {
  const french = "Hélène lit dans le jardin. Elle marche vers la gare. Plus tard, dans la boulangerie, Hélène entre."
  const english = 'Bridget reads in the garden. She walks toward the station. Later, in the bakery, Bridget opens the door.'
  for (const [text, from, toward, next] of [[french, 'jardin', 'gare', 'boulangerie'], [english, 'garden', 'station', 'bakery']]) {
    const detected = detectProse(text)
    const wheres = detected.scenes.map(scene => foldName(scene.where))
    assert.equal(wheres.includes(toward), false, wheres.join(' > '))
    assert.ok(wheres.includes(from) && wheres.includes(next), wheres.join(' > '))
    const uncertain = (detected.cuts || []).filter(cut => cut.uncertain)
    assert.ok(uncertain.length >= 1)
    assert.match(uncertain.map(cut => cut.cue).join(' '), new RegExp(toward, 'i'))
    const firm = []
    let previous = ''
    detected.scenes.forEach(scene => {
      const place = foldName(scene.where)
      if (!place || place === previous) return
      if (!scene.cutUncertain) firm.push(place)
      previous = place
    })
    assert.equal(firm.includes(toward), false, firm.join(' > '))
    assert.ok(firm.includes(next))
  }
})

test('a newer firm place wins over a place that was only remembered', () => {
  const french = "Nora lit dans la cuisine. Nora repense au phare. Ensuite, toujours dans la cuisine, Nora range les tasses."
  const english = 'Owen reads in the office. Owen recalls the harbour. Two hours later, still in the office, Owen eats a pear. At dusk, on the bridge, Owen waves.'
  const frenchPlaces = splitNarrative(french, {
    language: 'fr',
    places: [{ name: 'Cuisine', keys: ['cuisine'] }, { name: 'Phare', keys: ['phare'] }]
  }).shots.map(shot => shot.where)
  assert.equal(frenchPlaces.includes('Phare'), false, frenchPlaces.join(' > '))
  assert.ok(frenchPlaces.includes('Cuisine'), frenchPlaces.join(' > '))
  const englishPlaces = splitNarrative(english, {
    language: 'en',
    places: [{ name: 'Office', keys: ['office'] }, { name: 'Harbour', keys: ['harbour'] }, { name: 'Bridge', keys: ['bridge'] }]
  }).shots.map(shot => shot.where)
  assert.equal(englishPlaces.includes('Harbour'), false, englishPlaces.join(' > '))
  assert.deepEqual([...new Set(englishPlaces)], ['Office', 'Bridge'])
})

test('a sentence with a place or no known verb is still a shot', () => {
  const narrative = splitNarrative('Nora reads in the kitchen. The curtains barely move. Still in the kitchen, the rain ticks on the glass.', {
    language: 'en',
    places: [{ name: 'Kitchen', keys: ['kitchen'] }]
  })
  const texts = narrative.shots.map(shot => shot.what)
  assert.ok(texts.some(text => /curtains barely move/i.test(text)), texts.join(' | '))
  assert.ok(texts.some(text => /rain ticks/i.test(text)), texts.join(' | '))
  assert.ok(narrative.shots.every(shot => shot.where === 'Kitchen'), narrative.shots.map(shot => shot.where).join(' > '))
  const cueOnly = splitNarrative('Maya reads in the kitchen. The next day. Then Maya pours water.', {
    language: 'en',
    places: [{ name: 'Kitchen', keys: ['kitchen'] }]
  })
  assert.equal(cueOnly.shots.some(shot => foldName(shot.what) === 'the next day'), false)
})

test('a door is not a costume line, and a wear verb still is', () => {
  assert.equal(isCastLine("À midi, dans l'atelier, Elise ouvre la porte avec une clé de laiton."), false)
  assert.equal(isCastLine('At noon, in the workshop, Elise opens the door with a brass key.'), false)
  assert.equal(isCastLine('Elise, la trentaine, cheveux courts, porte un manteau de laine.'), true)
  assert.equal(isCastLine('Elise, thirty, short dark hair, wears a wool coat.'), true)
  const french = detectProse("À midi, dans l'atelier, Elise ouvre la porte avec une clé de laiton.")
  assert.ok(french.scenes.some(scene => foldName(scene.where) === 'atelier'), french.scenes.map(scene => scene.where).join(' > '))
  const english = detectProse('At noon, in the workshop, Elise opens the door with a brass key.')
  assert.ok(english.scenes.some(scene => foldName(scene.where) === 'workshop'), english.scenes.map(scene => scene.where).join(' > '))
})

test('regular verb endings count without listing each form', () => {
  assert.equal(matchesVerb('eats', new Set(['eat'])), true)
  assert.equal(matchesVerb('buys', new Set(['buy'])), true)
  assert.equal(matchesVerb('eating', new Set(['eat'])), true)
  assert.equal(matchesVerb('lancent', new Set(['lance'])), true)
  assert.equal(matchesVerb('souleve', new Set(['soulever'])), true)
  assert.equal(matchesVerb('decouvrent', new Set(['decouvrir'])), true)
  assert.equal(matchesVerb('enfile', new Set(['enfilent'])), true)
  assert.equal(matchesVerb('table', new Set(['pose', 'ouvre', 'lance'])), false)
  const narrative = splitNarrative('Les enfants lancent le ballon dans le parc. Lina soulève la caisse.', {
    language: 'fr',
    places: [{ name: 'Parc', keys: ['parc'] }],
    verbs: ['lance']
  })
  assert.equal(narrative.shots.length >= 2, true, narrative.shots.map(shot => shot.what).join(' | '))
  assert.ok(narrative.shots.some(shot => /lancent/i.test(shot.what)))
  assert.ok(narrative.shots.some(shot => /soulève/i.test(shot.what)))
})

test('place aliases that differ only by an article are the same place', () => {
  const story = { gold_places: [{ name: 'Brasserie', aliases: ['brasserie Le Cormoran'] }] }
  assert.equal(canonicalPlace('Brasserie Cormoran', story), 'Brasserie')
  assert.equal(canonicalPlace('The Cormoran Brasserie', story), '')
  const swapped = { gold_places: [{ name: 'Brasserie', aliases: ['the cormoran brasserie'] }] }
  assert.equal(canonicalPlace('Cormoran Brasserie', swapped), 'Brasserie')
  const found = namedVenues("Dans la brasserie Le Cormoran, Nora s'assoit.", 'fr')
  assert.ok(found.some(item => item.name === 'Brasserie Le Cormoran'), found.map(item => item.name).join(', '))
})

test('an article inside a venue name is not a later place cue', () => {
  for (const word of ['the', 'le', 'la', 'les', 'der', 'die', 'das', 'el', 'o', 'il']) {
    assert.equal(isCueStopword(word), true, word)
  }
  assert.equal(isCueStopword('kestrel'), false)
  const english = 'Nora reads in the office. After that, in the gallery The Kestrel, Nora hangs one sketch. Then, in the office, Nora opens the drawer. Eight cups stand in the window. At dusk, on the beach, Nora watches the gulls.'
  const detected = detectProse(english)
  const wheres = detected.scenes.map(scene => scene.where)
  assert.ok(wheres.some(place => /kestrel/i.test(place)), wheres.join(' > '))
  assert.equal(wheres.filter(place => /kestrel/i.test(place)).length, wheres.filter((place, index) => /kestrel/i.test(place) && !/kestrel/i.test(wheres[index - 1] || '')).length, wheres.join(' > '))
  const sequence = []
  wheres.forEach(place => { if (sequence[sequence.length - 1] !== place) sequence.push(place) })
  assert.deepEqual(sequence.map(place => foldName(place)), ['office', 'gallery the kestrel', 'office', 'beach'])
  const forced = findPlaceCue('At noon, in the office, Nora opens the door.', 'en', [
    { name: 'Gallery The Kestrel', keys: ['Gallery The Kestrel', 'The', 'Kestrel'] },
    { name: 'Office', keys: ['office'] }
  ])
  assert.equal(forced.name, 'Office')
  const french = "Nora lit dans le bureau. Ensuite, dans la brasserie Les Tilleuls, Nora commande un thé. Puis, dans le bureau, Nora range les carnets dans les tiroirs."
  const frenchPlaces = detectProse(french).scenes.map(scene => scene.where)
  const frenchSequence = []
  frenchPlaces.forEach(place => { if (frenchSequence[frenchSequence.length - 1] !== place) frenchSequence.push(place) })
  assert.deepEqual(frenchSequence.map(foldName), ['bureau', 'brasserie les tilleuls', 'bureau'])
  const spanishArticle = splitNarrative('Nora reads in the office. After that, in the hotel El Nido, Nora hangs a key. Then, in the office, Nora opens the drawer.', {
    language: 'en',
    places: [
      { name: 'Office', keys: ['office'] },
      { name: 'Hotel El Nido', keys: ['Hotel El Nido', 'El', 'Nido'] }
    ]
  })
  const elSequence = []
  spanishArticle.shots.forEach(shot => { if (elSequence[elSequence.length - 1] !== shot.where) elSequence.push(shot.where) })
  assert.deepEqual(elSequence, ['Office', 'Hotel El Nido', 'Office'])
})

test('a place named only inside quotes is not added to the sheet', () => {
  const detected = detectProse('Nora reads in the kitchen. She says, "Let us walk on the quay on Sunday." Then Nora pours tea in the kitchen.')
  assert.equal(detected.places.some(place => foldName(place.name) === 'quay'), false, detected.places.map(place => place.name).join(', '))
  assert.ok(detected.scenes.every(scene => foldName(scene.where) === 'kitchen'), detected.scenes.map(scene => scene.where).join(' > '))
  const venue = detectProse('Nora reads in the office. She says, "Meet me at the gallery The Kestrel." Then Nora closes the ledger in the office.')
  assert.equal(venue.places.some(place => /kestrel/i.test(place.name)), false, venue.places.map(place => place.name).join(', '))
  assert.ok(venue.scenes.every(scene => foldName(scene.where) === 'office'), venue.scenes.map(scene => scene.where).join(' > '))
})
