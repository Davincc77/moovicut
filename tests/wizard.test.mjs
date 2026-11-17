import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createStoryboard, refreshShotPrompt } from '../app/utils/prompt-engine.js'
import { termById } from '../app/utils/framing.js'
import { wizardText } from '../app/utils/wizard-strings.js'
import {
  blankWizard,
  setIdea,
  setModel,
  setPromptStyle,
  setAspect,
  setStyle,
  setGenre,
  setLight,
  setMood,
  setCharacterField,
  addCharacter,
  setPlaceField,
  setNoCharacter,
  setShotField,
  toggleShotCharacter,
  addWizardShot,
  continueStep,
  openStep,
  canOpenStep,
  gateGaps,
  canGenerate,
  gapsFor,
  splitOffer,
  acceptSplit,
  saveWizard,
  loadWizard,
  projectFromWizard,
  WIZARD_STORAGE_KEY
} from '../app/utils/wizard.js'

const MAYA = 'Maya, early 30s, short black pixie cut, charcoal wool coat, meets Rui, 50s, grey stubble, navy peacoat, rust-red scarf, on a rainy quay. She hands him a letter. He reads it and walks away.'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  }
}

function fillCharacter(state, id, fields) {
  return Object.entries(fields).reduce((next, [field, value]) => setCharacterField(next, id, field, value), state)
}

function completeBoard() {
  let state = setAspect(setPromptStyle(setModel(setIdea(blankWizard(), 'Maya meets Rui on the rainy quay and hands him a letter before he walks away.'), 'grok'), 'short'), '16:9')
  state = setGenre(setStyle(state, 'cinema'), 'drama')
  state = setMood(setLight(state, 'dusk'), 'tense')
  const maya = state.characters[0].id
  state = fillCharacter(state, maya, {
    name: 'Maya',
    age: 'early 30s',
    build: 'round face',
    hair: 'short black pixie cut',
    outfit: 'charcoal wool coat',
    colors: 'charcoal and black',
    mark: 'round glasses'
  })
  state = addCharacter(state)
  const rui = state.characters[1].id
  state = fillCharacter(state, rui, {
    name: 'Rui',
    age: '50s',
    build: 'grey stubble',
    hair: 'short grey hair',
    outfit: 'navy peacoat',
    colors: 'navy and rust',
    mark: 'rust-red scarf'
  })
  const place = state.places[0].id
  state = setPlaceField(state, place, 'name', 'Rainy quay')
  state = setPlaceField(state, place, 'description', 'a wet stone quay at the harbour')
  const first = state.shots[0].id
  state = toggleShotCharacter(state, first, maya)
  state = setShotField(state, first, 'placeId', place)
  state = setShotField(state, first, 'action', 'She hands him a letter')
  state = setShotField(state, first, 'framing', 'close')
  state = addWizardShot(state)
  const second = state.shots[1].id
  state = toggleShotCharacter(state, second, rui)
  state = setShotField(state, second, 'placeId', place)
  state = setShotField(state, second, 'action', 'He walks away')
  state = setShotField(state, second, 'framing', 'tracking')
  return state
}

function stable(project) {
  const copy = JSON.parse(JSON.stringify(project))
  delete copy.createdAt
  delete copy.updatedAt
  return copy
}

test('Generate stays off while a required field is empty and turns on when the board is complete', () => {
  const ready = completeBoard()
  assert.equal(canGenerate(ready), true)
  const missingHair = setCharacterField(ready, ready.characters[0].id, 'hair', '   ')
  assert.equal(canGenerate(missingHair), false)
  const gaps = gapsFor(missingHair, 'characters')
  assert.ok(gaps.some(gap => gap.field === 'hair' && gap.key === 'missing.hair'))
  assert.match(wizardText('missing.hair'), /hair/i)
  assert.match(wizardText(gaps[0].key), /\S/)
})

test('the wizard restores from browser storage and completed steps can be reopened', () => {
  const storage = memoryStorage()
  let state = setIdea(blankWizard(), 'A lighthouse keeper races the dusk to repair the beacon.')
  assert.equal(canOpenStep(setIdea(blankWizard(), 'short'), 'characters'), false)
  assert.equal(canOpenStep(state, 'characters'), true)
  state = continueStep(state)
  assert.equal(state.step, 'characters')
  assert.equal(saveWizard(storage, state), true)
  const restored = loadWizard(storage)
  assert.equal(restored.step, 'characters')
  assert.equal(restored.idea, state.idea)
  assert.equal(storage.getItem(WIZARD_STORAGE_KEY).includes('"step":"characters"'), true)
  assert.equal(canOpenStep(restored, 'idea'), true)
  assert.equal(canOpenStep(restored, 'shots'), false)
  const back = openStep(restored, 'idea')
  assert.equal(back.step, 'idea')
  assert.equal(canOpenStep(back, 'characters'), true)
  assert.equal(openStep(back, 'characters').step, 'characters')
  assert.equal(loadWizard({ getItem: () => '{not json' }), null)
})

test('a shot with more than one action offers a split and does not generate until it is one action', () => {
  let state = completeBoard()
  const id = state.shots[0].id
  state = setShotField(state, id, 'action', 'She pours a latte and laughs')
  assert.deepEqual(splitOffer(state.shots[0].action), ['She pours a latte', 'She laughs'])
  assert.ok(gapsFor(state, 'shots').some(gap => gap.key === 'split.pending'))
  assert.equal(canGenerate(state), false)
  state = acceptSplit(state, id)
  assert.equal(state.shots[0].action, 'She pours a latte')
  assert.equal(state.shots[1].action, 'She laughs')
  assert.equal(state.shots.length, 3)
  assert.equal(splitOffer(state.shots[0].action), null)
  assert.equal(canGenerate(state), true)
})

test('idea detection prefills later steps and keeps a field the user already edited', () => {
  let state = continueStep(setIdea(blankWizard(), MAYA))
  const maya = state.characters.find(character => character.name === 'Maya')
  const rui = state.characters.find(character => character.name === 'Rui')
  assert.ok(maya)
  assert.ok(rui)
  assert.equal(maya.age, 'early 30s')
  assert.match(maya.hair, /pixie/)
  assert.match(maya.outfit, /coat/)
  assert.equal(maya.origin.age, 'detected')
  assert.equal(state.places[0].name, 'Rainy quay')
  assert.equal(state.places[0].description, 'a rainy quay')
  assert.equal(state.shots.length, 3)
  assert.match(state.shots[0].action, /letter/)
  assert.equal(state.detection.language, 'en')
  state = setCharacterField(state, maya.id, 'name', 'Maya Chen')
  state = continueStep(openStep(state, 'idea'))
  const kept = state.characters.find(character => character.name === 'Maya Chen')
  assert.ok(kept)
  assert.match(kept.hair, /pixie/)
  assert.equal(kept.origin.name, 'user')
})

test('the same inputs produce the same storyboard through the wizard and the existing engine', () => {
  const state = completeBoard()
  const fromWizard = projectFromWizard(state, { id: 'parity' })
  const scenario = {
    characters: [
      {
        name: 'Maya',
        look: 'early 30s, round face, short black pixie cut',
        outfit: 'charcoal wool coat',
        body: 'early 30s',
        face: 'round face',
        hair: 'short black pixie cut',
        colors: 'charcoal and black',
        marks: 'round glasses'
      },
      {
        name: 'Rui',
        look: '50s, grey stubble, short grey hair',
        outfit: 'navy peacoat',
        body: '50s',
        face: 'grey stubble',
        hair: 'short grey hair',
        colors: 'navy and rust',
        marks: 'rust-red scarf'
      }
    ],
    places: [{ name: 'Rainy quay', description: 'a wet stone quay at the harbour' }],
    light: 'dusk',
    mood: 'tense',
    scenes: [
      { who: 'Maya', where: 'Rainy quay', what: 'She hands him a letter', duration: 3 },
      { who: 'Rui', where: 'Rainy quay', what: 'He walks away', duration: 3 }
    ]
  }
  const existing = createStoryboard({
    id: 'parity',
    premise: 'Maya meets Rui on the rainy quay and hands him a letter before he walks away.',
    model: 'grok',
    sequenceMode: 'scenario',
    scenario,
    style: 'cinema',
    genre: 'drama',
    aspectRatio: '16:9',
    promptStyle: 'short',
    duration: 3
  })
  const framings = ['close', 'tracking']
  const shots = existing.shots.map((shot, index) => {
    const term = termById(framings[index])
    return { ...shot, framingTerm: term.id, framingChosen: true, framing: term.label }
  })
  const stamped = { ...existing, shots }
  stamped.shots = shots.map((shot, index) => refreshShotPrompt(shot, stamped, index))
  assert.equal(JSON.stringify(stable(fromWizard)), JSON.stringify(stable(stamped)))
  assert.equal(fromWizard.shots.map(shot => shot.prompt).join('\n'), stamped.shots.map(shot => shot.prompt).join('\n'))
})

test('Next stays on an incomplete step and advances when that step is complete', () => {
  let state = blankWizard()
  assert.equal(continueStep(state).step, 'idea')
  assert.equal(gateGaps(state, 'idea')[0].key, 'missing.ideaShort')
  assert.equal(canOpenStep(state, 'characters'), false)
  state = setIdea(state, '1234567')
  assert.equal(continueStep(state).step, 'idea')
  state = setIdea(state, '12345678')
  assert.equal(gateGaps(state, 'idea').length, 0)
  state = continueStep(state)
  assert.equal(state.step, 'characters')
  assert.equal(continueStep(state).step, 'characters')
  assert.equal(gateGaps(state, 'characters')[0].key, 'missing.name')
  assert.equal(canOpenStep(state, 'places'), false)
  assert.equal(openStep(state, 'idea').step, 'idea')
  state = setNoCharacter(state, true)
  assert.equal(gateGaps(state, 'characters').length, 0)
  state = continueStep(state)
  assert.equal(state.step, 'places')
  state = setPlaceField(state, state.places[0].id, 'name', '')
  assert.equal(continueStep(state).step, 'places')
  assert.equal(gateGaps(state, 'places')[0].key, 'missing.placeName')
  state = setPlaceField(state, state.places[0].id, 'name', 'Quay')
  assert.equal(gateGaps(state, 'places').length, 0)
  state = continueStep(state)
  assert.equal(state.step, 'shots')
  assert.equal(continueStep(state).step, 'shots')
  assert.equal(gateGaps(state, 'shots')[0].key, 'missing.action')
  state = setShotField(state, state.shots[0].id, 'action', 'She lights the lamp')
  assert.equal(gateGaps(state, 'shots').length, 0)
  state = continueStep(state)
  assert.equal(state.step, 'check')
  const filled = fillCharacter(blankWizard(), blankWizard().characters[0].id, {})
  let cast = setIdea(blankWizard(), 'A keeper repairs the beacon at dusk.')
  cast = continueStep(cast)
  cast = fillCharacter(cast, cast.characters[0].id, { name: 'Léa', age: '40', build: 'tall', hair: 'black braid', outfit: 'wool coat' })
  assert.equal(gateGaps(cast, 'characters').length, 0)
  assert.equal(continueStep(cast).step, 'places')
  assert.equal(canOpenStep(openStep(cast, 'idea'), 'places'), true)
  assert.equal(filled.characters[0].name, '')
})

test('the studio opens on the guide and keeps the full editor', () => {
  const studio = readFileSync('app/pages/studio.vue', 'utf8')
  assert.match(studio, /experience = ref\('guided'\)/)
  assert.match(studio, /<StudioWizard/)
  assert.match(studio, /<StudioCreationPanel \/>/)
  assert.match(studio, /<StudioEditor \/>/)
  assert.match(readFileSync('app/components/StudioWizard.vue', 'utf8'), /wizardText|from '~\/utils\/wizard-strings\.js'/)
  assert.match(readFileSync('README.md', 'utf8'), /Advanced mode/)
  assert.equal(readFileSync('AGENTS.md', 'utf8'), readFileSync('public/agents.md', 'utf8'))
})
