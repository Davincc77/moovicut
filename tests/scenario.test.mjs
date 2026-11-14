import test from 'node:test'
import assert from 'node:assert/strict'
import { applyStylePreset, createStoryboard, refreshProjectPrompts, resolveScenarioPreset } from '../app/utils/prompt-engine.js'
import { agentScenarioPrompt, packSequences, parseScenario } from '../app/utils/scenario.js'
import { applyDetection, applyWarningChoice, detectProse } from '../app/utils/prose-detect.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const text = `CHARACTERS
Léa — curly hair, round glasses — green apron
Marc — short dark hair — grey cap

PLACES
Café — a small morning cafe
Forêt — a quiet forest path

STYLE
light: dawn
mood: playful

SCENES
Scène 1 — Léa — Café — She pours a latte
Scène 2 — Léa — Café — She spills the latte and laughs
Scène 3 — Léa and Marc — Forêt — They walk under the trees`

test('scenario text collects every missing field in one response', () => {
  const parsed = parseScenario('CHARACTERS\nLéa — curly hair\n\nPLACES\nCafé\n\nSCENES\nScène 1 — Léa — — She laughs')
  assert.equal(parsed.ok, false)
  const messages = parsed.errors.map(error => error.message).join('\n')
  assert.match(messages, /missing an outfit/)
  assert.match(messages, /missing a description/)
  assert.match(messages, /missing where|missing a place|where/i)
  assert.ok(parsed.errors.length >= 3)
})

test('scenario JSON accepts short fields and rejects a bad camera with the allowed list', () => {
  const good = parseScenario({
    characters: [{ n: 'Léa', l: 'curly hair', o: 'green apron' }],
    places: [{ n: 'Café', d: 'a small cafe' }],
    scenes: [{ w: 'Léa', at: 'Café', do: 'She pours a latte', cam: 'close', s: 4 }]
  })
  assert.equal(good.ok, true)
  assert.equal(good.scenes[0].camera, 'close')
  assert.equal(good.scenes[0].duration, 4)
  const bad = parseScenario({
    characters: [{ name: 'Léa', look: 'curly hair', outfit: 'apron' }],
    places: [{ name: 'Café', description: 'a cafe' }],
    light: 'noon',
    scenes: [{ who: 'Léa', where: 'Café', what: 'She pours a latte', camera: 'zoom' }]
  })
  assert.equal(bad.ok, false)
  const joined = bad.errors.map(error => error.message).join('\n')
  assert.match(joined, /light must be one of/)
  assert.match(joined, /camera must be one of/)
  assert.match(joined, /wide, medium, close/)
  assert.match(joined, /day, dawn, dusk/)
})

test('a scenario board resolves names once and packs 15–60s sequences', () => {
  const board = createStoryboard({ premise: text, style: 'anime', genre: 'shojo' })
  assert.equal(board.sequenceMode, 'scenario')
  assert.equal(board.shots.length, 3)
  assert.equal(board.preset.family, 'anime')
  assert.equal(board.preset.genre, 'shojo')
  assert.match(board.shots[0].prompt, /STYLE PRESET/)
  assert.match(board.shots[0].prompt, /signature hair/)
  assert.match(board.shots[0].prompt, /green apron/)
  assert.match(board.shots[2].prompt, /grey cap/)
  assert.match(board.shots[2].prompt, /quiet forest path/)
  assert.equal(board.shots.filter(shot => shot.prompt.includes('STYLE PRESET')).length, 3)
  assert.ok(board.sequences.length >= 1)
  assert.ok(board.sequences[0].duration <= 60)
  const packs = packSequences(Array.from({ length: 22 }, () => ({ duration: 3 })))
  assert.ok(packs.every(pack => pack.duration <= 60))
  assert.ok(packs.at(-1).duration >= 15)
})

test('an unknown preset lists the allowed genres in one error', () => {
  assert.throws(() => resolveScenarioPreset({ style: 'anime', genre: 'scifi' }), error => {
    assert.equal(error.status, 400)
    assert.ok(error.errors.length >= 1)
    assert.match(error.errors.map(item => item.message).join(' '), /shonen/)
    return true
  })
  assert.equal(resolveScenarioPreset({}).family, 'cinema')
  assert.equal(resolveScenarioPreset({}).genre, 'drama')
  assert.equal(resolveScenarioPreset({ genre: 'noir' }).genre, 'noir')
})

test('a hand-edited prompt survives preset changes and regeneration', () => {
  const board = createStoryboard({ scenario: text, style: 'cinema', genre: 'drama' })
  board.shots[1].prompt = 'KEEP THIS LINE'
  board.shots[1].promptEdited = true
  const changed = applyStylePreset(board, 'documentary', 'portrait')
  assert.equal(changed.shots[1].prompt, 'KEEP THIS LINE')
  assert.match(changed.shots[0].prompt, /Voice-over/)
  assert.match(changed.shots[0].prompt, /observational documentary/)
  assert.doesNotMatch(changed.shots[0].prompt, /signature hair/)
  assert.match(changed.shots[2].prompt, /Voice-over/)
  const again = refreshProjectPrompts(changed)
  assert.equal(again.shots[1].prompt, 'KEEP THIS LINE')
  assert.notEqual(again.shots[0].prompt, 'KEEP THIS LINE')
})

test('the agent prompt includes the French example line', () => {
  const prompt = agentScenarioPrompt('A cafe at dawn')
  assert.match(prompt, /Scène 3 — Léa — Café — Elle renverse son latte et rit\./)
  assert.match(prompt, /My idea:\nA cafe at dawn/)
})

const french = `Léa a les cheveux bouclés, des lunettes rondes et un tablier vert. Elle entre au café au petit matin.
Elle verse un latte, puis elle renverse son latte et rit.
Plus tard, Léa marche dans la forêt avec Marc. Marc porte une casquette grise.
Le lendemain, Lea revient au café.`

const english = `Lea, a young woman with curly red hair, round glasses and a green apron, opens the cafe at dawn.
She pours a latte and laughs.
Later, Lea walks on the beach. The next morning she returns to the cafe.`

test('French prose merges Léa and Lea and does not treat morning as a place', () => {
  const detected = detectProse(french)
  assert.equal(detected.language, 'fr')
  const names = detected.characters.map(item => item.name)
  assert.equal(names.filter(name => name === 'Léa' || name === 'Lea').length, 1)
  assert.ok(detected.characters.some(item => item.name === 'Marc'))
  assert.ok(detected.warnings.some(item => item.code === 'name_variant'))
  assert.ok(detected.places.some(item => item.name === 'Café'))
  assert.ok(detected.places.some(item => item.name === 'Forêt'))
  assert.equal(detected.places.some(item => /matin/i.test(item.name)), false)
  assert.equal(detected.light, 'dawn')
  assert.equal(detected.mood, 'playful')
  assert.ok(detected.scenes.length >= 4)
  assert.equal(detected.scenes.some(scene => /cheveux bouclés/i.test(scene.what)), false)
})

test('English prose keeps The and Morning out of the cast', () => {
  const detected = detectProse(english)
  assert.equal(detected.language, 'en')
  assert.equal(detected.characters.length, 1)
  assert.match(detected.characters[0].look, /curly red hair/)
  assert.match(detected.characters[0].outfit, /apron/)
  assert.ok(detected.places.some(item => item.name === 'Cafe'))
  assert.ok(detected.places.some(item => item.name === 'Beach'))
  assert.equal(detected.characters.some(item => item.name === 'The' || item.name === 'Morning'), false)
  const tricky = detectProse('The morning light hits the street. A bird flies over the city.')
  assert.equal(tricky.characters.length, 0)
  assert.ok(tricky.warnings.some(item => item.code === 'missing_character'))
  const locked = applyDetection({ characters: 'KEEP', places: '', scenes: '', light: '', mood: '' }, detected, { characters: true })
  assert.equal(locked.characters, 'KEEP')
  assert.match(locked.places, /Cafe/)
})

test('confirming a name variant rewrites the draft and locks survive a second pass', () => {
  const detected = detectProse(french)
  const warning = detected.warnings.find(item => item.code === 'name_variant')
  const fields = applyWarningChoice({
    characters: detected.scenario.characters.map(item => item.name).join('\n'),
    places: '',
    scenes: detected.scenes.map(scene => scene.who).join('\n')
  }, warning, 'Léa')
  assert.match(fields.characters, /Léa/)
  assert.doesNotMatch(fields.characters, /\bLea\b/)
  assert.match(fields.scenes, /Léa/)
})

test('the API accepts scenario JSON, prose, and keeps a supplied prompt', () => {
  const scenario = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({
      premise: 'A short cafe story for the board.',
      scenario: {
        characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
        places: [{ name: 'Café', description: 'a small cafe' }],
        scenes: [
          { who: 'Léa', where: 'Café', what: 'She pours a latte', camera: 'zoom' },
          { who: 'Léa', where: 'Café', what: 'She laughs', prompt: 'HAND WRITTEN' }
        ]
      },
      style: 'anime',
      genre: 'slice-of-life',
      compact: true
    })
  })
  assert.equal(scenario.status, 400)
  const problems = JSON.parse(scenario.body)
  assert.ok(problems.errors.length >= 1)
  assert.match(problems.errors.map(item => item.message).join(' '), /camera must be one of/)

  const ok = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({
      premise: 'A short cafe story for the board.',
      scenario: {
        characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
        places: [{ name: 'Café', description: 'a small cafe' }],
        scenes: [
          { who: 'Léa', where: 'Café', what: 'She pours a latte' },
          { who: 'Léa', where: 'Café', what: 'She laughs', prompt: 'HAND WRITTEN' }
        ]
      },
      style: 'anime',
      genre: 'slice-of-life',
      compact: true
    })
  })
  assert.equal(ok.status, 200)
  const board = JSON.parse(ok.body)
  assert.equal(board.preset.style, 'anime')
  assert.equal(board.preset.genre, 'slice-of-life')
  assert.equal(board.shots[1].prompt, 'HAND WRITTEN')
  assert.match(board.shots[0].prompt, /green apron/)
  assert.ok(board.sequences.length >= 1)

  const prose = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ input: 'prose', prose: english, compact: true })
  })
  assert.equal(prose.status, 200)
  const detected = JSON.parse(prose.body)
  assert.equal(detected.input, 'prose')
  assert.equal(detected.language, 'en')
  assert.ok(Array.isArray(detected.warnings))

  const ordinary = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.', compact: true })
  })
  const plain = JSON.parse(ordinary.body)
  assert.deepEqual(Object.keys(plain).sort(), ['aspectRatio', 'model', 'premise', 'shots', 'studioUrl', 'title'])
  assert.equal(plain.shots.length, 5)
})
