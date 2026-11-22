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

export function storyToBoard(text, { model = 'grok' } = {}) {
  const clean = String(text || '')
  const detected = detectProse(clean)
  // Same shared fallback as the wizard: a story without proper names still has a
  // protagonist ('a baker') that the prompts will lock. Ambiance stays uncast.
  const sheet = buildContinuitySheet(clean)
  const cast = (detected.characters && detected.characters.length)
    ? detected.characters
    : (sheet.character && sheet.character.split(/\s+/).length <= 3 && /\b(?:a|an|the|o|os|as|um|uma|un|una|le|la|el)\s+[^.!?]{0,48}?\b(?:runs?|races?|crosses|discovers|walks|finds|follows|chases|meets|opens|enters|leaves|fights|searches|delivers|climbs|watches|hears|sees)\b/iu.test(clean)
      ? [{ name: sheet.character, look: sheet.appearance || 'as written in your story', outfit: sheet.appearance || 'as written in your story' }]
      : [])
  const scenes = storyScenes(detected)
  // Engine rule mirrored: with exactly one cast member, every scene belongs to them
  // (same as the premise path). Multiple people stay scene-scoped; unnamed scenes
  // would be a guess, so they surface as the familiar 'missing who' advice.
  if (cast.length === 1) scenes.forEach(scene => { if (!scene.who) scene.who = cast[0].name })
  const scenario = { ...detected.scenario, characters: cast.length && !detected.characters?.length ? cast : detected.scenario?.characters, scenes }
  const parsed = parseScenario(scenario, { allowIncompleteCast: true, allowMissingWhere: true, allowMissingWho: true })
  const board = createStoryboard({ premise: clean, model, sequenceMode: 'scenario', scenario: parsed })
  return { board, detected, coverage: coverage(board.shots, clean) }
}
