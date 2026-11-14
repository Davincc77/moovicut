import test from 'node:test'
import assert from 'node:assert/strict'
import { applyStylePreset, createStoryboard, mergeDetectedSheet, retargetMode } from '../app/utils/prompt-engine.js'
import { detectProse } from '../app/utils/prose-detect.js'
import { exportAgentBoard, importAgentBoard } from '../app/utils/agent-board.js'
import { exportLibrary, importLibrary, saveCharacter, savePlace, saveStyle } from '../app/utils/library.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const premise = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'
const english = `Lea, a young woman with curly red hair, round glasses and a green apron, opens the cafe at dawn.
She pours a latte and laughs.
Later, Lea walks on the beach. The next morning she returns to the cafe.`

test('switching modes keeps the film sheet and a hand-edited prompt', () => {
  const board = createStoryboard({
    premise,
    sequenceMode: 'scenario',
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small morning cafe' }],
      scenes: [
        { who: 'Léa', where: 'Café', what: 'She pours a latte', duration: 3 },
        { who: 'Léa', where: 'Café', what: 'She laughs', duration: 3 }
      ]
    }
  })
  board.shots[1].prompt = 'KEEP THIS LINE'
  board.shots[1].promptEdited = true
  const next = retargetMode(board, 'continuous')
  assert.equal(next.sequenceMode, 'continuous')
  assert.equal(next.filmSheet.characters[0].name, 'Léa')
  assert.equal(next.filmSheet.places[0].name, 'Café')
  assert.equal(next.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(next.shots[1].promptEdited, true)
  const varied = retargetMode(next, 'varied')
  assert.equal(varied.filmSheet.characters[0].outfit, 'green apron')
  assert.equal(varied.shots[1].prompt, 'KEEP THIS LINE')
  assert.doesNotMatch(varied.shots[0].prompt, /CONTINUITY SHEET/)
  assert.match(varied.shots[0].prompt, /FILM SHEET/)
})

test('a style preset applies in continuous mode and skips an edited prompt', () => {
  const board = createStoryboard({ premise, sequenceMode: 'continuous' })
  board.shots[1].prompt = 'KEEP THIS LINE'
  board.shots[1].promptEdited = true
  const next = applyStylePreset(board, 'documentary', 'portrait')
  assert.equal(next.preset.family, 'documentary')
  assert.equal(next.shots[1].prompt, 'KEEP THIS LINE')
  assert.match(next.shots[0].prompt, /STYLE PRESET/)
  assert.match(next.shots[0].prompt, /Voice-over/)
})

test('the personal library stays on device and round-trips as a file', () => {
  let library = saveCharacter(null, { name: 'Léa', look: 'curly hair', outfit: 'green apron' })
  library = savePlace(library, { name: 'Café', description: 'a small morning cafe' })
  library = saveStyle(library, { family: 'cinema', genre: 'drama', label: 'cinema / drama' })
  library = saveCharacter(library, { name: 'Léa', look: 'silver bob', outfit: 'green apron' })
  const file = exportLibrary(library)
  const restored = importLibrary(file)
  assert.equal(restored.schema, 'shotboard.library.v1')
  assert.equal(restored.characters.length, 1)
  assert.equal(restored.characters[0].look, 'silver bob')
  assert.equal(restored.places[0].name, 'Café')
  assert.equal(restored.styles[0].genre, 'drama')
  assert.throws(() => importLibrary('{"schema":"other"}'), /Moovicut library/)
})

test('a quick idea pre-fills the film sheet and a lock keeps the cast', () => {
  const board = createStoryboard({ premise: english, sequenceMode: 'varied' })
  assert.ok(board.filmSheet.characters.some(item => item.name === 'Lea'))
  assert.match(board.filmSheet.characters.find(item => item.name === 'Lea').look, /curly red hair/)
  assert.ok(board.filmSheet.places.some(item => item.name === 'Cafe'))
  assert.equal(board.detection.language, 'en')
  const locked = { characters: [{ name: 'KEEP', look: 'own look', outfit: 'own coat' }], places: [], light: '', mood: '', style: '' }
  mergeDetectedSheet(locked, detectProse(english), { characters: true })
  assert.equal(locked.characters.length, 1)
  assert.equal(locked.characters[0].name, 'KEEP')
  assert.ok(locked.places.some(item => item.name === 'Cafe'))
})

test('one compact agent board resumes every mode', async () => {
  const continuous = createStoryboard({ premise, sequenceMode: 'continuous', count: 3 })
  continuous.shots[0].prompt = 'KEEP THIS LINE'
  continuous.shots[0].promptEdited = true
  const exported = exportAgentBoard(continuous)
  assert.equal(exported.schema, 'shotboard.compact.v1')
  assert.equal(exported.mode, 'continuous')
  assert.equal(exported.shots[0].promptEdited, true)
  const resumed = importAgentBoard(exported)
  assert.equal(resumed.shots[0].prompt, 'KEEP THIS LINE')
  assert.equal(resumed.filmSheet.characters[0].name, continuous.filmSheet.characters[0].name)
  const response = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, compact: true })
  })
  const compact = JSON.parse(response.body)
  assert.deepEqual(Object.keys(compact).sort(), ['aspectRatio', 'model', 'premise', 'shots', 'studioUrl', 'title'])
  const agent = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ premise, format: 'agent' })
  })
  const board = JSON.parse(agent.body)
  assert.equal(agent.status, 200)
  assert.equal(board.schema, 'shotboard.compact.v1')
  assert.ok(board.filmSheet.characters.length >= 1)
  const again = await dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(board)
  })
  const round = JSON.parse(again.body)
  assert.equal(again.status, 200)
  assert.equal(round.shots.length, board.shots.length)
  assert.equal(round.filmSheet.characters[0].name, board.filmSheet.characters[0].name)
})
