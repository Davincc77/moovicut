/**
 * Studio wizard state. Deterministic, no model call.
 * Generating a board calls the same storyboard engine as the full editor.
 */
import { cleanText } from './text.js'
import { wizardText } from './wizard-strings.js'
import { createStoryboard, refreshShotPrompt, canonicalModel, canonicalAspect } from './prompt-engine.js'
import { termById, suggestFraming } from './framing.js'
import { foldName, findByName, nameParts, LIGHT_VALUES, MOOD_VALUES } from './scenario.js'
import { canonicalStyleFamily, presetGenres } from './presets/index.js'
import { detectProse } from './prose-detect.js'
import { lockLineFor } from './character-lock.js'
import { assessProject } from './shot-risk.js'
import { splitActionText } from './action-split.js'

export const WIZARD_STORAGE_KEY = 'moovicut.wizard.v1'
export const WIZARD_VERSION = 1

export const WIZARD_STEPS = Object.freeze([
  { id: 'idea', label: 'step.idea' },
  { id: 'characters', label: 'step.characters' },
  { id: 'places', label: 'step.places' },
  { id: 'shots', label: 'step.shots' },
  { id: 'check', label: 'step.check' },
  { id: 'generate', label: 'step.generate' }
])

export const CHARACTER_FIELDS = Object.freeze(['name', 'age', 'build', 'hair', 'outfit', 'colors', 'mark'])
/** Detection often leaves these blank. They do not block Next or Generate. */
export const OPTIONAL_CHARACTER_FIELDS = Object.freeze(['colors', 'mark'])

const FIELD_LIMITS = Object.freeze({
  name: 80,
  age: 160,
  build: 200,
  hair: 200,
  outfit: 300,
  colors: 160,
  mark: 200,
  placeName: 80,
  placeDescription: 300,
  action: 2000,
  idea: 6000
})

const MISSING_KEY = Object.freeze({
  name: 'missing.name',
  age: 'missing.age',
  build: 'missing.build',
  hair: 'missing.hair',
  outfit: 'missing.outfit',
  colors: 'missing.colors',
  mark: 'missing.mark'
})

/** Continuity and structure failures. Risk notes stay warnings. */
export const BLOCKING_CODES = Object.freeze(new Set([
  'several_actions',
  'too_many_actions',
  'missing_lock',
  'wardrobe_state',
  'conflicting_trait',
  'unknown_character',
  'undeclared_wardrobe',
  'unresolved_character',
  'unresolved_place',
  'missing_framing',
  'duplicated_trait'
]))

const COLOR_WORDS = ['black', 'brown', 'blonde', 'blond', 'red', 'ginger', 'auburn', 'silver', 'white', 'grey', 'gray', 'blue', 'green', 'pink', 'purple', 'navy', 'charcoal', 'oatmeal', 'rust', 'gold', 'amber', 'ash']
const AGE_PATTERN = /\b((?:early|mid|late)\s+\d{1,2}s|\d{1,2}s|\d{1,3}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-[a-z]+)?)\b/i
const HAIR_PATTERN = /\b(?:(?:short|long|curly|wavy|straight|black|brown|blonde|blond|red|grey|gray|silver|white|dark|auburn|copper)\s+){0,4}(?:pixie cut|bob|bangs|braid|braids|undercut|hair|curls|bun)\b/i
const FACE_PATTERN = /\b(?:(?:grey|gray|white|black|red|dark)\s+)?(?:stubble|beard|moustache|mustache)\b|\b(?:blue|green|brown|amber|hazel)\s+eyes\b/i
const MARK_PATTERN = /\b(?:[\p{L}'’-]+\s+){0,3}(?:glasses|earrings?|scar|mole|tattoo|freckles|birthmark)\b/iu
const ACCESSORY_PATTERN = /\b(?:[\p{L}'’-]+\s+){0,4}(?:scarf|scarves|glasses|earrings?|hat|cap|necklace|watch|gloves)\b/iu

const clone = value => JSON.parse(JSON.stringify(value))

function stepIndex(id) {
  return WIZARD_STEPS.findIndex(step => step.id === id)
}

function blankOrigins() {
  return Object.fromEntries(CHARACTER_FIELDS.map(field => [field, '']))
}

function blankConfidence() {
  return Object.fromEntries(CHARACTER_FIELDS.map(field => [field, '']))
}

function blankCharacter(id) {
  return {
    id,
    name: '',
    age: '',
    build: '',
    hair: '',
    outfit: '',
    colors: '',
    mark: '',
    states: [],
    origin: blankOrigins(),
    confidence: blankConfidence()
  }
}

function blankPlace(id) {
  return { id, name: '', description: '', origin: { name: '', description: '' }, confidence: { name: '', description: '' } }
}

function blankShot(id) {
  return {
    id,
    whoIds: [],
    noCharacter: false,
    placeId: '',
    action: '',
    framing: '',
    duration: 3,
    prompt: '',
    origin: { who: '', place: '', action: '', framing: '' },
    confidence: { who: '', place: '', action: '', framing: '' }
  }
}

function nextId(prefix, items) {
  const max = items.reduce((best, item) => {
    const match = String(item.id || '').match(/(\d+)$/)
    return Math.max(best, match ? Number(match[1]) : 0)
  }, 0)
  return `${prefix}-${max + 1}`
}

export function blankWizard() {
  return {
    version: WIZARD_VERSION,
    step: 'idea',
    maxReached: 0,
    idea: '',
    model: 'grok',
    promptStyle: 'short',
    aspectRatio: '16:9',
    styleFamily: 'cinema',
    genre: 'drama',
    light: '',
    mood: '',
    lightOrigin: '',
    moodOrigin: '',
    styleOrigin: 'default',
    genreOrigin: 'default',
    detection: null,
    noCharacter: false,
    characterIndex: 0,
    placeIndex: 0,
    shotIndex: 0,
    characters: [blankCharacter('character-1')],
    places: [blankPlace('place-1')],
    shots: [blankShot('shot-1')],
    hasGenerated: false,
    generatedSignature: '',
    ignoredNames: []
  }
}

function clip(value, max) {
  return String(value ?? '').slice(0, max)
}

function filled(value) {
  return cleanText(value).length > 0
}

/** Generic place names the detector uses when the text names none. They are not a place. */
const PLACEHOLDER_PLACE_NAMES = new Set(['the setting', 'o lugar', 'le lieu', 'il luogo', '场所', '场景', '場所'])
/** Generic descriptions that travel with those placeholder names. */
const PLACEHOLDER_PLACE_DESCRIPTIONS = new Set([
  'a place the text does not name',
  'um lugar que o texto nao nomeia',
  'un lieu que le texte ne nomme pas',
  'un luogo che il testo non nomina',
  '文が名を挙げない場所'
])

function storyKey(value) {
  return foldName(value).replace(/[.!?…]+$/u, '').trim()
}

function acceptedPlaceName(place) {
  const name = cleanText(place?.name)
  if (!name || PLACEHOLDER_PLACE_NAMES.has(storyKey(name))) return ''
  return name
}

function acceptedPlaceDescription(place) {
  const description = cleanText(place?.description)
  if (!description || PLACEHOLDER_PLACE_DESCRIPTIONS.has(storyKey(description))) return ''
  return description
}

/** A detected action that only repeats the idea is not an action until the person rewrites it. */
function acceptedAction(state, shot) {
  const action = cleanText(shot?.action)
  if (!action) return ''
  const idea = cleanText(state?.idea)
  if (idea && storyKey(action) === storyKey(idea)) return ''
  return action
}

function gap(step, extra) {
  return { step, targetId: '', field: '', key: '', name: '', ...extra }
}

function characterGaps(state) {
  const gaps = []
  if (state.noCharacter) return gaps
  if (!state.characters.length) {
    gaps.push(gap('characters', { field: 'characters', key: 'missing.characters' }))
    return gaps
  }
  const seen = new Set()
  state.characters.forEach(character => {
    const name = cleanText(character.name)
    CHARACTER_FIELDS.forEach(field => {
      if (OPTIONAL_CHARACTER_FIELDS.includes(field)) return
      if (filled(character[field])) return
      gaps.push(gap('characters', { targetId: character.id, field, key: MISSING_KEY[field], name }))
    })
    const key = foldName(name)
    if (key && seen.has(key)) {
      gaps.push(gap('characters', { targetId: character.id, field: 'name', key: 'missing.duplicateName', name }))
    }
    if (key) seen.add(key)
  })
  return gaps
}

function placeGaps(state) {
  const gaps = []
  if (!state.places.length) gaps.push(gap('places', { field: 'places', key: 'missing.places' }))
  const seen = new Set()
  state.places.forEach(place => {
    const name = acceptedPlaceName(place)
    if (!name) gaps.push(gap('places', { targetId: place.id, field: 'name', key: 'missing.placeName' }))
    if (!acceptedPlaceDescription(place)) gaps.push(gap('places', { targetId: place.id, field: 'description', key: 'missing.placeDescription', name }))
    const key = foldName(name)
    if (key && seen.has(key)) gaps.push(gap('places', { targetId: place.id, field: 'name', key: 'missing.duplicatePlace', name }))
    if (key) seen.add(key)
  })
  if (!LIGHT_VALUES.includes(state.light)) gaps.push(gap('places', { field: 'light', key: 'missing.light' }))
  if (!MOOD_VALUES.includes(state.mood)) gaps.push(gap('places', { field: 'mood', key: 'missing.mood' }))
  if (!canonicalStyleFamily(state.styleFamily)) gaps.push(gap('places', { field: 'style', key: 'missing.style' }))
  const genres = presetGenres(canonicalStyleFamily(state.styleFamily))
  if (!genres.includes(state.genre)) gaps.push(gap('places', { field: 'genre', key: 'missing.genre' }))
  return gaps
}

function shotGaps(state) {
  const gaps = []
  if (!state.shots.length) {
    gaps.push(gap('shots', { field: 'shots', key: 'missing.shots' }))
    return gaps
  }
  state.shots.forEach((shot, index) => {
    const skipWho = state.noCharacter || shot.noCharacter
    const who = (shot.whoIds || []).filter(id => state.characters.some(character => character.id === id && filled(character.name)))
    if (!skipWho && !who.length) gaps.push(gap('shots', { targetId: shot.id, field: 'who', key: 'missing.who', name: String(index + 1) }))
    const place = state.places.find(item => item.id === shot.placeId && acceptedPlaceName(item))
    if (!place) gaps.push(gap('shots', { targetId: shot.id, field: 'place', key: 'missing.place' }))
    const action = acceptedAction(state, shot)
    if (!action) gaps.push(gap('shots', { targetId: shot.id, field: 'action', key: 'missing.action' }))
    else if (splitOffer(action)) gaps.push(gap('shots', { targetId: shot.id, field: 'action', key: 'split.pending' }))
    if (!termById(shot.framing)) gaps.push(gap('shots', { targetId: shot.id, field: 'framing', key: 'missing.framing' }))
    const duration = Number(shot.duration)
    if (!Number.isInteger(duration) || duration < 2 || duration > 15) gaps.push(gap('shots', { targetId: shot.id, field: 'duration', key: 'missing.duration' }))
  })
  return gaps
}

export function gapsFor(state, stepId) {
  if (!state) return [gap('idea', { key: 'missing.ideaShort' })]
  if (stepId === 'idea') {
    const length = cleanText(state.idea).length
    if (length < 8) return [gap('idea', { field: 'idea', key: 'missing.ideaShort' })]
    if (length > 6000) return [gap('idea', { field: 'idea', key: 'missing.ideaLong' })]
    return []
  }
  if (stepId === 'characters') return characterGaps(state)
  if (stepId === 'places') return placeGaps(state)
  if (stepId === 'shots') return shotGaps(state)
  return []
}

export function allGaps(state) {
  return ['idea', 'characters', 'places', 'shots'].flatMap(step => gapsFor(state, step))
}

/** Next and the stepper use the same strict list. A partial row does not pass. */
export function gateGaps(state, stepId) {
  return gapsFor(state, stepId)
}

/** First idea, character, place, or shot step that still has a strict gap. */
export function firstIncompleteStep(state) {
  for (const step of WIZARD_STEPS) {
    if (step.id === 'check' || step.id === 'generate') return ''
    if (gapsFor(state, step.id).length) return step.id
  }
  return ''
}

function gapBefore(state, targetIndex) {
  for (let index = 0; index < targetIndex; index += 1) {
    const id = WIZARD_STEPS[index].id
    if (id === 'check' || id === 'generate') continue
    if (gapsFor(state, id).length) return true
  }
  return false
}

/** DOM id of the control the guide should focus for this gap. */
export function gapFieldId(state, gap) {
  if (!gap) return 'wizard-gaps'
  if (gap.field === 'idea') return 'wizard-idea'
  if (gap.field === 'light') return 'wizard-light'
  if (gap.field === 'mood') return 'wizard-mood'
  if (gap.field === 'style') return 'wizard-style'
  if (gap.field === 'genre') return 'wizard-genre'
  if (gap.field === 'characters') return 'wizard-no-character'
  if (gap.field === 'places') return 'wizard-add-place'
  if (gap.field === 'shots') return 'wizard-add-shot'
  if (gap.targetId && (gap.step === 'characters' || state?.step === 'characters') && CHARACTER_FIELDS.includes(gap.field)) return `${gap.targetId}-${gap.field}`
  if (gap.targetId && (gap.step === 'places' || state?.step === 'places')) {
    if (gap.field === 'description') return `${gap.targetId}-description`
    if (gap.field === 'name') return `${gap.targetId}-name`
  }
  if (gap.targetId && (gap.step === 'shots' || state?.step === 'shots')) {
    if (gap.field === 'who') return `${gap.targetId}-who`
    if (gap.field === 'place') return `${gap.targetId}-place`
    if (gap.field === 'action') return `${gap.targetId}-action`
    if (gap.field === 'framing') return `${gap.targetId}-framing`
    if (gap.field === 'duration') return `${gap.targetId}-duration`
  }
  return 'wizard-gaps'
}

/** Open the tab that holds the gap so the missing field can be focused. */
export function revealGap(state, gap) {
  if (!state || !gap?.targetId) return state
  if (state.step === 'characters') {
    const index = state.characters.findIndex(item => item.id === gap.targetId)
    if (index >= 0 && index !== state.characterIndex) return openCharacter(state, index)
  }
  if (state.step === 'places') {
    const index = state.places.findIndex(item => item.id === gap.targetId)
    if (index >= 0 && index !== state.placeIndex) return openPlace(state, index)
  }
  if (state.step === 'shots') {
    const index = state.shots.findIndex(item => item.id === gap.targetId)
    if (index >= 0 && index !== state.shotIndex) return openShot(state, index)
  }
  return state
}

export function splitOffer(action) {
  const parts = splitActionText(action)
  return parts.length >= 2 ? parts : null
}

function move(state, stepId) {
  const next = clone(state)
  const index = stepIndex(stepId)
  next.step = WIZARD_STEPS[index].id
  next.maxReached = Math.max(next.maxReached || 0, index)
  return next
}

export function canOpenStep(state, stepId) {
  const target = stepIndex(stepId)
  const current = stepIndex(state?.step)
  if (!state || target < 0 || current < 0) return false
  // Check can be reopened after it was reached, so it can name the unfinished step. Generate stays closed.
  if (stepId === 'check' && Number(state.maxReached) >= target && !gapBefore(state, stepIndex('shots'))) return true
  if (gapBefore(state, target)) return false
  if (stepId === 'generate') return canGenerate(state)
  return true
}

export function openStep(state, stepId) {
  if (!state || state.step === stepId || !canOpenStep(state, stepId)) return state
  const next = clone(state)
  next.step = stepId
  next.maxReached = Math.max(Number(next.maxReached) || 0, stepIndex(stepId))
  return next
}

export function continueStep(state) {
  if (!state || gapsFor(state, state.step).length) return state
  if (state.step === 'idea') return move(applyIdeaDetection(state), 'characters')
  if (state.step === 'check') {
    if (!canGenerate(state)) return state
    return move(state, 'generate')
  }
  const index = stepIndex(state.step)
  if (index < 0 || index >= WIZARD_STEPS.length - 1) return state
  return move(state, WIZARD_STEPS[index + 1].id)
}

/** A restored guide opens on the first step that still has a strict gap. */
export function clampWizardStep(state) {
  if (!state) return state
  const gapId = firstIncompleteStep(state)
  if (!gapId) return state
  const limit = stepIndex(gapId)
  if (stepIndex(state.step) <= limit) return state
  const next = clone(state)
  next.step = gapId
  next.maxReached = Math.min(Number(next.maxReached) || 0, limit)
  return next
}

function normalizeColor(word) {
  if (word === 'blond') return 'blonde'
  if (word === 'gray') return 'grey'
  return word
}

function colorList(text) {
  const source = String(text || '')
  const found = []
  COLOR_WORDS.forEach(color => {
    const match = source.match(new RegExp(`\\b${color}\\b`, 'i'))
    if (!match) return
    const word = normalizeColor(color)
    if (!found.includes(word)) found.push(word)
  })
  return found.join(', ')
}

function traitsFromDetection(character) {
  const look = character.look || ''
  const outfit = character.outfit || ''
  const age = (look.match(AGE_PATTERN) || [''])[0]
  const hair = (look.match(HAIR_PATTERN) || [''])[0]
  const face = (look.match(FACE_PATTERN) || [''])[0]
  const marked = (look.match(MARK_PATTERN) || outfit.match(ACCESSORY_PATTERN) || [''])[0]
  const used = [age, hair, face, marked].filter(Boolean)
  const leftover = look.split(/\s*,\s*/).map(part => part.trim()).filter(part => part && !used.some(item => item === part || item.includes(part) || part.includes(item)))
  const mark = [marked, ...leftover].filter(Boolean).join(', ')
  const level = character.confidence === 'high' || character.confidence === 'low' ? character.confidence : 'medium'
  const confidence = blankConfidence()
  const values = {
    name: character.name || '',
    age,
    build: face,
    hair,
    outfit,
    colors: colorList(`${look} ${outfit}`),
    mark
  }
  CHARACTER_FIELDS.forEach(field => {
    confidence[field] = values[field] ? (field === 'colors' || field === 'mark' ? 'medium' : field === 'name' ? 'high' : level) : ''
  })
  return { values, confidence }
}

function detectedCharacter(record, id) {
  const traits = traitsFromDetection(record)
  const character = blankCharacter(id)
  CHARACTER_FIELDS.forEach(field => {
    character[field] = traits.values[field] || ''
    if (character[field]) {
      character.origin[field] = 'detected'
      character.confidence[field] = traits.confidence[field]
    }
  })
  return character
}

function userTouchedCharacter(character) {
  return CHARACTER_FIELDS.some(field => character.origin?.[field] === 'user')
}

function userTouchedPlace(place) {
  return place.origin?.name === 'user' || place.origin?.description === 'user'
}

function userTouchedShot(shot) {
  return ['who', 'place', 'action', 'framing'].some(field => shot.origin?.[field] === 'user')
}

function applyCharacters(state, detected) {
  const incoming = detected.characters || []
  if (!incoming.length) return
  const untouched = state.characters.every(character => !userTouchedCharacter(character) && CHARACTER_FIELDS.every(field => !filled(character[field]) || character.origin[field] === 'detected'))
  if (untouched) {
    state.characters = incoming.map((record, index) => detectedCharacter(record, `character-${index + 1}`))
    state.characterIndex = 0
    return
  }
  incoming.forEach(record => {
    const match = state.characters.find(character => foldName(character.name) === foldName(record.name))
    if (!match) {
      state.characters.push(detectedCharacter(record, nextId('character', state.characters)))
      return
    }
    const traits = traitsFromDetection(record)
    CHARACTER_FIELDS.forEach(field => {
      if (match.origin[field] === 'user') return
      if (!traits.values[field]) return
      match[field] = traits.values[field]
      match.origin[field] = 'detected'
      match.confidence[field] = traits.confidence[field]
    })
  })
}

function applyPlaces(state, detected) {
  const incoming = detected.places || []
  if (!incoming.length) return
  const untouched = state.places.every(place => !userTouchedPlace(place) && (!filled(place.name) || place.origin.name === 'detected'))
  if (untouched) {
    state.places = incoming.map((place, index) => ({
      id: `place-${index + 1}`,
      name: place.name || '',
      description: place.description || '',
      origin: { name: place.name ? 'detected' : '', description: place.description ? 'detected' : '' },
      confidence: { name: place.confidence || 'medium', description: place.confidence || 'medium' }
    }))
    state.placeIndex = 0
    return
  }
  incoming.forEach(place => {
    const match = state.places.find(item => foldName(item.name) === foldName(place.name))
    if (!match) {
      state.places.push({
        id: nextId('place', state.places),
        name: place.name || '',
        description: place.description || '',
        origin: { name: 'detected', description: place.description ? 'detected' : '' },
        confidence: { name: place.confidence || 'medium', description: place.confidence || 'medium' }
      })
      return
    }
    if (match.origin.description !== 'user' && place.description) {
      match.description = place.description
      match.origin.description = 'detected'
      match.confidence.description = place.confidence || 'medium'
    }
  })
}

function resolveWho(state, who) {
  return nameParts(who).map(name => state.characters.find(character => foldName(character.name) === foldName(name))?.id).filter(Boolean)
}

function resolvePlace(state, name) {
  return state.places.find(place => foldName(place.name) === foldName(name))?.id || ''
}

function shotFromScene(state, scene, id) {
  const framing = suggestFraming({ action: scene.what || '', what: scene.what || '' }).id
  const whoIds = resolveWho(state, scene.who)
  const placeId = resolvePlace(state, scene.where)
  return {
    id,
    whoIds,
    placeId,
    action: scene.what || '',
    framing,
    duration: Number.isInteger(scene.duration) ? scene.duration : 3,
    prompt: '',
    origin: {
      who: whoIds.length ? 'detected' : '',
      place: placeId ? 'detected' : '',
      action: scene.what ? 'detected' : '',
      framing: 'detected'
    },
    confidence: {
      who: scene.confidence || 'medium',
      place: scene.confidence || 'medium',
      action: scene.confidence || 'medium',
      framing: 'medium'
    }
  }
}

function applyShots(state, detected) {
  const incoming = detected.scenes || []
  if (!incoming.length) return
  if (state.shots.some(userTouchedShot)) return
  state.shots = incoming.map((scene, index) => shotFromScene(state, scene, `shot-${index + 1}`))
  state.shotIndex = 0
}

/** Fill empty or still-detected fields from the existing prose detector. */
export function applyIdeaDetection(state) {
  const idea = cleanText(state.idea)
  if (idea.length < 8) return state
  const detected = detectProse(idea)
  const next = clone(state)
  if (detected.reliable === false) {
    next.detection = {
      language: detected.language || 'en',
      confidence: 'low',
      uncertain: true,
      warnings: (detected.warnings || []).map(item => item.message).filter(Boolean)
    }
    return next
  }
  applyCharacters(next, detected)
  applyPlaces(next, detected)
  if (next.lightOrigin !== 'user' && detected.light && LIGHT_VALUES.includes(detected.light)) {
    next.light = detected.light
    next.lightOrigin = 'detected'
  }
  if (next.moodOrigin !== 'user' && detected.mood && MOOD_VALUES.includes(detected.mood)) {
    next.mood = detected.mood
    next.moodOrigin = 'detected'
  }
  applyShots(next, detected)
  next.detection = {
    language: detected.language || 'en',
    confidence: detected.confidence || 'low',
    warnings: (detected.warnings || []).map(item => item.message).filter(Boolean)
  }
  return next
}

export function setIdea(state, value) {
  const next = clone(state)
  next.idea = clip(value, FIELD_LIMITS.idea)
  return next
}

export function setModel(state, value) {
  const model = canonicalModel(value)
  if (!model) return state
  const next = clone(state)
  next.model = model
  return next
}

export function setPromptStyle(state, value) {
  if (value !== 'short' && value !== 'detailed') return state
  const next = clone(state)
  next.promptStyle = value
  return next
}

export function setAspect(state, value) {
  const next = clone(state)
  next.aspectRatio = canonicalAspect(value)
  return next
}

export function setNoCharacter(state, value) {
  const next = clone(state)
  next.noCharacter = value === true
  return next
}

export function setShotNoCharacter(state, shotId, value) {
  if (state.noCharacter) return state
  const next = clone(state)
  const shot = next.shots.find(item => item.id === shotId)
  if (!shot) return state
  shot.noCharacter = value === true
  if (shot.noCharacter) shot.whoIds = []
  shot.origin.who = 'user'
  shot.confidence.who = ''
  return next
}

export function setCharacterField(state, id, field, value) {
  if (!CHARACTER_FIELDS.includes(field)) return state
  const next = clone(state)
  const character = next.characters.find(item => item.id === id)
  if (!character) return state
  character[field] = clip(value, FIELD_LIMITS[field])
  character.origin[field] = 'user'
  character.confidence[field] = ''
  return next
}

export function openCharacter(state, index) {
  const next = clone(state)
  const bounded = Math.max(0, Math.min(next.characters.length - 1, Number(index) || 0))
  next.characterIndex = bounded
  return next
}

export function addCharacter(state) {
  const next = clone(state)
  next.characters.push(blankCharacter(nextId('character', next.characters)))
  next.characterIndex = next.characters.length - 1
  return next
}

export function removeCharacter(state, id) {
  if (state.characters.length <= 1) return state
  const next = clone(state)
  next.characters = next.characters.filter(character => character.id !== id)
  next.shots.forEach(shot => { shot.whoIds = (shot.whoIds || []).filter(who => who !== id) })
  next.characterIndex = Math.max(0, Math.min(next.characterIndex, next.characters.length - 1))
  return next
}

export function setPlaceField(state, id, field, value) {
  if (field !== 'name' && field !== 'description') return state
  const next = clone(state)
  const place = next.places.find(item => item.id === id)
  if (!place) return state
  place[field] = clip(value, field === 'name' ? FIELD_LIMITS.placeName : FIELD_LIMITS.placeDescription)
  place.origin[field] = 'user'
  place.confidence[field] = ''
  return next
}

export function openPlace(state, index) {
  const next = clone(state)
  next.placeIndex = Math.max(0, Math.min(next.places.length - 1, Number(index) || 0))
  return next
}

export function addPlace(state) {
  const next = clone(state)
  next.places.push(blankPlace(nextId('place', next.places)))
  next.placeIndex = next.places.length - 1
  return next
}

export function removePlace(state, id) {
  if (state.places.length <= 1) return state
  const next = clone(state)
  next.places = next.places.filter(place => place.id !== id)
  next.shots.forEach(shot => { if (shot.placeId === id) shot.placeId = '' })
  next.placeIndex = Math.max(0, Math.min(next.placeIndex, next.places.length - 1))
  return next
}

export function setLight(state, value) {
  if (!LIGHT_VALUES.includes(value)) return state
  const next = clone(state)
  next.light = value
  next.lightOrigin = 'user'
  return next
}

export function setMood(state, value) {
  if (!MOOD_VALUES.includes(value)) return state
  const next = clone(state)
  next.mood = value
  next.moodOrigin = 'user'
  return next
}

export function setStyle(state, family) {
  const canonical = canonicalStyleFamily(family)
  if (!canonical) return state
  const next = clone(state)
  next.styleFamily = canonical
  next.styleOrigin = 'user'
  const genres = presetGenres(canonical)
  if (!genres.includes(next.genre)) {
    next.genre = genres[0] || ''
    next.genreOrigin = 'default'
  }
  return next
}

export function setGenre(state, genre) {
  const genres = presetGenres(canonicalStyleFamily(state.styleFamily))
  if (!genres.includes(genre)) return state
  const next = clone(state)
  next.genre = genre
  next.genreOrigin = 'user'
  return next
}

export function setShotField(state, id, field, value) {
  const next = clone(state)
  const shot = next.shots.find(item => item.id === id)
  if (!shot) return state
  if (field === 'action') {
    shot.action = clip(value, FIELD_LIMITS.action)
    shot.origin.action = 'user'
    shot.confidence.action = ''
  } else if (field === 'framing') {
    if (!termById(value)) return state
    shot.framing = value
    shot.origin.framing = 'user'
    shot.confidence.framing = ''
  } else if (field === 'placeId') {
    if (!next.places.some(place => place.id === value)) return state
    shot.placeId = value
    shot.origin.place = 'user'
    shot.confidence.place = ''
  } else if (field === 'duration') {
    const duration = Number(value)
    if (!Number.isInteger(duration)) return state
    shot.duration = duration
  } else return state
  return next
}

export function toggleShotCharacter(state, shotId, characterId) {
  const next = clone(state)
  const shot = next.shots.find(item => item.id === shotId)
  if (!shot || !next.characters.some(character => character.id === characterId)) return state
  const ids = new Set(shot.whoIds || [])
  if (ids.has(characterId)) ids.delete(characterId)
  else ids.add(characterId)
  shot.whoIds = next.characters.map(character => character.id).filter(id => ids.has(id))
  shot.origin.who = 'user'
  shot.confidence.who = ''
  return next
}

export function openShot(state, index) {
  const next = clone(state)
  next.shotIndex = Math.max(0, Math.min(next.shots.length - 1, Number(index) || 0))
  return next
}

export function addWizardShot(state) {
  const next = clone(state)
  next.shots.push(blankShot(nextId('shot', next.shots)))
  next.shotIndex = next.shots.length - 1
  return next
}

export function removeShot(state, id) {
  if (state.shots.length <= 1) return state
  const next = clone(state)
  next.shots = next.shots.filter(shot => shot.id !== id)
  next.shotIndex = Math.max(0, Math.min(next.shotIndex, next.shots.length - 1))
  return next
}

export function acceptSplit(state, id) {
  const next = clone(state)
  const index = next.shots.findIndex(shot => shot.id === id)
  if (index < 0) return state
  const shot = next.shots[index]
  const parts = splitOffer(shot.action)
  if (!parts) return state
  const pool = next.shots.slice()
  const made = parts.map((action, partIndex) => {
    if (partIndex === 0) {
      return { ...shot, action, origin: { ...shot.origin, action: 'user' }, confidence: { ...shot.confidence, action: '' } }
    }
    const created = {
      ...blankShot(nextId('shot', pool)),
      whoIds: [...(shot.whoIds || [])],
      placeId: shot.placeId,
      action,
      framing: shot.framing,
      duration: shot.duration,
      origin: { who: shot.origin.who, place: shot.origin.place, action: 'user', framing: shot.origin.framing },
      confidence: { who: '', place: '', action: '', framing: shot.confidence.framing }
    }
    pool.push(created)
    return created
  })
  next.shots.splice(index, 1, ...made)
  next.shotIndex = index
  return next
}

export function applyCheckFix(state, warning) {
  if (!warning) return state
  if (warning.fixId === 'create-sheet' && warning.name) {
    const next = clone(state)
    if (!next.characters.some(item => foldName(item.name) === foldName(warning.name))) {
      const character = blankCharacter(nextId('character', next.characters))
      character.name = warning.name
      next.characters.push(character)
    }
    next.characterIndex = Math.max(0, next.characters.findIndex(item => foldName(item.name) === foldName(warning.name)))
    next.step = 'characters'
    next.maxReached = Math.max(next.maxReached || 0, stepIndex('characters'))
    return next
  }
  if (warning.fixId === 'ignore-name' && warning.name) {
    const next = clone(state)
    const names = Array.isArray(next.ignoredNames) ? next.ignoredNames : []
    if (!names.some(item => foldName(item) === foldName(warning.name))) next.ignoredNames = [...names, warning.name]
    return next
  }
  const index = Math.max(0, (Number(warning.order) || 1) - 1)
  const shot = state.shots[index]
  if (!shot) return state
  if (warning.fixId === 'split-shot') return acceptSplit(state, shot.id)
  if (warning.fixId === 'declare-wardrobe' && warning.name && warning.phrase) {
    const next = clone(state)
    const character = next.characters.find(item => foldName(item.name) === foldName(warning.name))
    if (!character) return state
    character.states = [...(character.states || []), { fromOrder: index + 1, change: warning.phrase }]
    return next
  }
  if (warning.fixId === 'apply-framing') {
    const term = suggestFraming({ action: shot.action })
    return setShotField(state, shot.id, 'framing', term.id)
  }
  if (warning.fixId === 'drop-conflict' && warning.phrase) {
    const cleaned = shot.action.split(warning.phrase).join(warning.replacement || '').replace(/\s{2,}/g, ' ').trim()
    return setShotField(state, shot.id, 'action', cleaned)
  }
  return state
}

/** Look string the scenario parser requires. Age, build, and hair, in that order. */
export function characterLook(character) {
  return [character.age, character.build, character.hair].map(cleanText).filter(Boolean).join(', ')
}

export function engineCharacter(character) {
  const person = {
    name: cleanText(character.name),
    look: characterLook(character),
    outfit: cleanText(character.outfit),
    body: cleanText(character.age),
    face: cleanText(character.build),
    hair: cleanText(character.hair),
    colors: cleanText(character.colors),
    marks: cleanText(character.mark)
  }
  if (Array.isArray(character.states) && character.states.length) person.states = character.states
  return person
}

export function previewLock(character, order = 1) {
  if (!cleanText(character?.name)) return ''
  return lockLineFor(engineCharacter(character), order)
}

function shotWho(state, shot) {
  if (state.noCharacter || shot.noCharacter) return ''
  return (shot.whoIds || [])
    .map(id => state.characters.find(character => character.id === id))
    .map(character => cleanText(character?.name))
    .filter(Boolean)
    .join(' and ')
}

export function wizardScenario(state) {
  const people = state.noCharacter ? [] : state.characters.map(engineCharacter).filter(person => person.name)
  return {
    characters: people,
    places: state.places.map(place => ({ name: cleanText(place.name), description: cleanText(place.description) })),
    light: state.light,
    mood: state.mood,
    scenes: state.shots.map(shot => {
      const skip = state.noCharacter || shot.noCharacter
      const scene = {
        who: shotWho(state, shot),
        where: cleanText(state.places.find(place => place.id === shot.placeId)?.name),
        what: cleanText(shot.action),
        duration: Number(shot.duration) || 3
      }
      if (skip) scene.noCharacter = true
      if (shot.prompt) scene.prompt = shot.prompt
      return scene
    })
  }
}

export function wizardStoryboardOptions(state) {
  return {
    premise: cleanText(state.idea),
    model: canonicalModel(state.model) || 'grok',
    sequenceMode: 'scenario',
    scenario: wizardScenario(state),
    style: canonicalStyleFamily(state.styleFamily) || 'cinema',
    genre: state.genre,
    aspectRatio: canonicalAspect(state.aspectRatio),
    promptStyle: state.promptStyle === 'detailed' ? 'detailed' : 'short',
    duration: 3,
    noCharacter: state.noCharacter === true,
    allowEmptyCast: state.noCharacter === true,
    allowMissingWho: state.noCharacter === true || state.shots.some(shot => shot.noCharacter)
  }
}

export function optionsSignature(state, promptLanguage = 'en') {
  const options = wizardStoryboardOptions(state)
  if (promptLanguage && promptLanguage !== 'en') options.promptLanguage = promptLanguage
  return JSON.stringify(options)
}

export function projectFromWizard(state, { id, promptLanguage = 'en' } = {}) {
  const options = wizardStoryboardOptions(state)
  if (promptLanguage && promptLanguage !== 'en') options.promptLanguage = promptLanguage
  if (id) options.id = id
  const project = createStoryboard(options)
  const shots = project.shots.map((shot, index) => {
    const term = termById(state.shots[index]?.framing)
    if (!term) return shot
    return { ...shot, framingTerm: term.id, framingChosen: true, framing: term.label }
  })
  const next = { ...project, shots }
  if (Array.isArray(state.ignoredNames) && state.ignoredNames.length) next.ignoredNames = state.ignoredNames.slice()
  next.shots = shots.map((shot, index) => refreshShotPrompt(shot, next, index))
  if (next.shots.length > 40) throw new Error('Moovicut is built for up to 40 shots (a short or medium film, or one chapter). Split the story into chapters and send them one by one, reusing the exported character sheet so faces stay consistent.')
  return next
}

export function review(state) {
  const gaps = allGaps(state)
  if (gaps.length) return { ok: false, project: null, warnings: [], blocking: [], gaps }
  try {
    const project = projectFromWizard(state)
    const warnings = assessProject(project)
    const blocking = warnings.filter(item => BLOCKING_CODES.has(item.code))
    return { ok: blocking.length === 0, project, warnings, blocking, gaps }
  } catch (error) {
    return {
      ok: false,
      project: null,
      warnings: [],
      blocking: [{ code: 'build', message: error.message || wizardText('generate.failed'), fix: '', fixId: '' }],
      gaps
    }
  }
}

export function canGenerate(state) {
  const result = review(state)
  return result.ok && result.blocking.length === 0 && result.gaps.length === 0
}

export function markGenerated(state, promptLanguage = 'en') {
  const next = clone(state)
  next.hasGenerated = true
  next.generatedSignature = optionsSignature(state, promptLanguage)
  next.step = 'generate'
  next.maxReached = Math.max(next.maxReached || 0, stepIndex('generate'))
  return next
}

function asArray(value) {
  return Array.isArray(value) ? value : null
}

function restoreCharacter(value, index) {
  const source = value && typeof value === 'object' ? value : {}
  const character = blankCharacter(typeof source.id === 'string' && source.id ? source.id : `character-${index + 1}`)
  CHARACTER_FIELDS.forEach(field => {
    character[field] = clip(source[field], FIELD_LIMITS[field])
    const origin = source.origin?.[field]
    character.origin[field] = origin === 'user' || origin === 'detected' ? origin : ''
    const confidence = source.confidence?.[field]
    character.confidence[field] = confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : ''
  })
  character.states = Array.isArray(source.states) ? source.states.slice(0, 12).map(item => ({
    fromOrder: Math.max(1, Math.min(999, Math.round(Number(item?.fromOrder) || 1))),
    change: cleanText(item?.change).slice(0, 160)
  })).filter(item => item.change) : []
  return character
}

function restorePlace(value, index) {
  const source = value && typeof value === 'object' ? value : {}
  const place = blankPlace(typeof source.id === 'string' && source.id ? source.id : `place-${index + 1}`)
  place.name = clip(source.name, FIELD_LIMITS.placeName)
  place.description = clip(source.description, FIELD_LIMITS.placeDescription)
  ;['name', 'description'].forEach(field => {
    const origin = source.origin?.[field]
    place.origin[field] = origin === 'user' || origin === 'detected' ? origin : ''
    const confidence = source.confidence?.[field]
    place.confidence[field] = confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : ''
  })
  return place
}

function restoreShot(value, index) {
  const source = value && typeof value === 'object' ? value : {}
  const shot = blankShot(typeof source.id === 'string' && source.id ? source.id : `shot-${index + 1}`)
  shot.whoIds = asArray(source.whoIds)?.filter(id => typeof id === 'string').slice(0, 12) || []
  shot.noCharacter = source.noCharacter === true
  shot.placeId = typeof source.placeId === 'string' ? source.placeId : ''
  shot.action = clip(source.action, FIELD_LIMITS.action)
  shot.framing = termById(source.framing) ? source.framing : ''
  const duration = Number(source.duration)
  shot.duration = Number.isInteger(duration) ? duration : 3
  shot.prompt = typeof source.prompt === 'string' ? source.prompt.slice(0, 16000) : ''
  ;['who', 'place', 'action', 'framing'].forEach(field => {
    const origin = source.origin?.[field]
    shot.origin[field] = origin === 'user' || origin === 'detected' ? origin : ''
    const confidence = source.confidence?.[field]
    shot.confidence[field] = confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : ''
  })
  return shot
}

export function normalizeWizard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.version !== WIZARD_VERSION) return null
  const next = blankWizard()
  const step = stepIndex(value.step)
  next.step = step >= 0 ? value.step : 'idea'
  next.maxReached = Math.max(0, Math.min(WIZARD_STEPS.length - 1, Number(value.maxReached) || 0))
  next.idea = clip(value.idea, FIELD_LIMITS.idea)
  next.model = canonicalModel(value.model) || 'grok'
  next.promptStyle = value.promptStyle === 'detailed' ? 'detailed' : 'short'
  next.aspectRatio = canonicalAspect(value.aspectRatio)
  const family = canonicalStyleFamily(value.styleFamily)
  next.styleFamily = family || 'cinema'
  const genres = presetGenres(next.styleFamily)
  next.genre = genres.includes(value.genre) ? value.genre : (genres[0] || 'drama')
  next.light = LIGHT_VALUES.includes(value.light) ? value.light : ''
  next.mood = MOOD_VALUES.includes(value.mood) ? value.mood : ''
  next.lightOrigin = value.lightOrigin === 'user' || value.lightOrigin === 'detected' ? value.lightOrigin : ''
  next.moodOrigin = value.moodOrigin === 'user' || value.moodOrigin === 'detected' ? value.moodOrigin : ''
  next.styleOrigin = value.styleOrigin === 'user' ? 'user' : 'default'
  next.genreOrigin = value.genreOrigin === 'user' ? 'user' : 'default'
  next.noCharacter = value.noCharacter === true
  if (value.detection && typeof value.detection === 'object') {
    next.detection = {
      language: ['en', 'pt'].includes(value.detection.language) ? value.detection.language : 'en',
      confidence: ['high', 'medium', 'low'].includes(value.detection.confidence) ? value.detection.confidence : 'low',
      uncertain: value.detection.uncertain === true,
      warnings: asArray(value.detection.warnings)?.filter(item => typeof item === 'string').slice(0, 24) || []
    }
  }
  const characters = asArray(value.characters)?.slice(0, 24).map(restoreCharacter) || []
  const places = asArray(value.places)?.slice(0, 24).map(restorePlace) || []
  const shots = asArray(value.shots)?.map(restoreShot) || []
  if (characters.length) next.characters = characters
  if (places.length) next.places = places
  if (shots.length) next.shots = shots
  next.characterIndex = Math.max(0, Math.min(next.characters.length - 1, Number(value.characterIndex) || 0))
  next.placeIndex = Math.max(0, Math.min(next.places.length - 1, Number(value.placeIndex) || 0))
  next.shotIndex = Math.max(0, Math.min(next.shots.length - 1, Number(value.shotIndex) || 0))
  next.hasGenerated = value.hasGenerated === true
  next.generatedSignature = typeof value.generatedSignature === 'string' ? value.generatedSignature.slice(0, 200000) : ''
  next.ignoredNames = Array.isArray(value.ignoredNames) ? value.ignoredNames.map(item => cleanText(item).slice(0, 80)).filter(Boolean).slice(0, 40) : []
  return clampWizardStep(next)
}

export function saveWizard(storage, state) {
  if (!storage || typeof storage.setItem !== 'function') return false
  try {
    storage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(normalizeWizard(state) || state))
    return true
  } catch {
    return false
  }
}

export function loadWizard(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null
  try {
    const raw = storage.getItem(WIZARD_STORAGE_KEY)
    if (!raw || raw.length > 200000) return null
    return normalizeWizard(JSON.parse(raw))
  } catch {
    return null
  }
}
