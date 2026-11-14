import test from 'node:test'
import assert from 'node:assert/strict'
import { ref, computed } from 'vue'
import { applyModelProfile, applyStylePreset, createStoryboard, refreshProjectPrompts, regenerateOneShot, retargetMode, SHORT_PROMPT_MAX } from '../app/utils/prompt-engine.js'
import { exportAgentBoard, importAgentBoard } from '../app/utils/agent-board.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { useProjectStore } from '../app/composables/useProjectStore.js'

const lighthouse = 'A lighthouse keeper races the dusk to repair a failing beacon before a fishing boat reaches the rocks.'
const starMap = 'An apprentice astronaut guides a damaged capsule home using only a paper star map.'
const lastLoaf = 'A night baker finds an unsigned note and delivers one last loaf before sunrise.'

function storeFixture() {
  const states = new Map()
  const data = new Map()
  globalThis.localStorage = { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }
  globalThis.useState = (key, init) => { if (!states.has(key)) states.set(key, ref(init())); return states.get(key) }
  globalThis.ref = ref
  globalThis.computed = computed
  globalThis.useNotifier = () => ({ notify: () => {} })
  globalThis.useHead = () => {}
  const store = useProjectStore()
  store.hydrate()
  return store
}

test('the default video prompt is short, ordered, and capped', () => {
  const board = createStoryboard({ premise: lighthouse, style: 'cinema', genre: 'drama', sequenceMode: 'continuous' })
  const detailed = createStoryboard({ premise: lighthouse, style: 'cinema', genre: 'drama', sequenceMode: 'continuous', promptStyle: 'detailed' })
  assert.equal(board.promptStyle, 'short')
  assert.equal(board.filmSheet.characters[0].name, 'Lighthouse keeper')
  assert.equal(detailed.filmSheet.characters[0].name, board.filmSheet.characters[0].name)
  board.shots.forEach(shot => {
    assert.ok(shot.prompt.length <= SHORT_PROMPT_MAX, shot.prompt.length)
    assert.ok(shot.prompt.length >= 250)
    assert.doesNotMatch(shot.prompt, /FILM SHEET|CONTINUITY SHEET|STYLE PRESET|Style lock:|Repeat this continuity sheet/)
    const styleAt = shot.prompt.indexOf('Style:')
    const nameAt = shot.prompt.indexOf('Lighthouse keeper')
    const placeAt = shot.prompt.indexOf('Place:')
    const actionAt = shot.prompt.indexOf('Action:')
    const cameraAt = shot.prompt.indexOf('Camera:')
    assert.ok(styleAt >= 0 && styleAt < nameAt && nameAt < placeAt && placeAt < actionAt && actionAt < cameraAt)
    assert.match(shot.prompt, /wool jacket/)
    assert.match(shot.prompt, /3 seconds/)
  })
  assert.ok(board.shots[0].prompt.length >= 400 && board.shots[0].prompt.length <= 600)
  assert.ok(board.shots[0].prompt.length < detailed.shots[0].prompt.length / 2)
  assert.match(detailed.shots[0].prompt, /FILM SHEET/)
  assert.match(detailed.shots[0].prompt, /CONTINUITY SHEET/)
  assert.match(detailed.shots[0].prompt, /Style lock:/)
})

test('the three studio starters stay in the short range', () => {
  const lastLight = createStoryboard({ premise: lighthouse, style: 'cinema', genre: 'drama', sequenceMode: 'continuous' })
  const loaf = createStoryboard({ premise: lastLoaf, style: 'cinema', genre: 'drama', sequenceMode: 'continuous' })
  const orbit = createStoryboard({ premise: starMap, style: 'cinema', genre: 'drama', sequenceMode: 'continuous' })
  for (const board of [lastLight, loaf, orbit]) {
    board.shots.forEach(shot => assert.ok(shot.prompt.length <= SHORT_PROMPT_MAX))
    assert.ok(board.shots[0].prompt.length < 700)
  }
  assert.ok(lastLight.shots[0].prompt.length >= 400 && lastLight.shots[0].prompt.length <= 600)
  assert.ok(loaf.shots[0].prompt.length >= 400 && loaf.shots[0].prompt.length <= 600)
  assert.match(orbit.shots[0].prompt, /worn flight suit/)
  assert.doesNotMatch(orbit.shots[0].prompt, /scuffed boots, scuffed boots/)
  assert.match(lastLight.shots[0].prompt, /realistic photographic cinema/)
})

test('a short prompt names only the people in that shot, plus a not-yet line', () => {
  const board = createStoryboard({
    style: 'cinema',
    genre: 'drama',
    scenario: {
      characters: [
        { name: 'Léa', look: 'curly hair, round glasses', outfit: 'green apron' },
        { name: 'Marc', look: 'short dark hair', outfit: 'grey cap' }
      ],
      places: [
        { name: 'Café', description: 'a small morning cafe' },
        { name: 'Forêt', description: 'a quiet forest path' }
      ],
      scenes: [
        { who: 'Léa', where: 'Café', what: 'She pours a latte', duration: 4 },
        { who: 'Léa and Marc', where: 'Forêt', what: 'She hands him a warm pastry', duration: 4 }
      ]
    }
  })
  assert.match(board.shots[0].prompt, /Léa — curly hair, round glasses, green apron/)
  assert.doesNotMatch(board.shots[0].prompt, /grey cap|short dark hair/)
  assert.match(board.shots[0].prompt, /Marc is not yet in frame/)
  assert.match(board.shots[0].prompt, /Café, a small morning cafe/)
  assert.match(board.shots[1].prompt, /grey cap/)
  assert.match(board.shots[1].prompt, /green apron/)
  assert.doesNotMatch(board.shots[1].prompt, /not yet in frame/)
  assert.equal(board.filmSheet.characters.length, 2)
  const later = createStoryboard({
    premise: 'A quiet morning in the old town with a full cast.',
    scenario: {
      characters: [
        { name: 'Léa', look: 'curly hair', outfit: 'green apron' },
        { name: 'Marc', look: 'short hair', outfit: 'grey cap' },
        { name: 'Noor', look: 'black bob', outfit: 'blue coat' },
        { name: 'Idris', look: 'grey beard', outfit: 'brown jacket' }
      ],
      places: [{ name: 'Café', description: 'a small morning cafe' }],
      scenes: [
        { who: 'Léa', where: 'Café', what: 'She opens the door' },
        { who: 'Marc', where: 'Café', what: 'He waves' },
        { who: 'Noor', where: 'Café', what: 'She sits' },
        { who: 'Idris', where: 'Café', what: 'He reads' }
      ]
    }
  })
  assert.doesNotMatch(later.shots[0].prompt, /Marc is not yet|Noor is not yet|Idris is not yet/)
  assert.doesNotMatch(later.shots[0].prompt, /grey cap|black bob|grey beard/)
})

test('hands and a hand-off add one stability line and a risk note', () => {
  const board = createStoryboard({
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small morning cafe' }],
      scenes: [
        { who: 'Léa', where: 'Café', what: 'She looks across the room' },
        { who: 'Léa', where: 'Café', what: 'She pours a latte' },
        { who: 'Léa', where: 'Café', what: 'She hands him a warm pastry' }
      ]
    }
  })
  assert.doesNotMatch(board.shots[0].prompt, /Simple hands/)
  assert.match(board.shots[1].prompt, /Simple hands, the held object stays the same shape/)
  assert.match(board.shots[2].prompt, /Simple hands, the held object stays the same shape/)
  const codes = assessProject(board).filter(item => item.code === 'hands_or_held_object').map(item => item.order)
  assert.deepEqual(codes, [2, 3])
  const calm = createStoryboard({ premise: lighthouse })
  assert.equal(assessProject(calm).some(item => item.code === 'hands_or_held_object'), false)
  const lantern = createStoryboard({
    premise: lighthouse,
    scenes: [{ action: 'The keeper shoulders the lantern.', duration: 4, framing: 'Close-up', camera: 'Handheld' }]
  })
  assert.match(lantern.shots[0].prompt, /Simple hands, the held object stays the same shape/)
  assert.ok(assessProject(lantern).some(item => item.code === 'hands_or_held_object'))
  assert.ok(lantern.shots[0].prompt.length <= SHORT_PROMPT_MAX)
})

test('detailed mode keeps today\'s long prompt and a hand edit survives both modes', () => {
  const board = createStoryboard({ premise: lighthouse, sequenceMode: 'continuous', count: 3, promptStyle: 'detailed' })
  assert.match(board.shots[0].prompt, /CONTINUITY SHEET/)
  assert.match(board.shots[0].prompt, /Style lock:/)
  board.shots[1].prompt = 'KEEP THIS LINE'
  board.shots[1].promptEdited = true
  board.promptStyle = 'short'
  const shortened = refreshProjectPrompts(board)
  assert.equal(shortened.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(shortened.shots[1].promptEdited, true)
  assert.doesNotMatch(shortened.shots[0].prompt, /CONTINUITY SHEET/)
  const varied = retargetMode(shortened, 'varied')
  assert.equal(varied.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(varied.filmSheet.characters[0].name, 'Lighthouse keeper')
  const styled = applyStylePreset(varied, 'documentary', 'portrait')
  assert.equal(styled.shots[1].prompt, 'KEEP THIS LINE')
  assert.match(styled.shots[0].prompt, /observational documentary/)
  assert.doesNotMatch(styled.shots[0].prompt, /STYLE PRESET/)
  const skipped = regenerateOneShot(styled, styled.shots[1].id)
  assert.equal(skipped.skipped, true)
  assert.equal(skipped.project.shots[1].prompt, 'KEEP THIS LINE')
  styled.shots[0].action = 'The keeper looks out to sea.'
  const rebuilt = regenerateOneShot(styled, styled.shots[0].id, { overwrite: true })
  assert.equal(rebuilt.project.shots[1].prompt, 'KEEP THIS LINE')
  assert.match(rebuilt.project.shots[0].prompt, /looks out to sea/)
  const moved = applyModelProfile(rebuilt.project, 'google')
  assert.equal(moved.shots[1].prompt, 'KEEP THIS LINE')
  const agent = exportAgentBoard(moved)
  assert.equal(agent.schema, 'shotboard.compact.v1')
  assert.equal(agent.promptStyle, 'short')
  assert.equal(agent.filmSheet.characters[0].name, 'Lighthouse keeper')
  assert.equal(agent.shots[1].prompt, 'KEEP THIS LINE')
  const resumed = importAgentBoard(agent)
  assert.equal(resumed.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(resumed.shots[1].promptEdited, true)
})

test('prompt_style is accepted on the API and an unknown value is 400', () => {
  const premise = 'A lighthouse keeper races the dusk to repair a failing beacon.'
  const short = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ premise, prompt_style: 'short', compact: true })
  })
  assert.equal(short.status, 200)
  const shortBody = JSON.parse(short.body)
  assert.match(shortBody.shots[0].prompt, /^Style: /)
  assert.doesNotMatch(shortBody.shots[0].prompt, /FILM SHEET/)
  assert.ok(shortBody.shots[0].prompt.length <= SHORT_PROMPT_MAX)
  const detailed = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ premise, promptStyle: 'detailed', sequenceMode: 'continuous', compact: true })
  })
  const detailedBody = JSON.parse(detailed.body)
  assert.match(detailedBody.shots[0].prompt, /CONTINUITY SHEET/)
  const rejected = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ premise, prompt_style: 'verbose' })
  })
  assert.equal(rejected.status, 400)
  assert.match(rejected.body, /short/)
  assert.match(rejected.body, /detailed/)
  const document = dispatchAgentRequest({ method: 'GET', pathname: '/openapi.json' })
  const spec = JSON.parse(document.body)
  assert.deepEqual(spec.components.schemas.StoryboardRequest.properties.prompt_style.enum, ['short', 'detailed'])
})

test('switching the studio prompt style leaves a hand-edited prompt, and undo restores it', () => {
  const store = storeFixture()
  store.createNew(lighthouse, 'grok')
  const id = store.project.value.shots[0].id
  const other = store.project.value.shots[1].prompt
  store.updateShotFields(id, { prompt: 'HAND LINE' })
  store.applyPromptSettings({ promptStyle: 'detailed' })
  assert.equal(store.project.value.promptStyle, 'detailed')
  assert.equal(store.project.value.shots[0].prompt, 'HAND LINE')
  assert.equal(store.project.value.shots[0].promptEdited, true)
  assert.match(store.project.value.shots[1].prompt, /Style lock:/)
  assert.notEqual(store.project.value.shots[1].prompt, other)
  store.regenerateOne(id)
  assert.equal(store.project.value.shots[0].prompt, 'HAND LINE')
  store.resetShotPrompt(id)
  assert.notEqual(store.project.value.shots[0].prompt, 'HAND LINE')
  assert.equal(store.promptUndo.prompt, 'HAND LINE')
  store.restorePromptUndo()
  assert.equal(store.project.value.shots[0].prompt, 'HAND LINE')
  assert.equal(store.project.value.shots[0].promptEdited, true)
})
