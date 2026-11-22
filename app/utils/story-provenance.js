/** Per-shot provenance, rule-based: where did this shot come from.
 *  'yours'     the user's own words (typed, or the idea reused whole)
 *  'extracted' a sentence lifted from the user's prose (shot.source)
 *  'suggested' the engine's beat template filled the line
 *  'edited'    the user hand-fixed the generated prompt afterwards
 */
import { cleanText } from './text.js'
import { detectProse } from './prose-detect.js'
import { parseScenario } from './scenario.js'
import { createStoryboard, buildContinuitySheet } from './prompt-engine.js'
import { STORY_VERB_FORMS } from './story-verbs.js'

export function shotProvenance(shot, context = {}) {
  if (shot?.promptEdited === true || shot?.origin?.prompt === 'user') return 'edited'
  const action = cleanText(shot?.action)
  const source = cleanText(shot?.source)
  const idea = cleanText(context.idea)
  if (source && action && !isIdeaRestatement(action, source) && !sameText(action, source)) return 'extracted'
  if (source) return source.length ? 'extracted' : 'suggested'
  if (action && idea && isIdeaRestatement(action, idea)) return 'yours'
  if (shot?.origin?.action === 'user') return 'yours'
  if (!action) return 'suggested'
  return 'suggested'
}

function sameText(a, b) {
  return normalizeCompare(a) === normalizeCompare(b)
}

/** A shot that merely repeats the idea sentence (the wizard's draft state) is the user's own text, not a lift. */
function isIdeaRestatement(action, reference) {
  const a = normalizeCompare(action)
  const r = normalizeCompare(reference)
  if (!a || !r) return false
  return a === r || r.includes(a) || a.includes(r)
}

function normalizeCompare(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function coverage(shots, storyText) {
  const total = (shots || []).length
  const fromText = (shots || []).filter(shot => {
    const kind = shotProvenance(shot, { idea: storyText })
    return kind === 'extracted' || kind === 'yours'
  }).length
  return { total, fromText, text: `${fromText} of ${total} shots come from your story` }
}


/**
 * Shared prose -> board builder. Same scene mapping as the API's prose path
 * (server scenesForPlan) so the /story preview and POST /api/v1/storyboard
 * agree byte for byte on what came from where.
 */
export function storyScenes(detected) {
  return (detected.scenes || []).map((scene, index) => {
    const row = detected.scenario?.scenes?.[index] || {}
    return {
      who: scene.who || row.who || '',
      where: scene.where || row.where || '',
      what: scene.what || row.what || scene.action || '',
      duration: scene.duration || row.duration || 3,
      light: scene.light || row.light || '',
      rulesLight: true,
      source: scene.source || scene.what || row.what || '',
      flags: Array.isArray(scene.flags) ? scene.flags : (Array.isArray(row.flags) ? row.flags : [])
    }
  }).filter(scene => scene.what)
}

/**
 * Shared prose cast rule for /story AND the API prose path: when detectProse found no
 * proper names, the continuity sheet's protagonist (a common noun introduced by an
 * article, or the sentence subject like 'Marta kept...') becomes the single cast member.
 * A landscape story stays uncast and keeps the honest 'missing who' advice.
 */
const SKY_WORDS = new Set(['sunset', 'sunrise', 'dusk', 'dawn', 'midnight', 'morning', 'evening', 'night', 'twilight', 'storm', 'silence', 'darkness', 'light'])

export function storyCast(text, detected = detectProse(String(text || ''))) {
  const found = (detected && detected.characters) || []
  if (found.length) return found
  const body = String(text || '')
  if (!PERSON_EVIDENCE.test(body)) return []
  const sheet = buildContinuitySheet(body)
  const name = sheet.character
  const genericLook = /^the same clothes/i.test(sheet.appearance || '')
  const usableName = name && name.split(/\s+/).length <= 3 && (!genericLook || /^[\p{Lu}][\p{L}'’-]{1,40}$/u.test(name))
  if (usableName) return [{ name, look: sheet.appearance || 'as written in your story', outfit: sheet.appearance || 'as written in your story' }]
  const subject = firstSubject(body)
  if (subject && !SKY_WORDS.has(subject.toLowerCase())) return [{ name: subject, look: 'as written in your story', outfit: 'as written in your story' }]
  return []
}

const PERSON_EVIDENCE = /\b(?:she|he|they|her|him|their|ela|ele|eles|elas|elle|il)\b/i

/** The capitalized sentence-initial subject ('Marta kept...') when the pronoun trail proves a person exists. */
function firstSubject(body) {
  const match = String(body).match(/(?:^|[.!?]\s+)([\p{Lu}][\p{L}'’-]{2,40})(?=\s+[\p{L}])/u)
  return match ? match[1] : ''
}

/** One cast member means every unattributed beat is theirs — server and preview agree. */
export function applyCastWho(scenes, cast) {
  if (cast.length !== 1) return scenes
  scenes.forEach(scene => { if (!scene.who) scene.who = cast[0].name })
  return scenes
}

export function storyToBoard(text, { model = 'grok' } = {}) {
  const clean = String(text || '')
  const detected = detectProse(clean)
  // Same shared fallback as the wizard: a story without proper names still has a
  // protagonist ('a baker') that the prompts will lock. Ambiance stays uncast.
  const sheet = buildContinuitySheet(clean)
  const cast = storyCast(clean, detected)
  const scenes = storyScenes(detected)
  if (!(detected.characters && detected.characters.length)) applyCastWho(scenes, cast)
  const scenario = { ...detected.scenario, characters: cast.length && !detected.characters?.length ? cast : detected.scenario?.characters, scenes }
  const parsed = parseScenario(scenario, { allowIncompleteCast: true, allowMissingWhere: true, allowMissingWho: true })
  const board = createStoryboard({ premise: clean, model, sequenceMode: 'scenario', scenario: parsed })
  return { board, detected, coverage: coverage(board.shots, clean) }
}
