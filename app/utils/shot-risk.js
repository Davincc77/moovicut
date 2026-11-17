/** Deterministic pre-generation checks. Warnings never block a board. */
import { findByName, foldName, nameParts } from './scenario.js'
import { isNonPlaceNoun, isRejectedPlace } from './place-lexicon.js'
import { warningAction } from './warning-action.js'
import { cleanText } from './text.js'
import { allowedDurations, profileFor, snapAspect } from './model-profiles.js'
import { continuityWarnings } from './continuity-check.js'
import { partJoinWarnings, partitionShots } from './parts.js'
import { splitActionText } from './action-split.js'
import { mentionedFraming, suggestFraming } from './framing.js'

const ACTION_VERBS = /\b(pours|pour|spills|spill|laughs|laugh|runs|run|opens|open|walks|walk|enters|enter|leaves|leave|rides|ride|turns|turn|verse|renverse|rit|court|entre|sort|marche|revient|ouvre)\b/gi
const TEXT_ON_SCREEN = /\b(title card|subtitle|subtitles|caption|captions|logo|on-screen text|onscreen text|écrit|ecrit|sign reads|text reading|words on screen)\b/i
const CROWD = /\b(crowd|crowds|army|armies|dozens|hundreds|foule|foules)\b/i
const GORE = /\b(gore|gory|bloody|blood|brutal|dismember|decapitat)\b/i
const BRAND_LOGO = /\blogo\b/i
const COPYRIGHT = /\b(disney(?:\s+characters?)?|mickey mouse|minnie mouse|spider-man|spiderman|batman|superman|harry potter|pikachu|mario)\b/i
const CELEBRITIES = ['taylor swift', 'beyonce', 'beyoncé', 'elon musk', 'tom cruise', 'ariana grande', 'rihanna', 'drake', 'zendaya', 'leonardo dicaprio', 'brad pitt', 'kim kardashian', 'kanye west', 'lady gaga', 'the weeknd', 'billie eilish', 'selena gomez', 'timothee chalamet', 'timothée chalamet']
const TRADEMARKS = ['disney', 'mickey mouse', 'minnie mouse', 'spider-man', 'spiderman', 'batman', 'superman', 'harry potter', 'pikachu', 'mario']
const BRANDS = ['nike', 'adidas', 'gucci', 'prada', 'chanel', 'louis vuitton', 'rolex', 'starbucks', "mcdonald's", 'coca-cola', 'samsung', 'nintendo', 'pixar', 'tesla', 'porsche', 'ferrari', 'balenciaga', 'versace', 'burberry']

function foldPhrase(value) {
  return foldName(value).replace(/[’ʼ]/g, "'")
}

function containsPhrase(text, phrase) {
  const source = foldPhrase(text)
  const needle = foldPhrase(phrase)
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(source)
}

/** Tokens that belong to a real person, brand, or trademark the risk check flags. */
export function flaggedNameKeys(text) {
  const keys = new Set()
  ;[...CELEBRITIES, ...TRADEMARKS, ...BRANDS].forEach(phrase => {
    if (!containsPhrase(text, phrase)) return
    const folded = foldPhrase(phrase)
    if (folded) keys.add(folded)
    folded.split(/\s+/).forEach(part => { if (part) keys.add(part) })
  })
  return keys
}
const HAND_DIRECT = /\b(hands?|fingers?|palms?|hand-?off|handoff|holding|holds?\s+(?:the|a|an|his|her|their)|held|pours?|pouring|shoulders|grips?|grasps?|clutches)\b/i
const HAND_TRANSFER = /\b(passes|passing|gives|giving|hands over|hands him|hands her|hands them|hands the)\b/i
const HAND_WITH_OBJECT = /\b(carries|carrying|repairs?|repairing|lifts|raises|taking|takes)\b/i
const HELD_OBJECT = /\b(lantern|cup|mug|glass|bottle|loaf|bread|pastry|umbrella|flashlight|phone|letter|map|key|keys|tool|rope|bag|tray|plate|bowl|hammer|lens)\b/i
const CAMERA_CONFLICTS = [
  [/\bpush(?:-|\s)?in\b/i, /\bpull(?:-|\s)?(?:out|back)\b/i, 'push-in and pull-back'],
  [/\bzoom in\b/i, /\bzoom out\b/i, 'zoom in and zoom out'],
  [/\b(static|locked-off|locked off)\b/i, /\bhandheld\b/i, 'a locked camera and a handheld camera'],
  [/\bpan left\b/i, /\bpan right\b/i, 'pan left and pan right']
]

const NOT_A_WARNING_PLACE = new Set(['snow', 'neve', 'ice', 'gelo', 'stage', 'palco', 'water', 'agua', 'água'])

export { warningAction }

function warning(shot, code, message, fix, extra = {}) {
  return { shotId: shot.id || shot.shot_id, order: shot.order, code, message, fix, action: extra.action || warningAction(code), ...extra }
}

function ignoredPlace(name) {
  const key = foldName(name)
  if (!key || NOT_A_WARNING_PLACE.has(key)) return true
  return isNonPlaceNoun(name) || isRejectedPlace(name)
}

function sourceOf(shot) {
  const what = cleanText(shot.what || '')
  const action = cleanText(shot.action || '')
  if (!what || !action || what.toLowerCase() === action.toLowerCase()) return what || action
  const whatKey = what.toLowerCase()
  const actionKey = action.toLowerCase()
  if (actionKey.includes(whatKey)) return action
  if (whatKey.includes(actionKey)) return what
  return `${what} ${action}`
}

/** Hands, a hand-off, or a held object. The camera word "handheld" does not count. */
export function shotInvolvesHands(shot = {}) {
  const source = [shot.what, shot.action, shot.notes, shot.title].filter(Boolean).join('\n')
  if (!source) return false
  if (HAND_DIRECT.test(source) || HAND_TRANSFER.test(source)) return true
  return HAND_WITH_OBJECT.test(source) && HELD_OBJECT.test(source)
}

function userText(shot, project) {
  const prompt = String(shot.prompt || '').replace(/No captions, titles, logos or watermarks\.?/gi, '')
  return [project.premise, shot.what, shot.action, shot.title, prompt].filter(Boolean).join('\n')
}

function unresolved(shot, project) {
  const sheet = project.filmSheet
  if (!sheet) return []
  const found = []
  nameParts(shot.who).forEach(name => {
    if (name && !findByName(sheet.characters, name)) found.push(warning(shot, 'unresolved_character', `${name} is not on the film sheet.`, `Add ${name} to the characters, or use a name that is already there.`))
  })
  nameParts(shot.where).forEach(name => {
    if (name && !ignoredPlace(name) && !findByName(sheet.places, name)) found.push(warning(shot, 'unresolved_place', `${name} is not on the film sheet.`, `Add ${name} to the places, or use a place that is already there.`))
  })
  return found
}

export function assessShot(shot, project = {}) {
  const warnings = []
  const source = sourceOf(shot)
  const duration = Number(shot.duration_seconds || shot.duration || project.duration || 3)
  ACTION_VERBS.lastIndex = 0
  const verbs = source.match(ACTION_VERBS) || []
  if (duration <= 4 && (verbs.length >= 2 || /\b(and then|puis)\b/i.test(source))) {
    const canSplit = splitActionText(source).length >= 2
    warnings.push(warning(shot, 'too_many_actions', 'This short shot asks for more than one action.', canSplit ? 'Split it so each new shot has one action.' : 'Keep one action in this shot and move the next beat to a new shot.', canSplit ? { fixId: 'split-shot' } : {}))
  }
  const profile = profileFor(project.model || project.target_model)
  const quoted = /[«"][^"»]{2,}[»"]/.test(source)
  if (TEXT_ON_SCREEN.test(source) || (quoted && !profile?.dialogueQuotes)) {
    warnings.push(warning(shot, 'on_screen_text', 'On-screen text is easy for a video model to misspell.', 'Describe the scene without words, titles, or captions in the frame.'))
  }
  const allowed = allowedDurations(profile)
  if (allowed && !allowed.includes(duration)) {
    warnings.push(warning(shot, 'duration_unsupported', `This clip is ${duration}s. ${profile.label} accepts ${allowed.join(', ')} seconds.`, `Set this shot to ${allowed.join(', ')} seconds.`))
  }
  const aspect = project.aspectRatio
  if (profile && Array.isArray(profile.aspects) && aspect && snapAspect(aspect, profile) !== aspect && shot.order === 1) {
    warnings.push(warning(shot, 'aspect_unsupported', `${profile.label} does not list ${aspect}.`, `Use ${snapAspect(aspect, profile)} for this model.`))
  }
  ;(profile?.weakSpots || []).forEach(item => {
    if (item.when === 'duration>=8' && duration >= 8) warnings.push(warning(shot, item.code, item.message, item.fix))
    if (!item.when && item.code !== 'veo_people_region' && item.code !== 'wan_prompt_extend' && item.code !== 'hailuo_prompt_optimizer') warnings.push(warning(shot, item.code, item.message, item.fix))
  })
  if (profile && shot.order === 1) {
    for (const code of ['wan_prompt_extend', 'hailuo_prompt_optimizer']) {
      const item = profile.weakSpots.find(spot => spot.code === code)
      if (item) warnings.push(warning(shot, item.code, item.message, item.fix))
    }
  }
  if (profile && Number.isFinite(profile.maxPromptLength) && String(shot.prompt || '').length > profile.maxPromptLength) {
    warnings.push(warning(shot, 'prompt_too_long', `This prompt is longer than the ${profile.maxPromptLength} characters ${profile.label} documents.`, 'Shorten the prompt before you paste it.'))
  }
  const sizeInAction = mentionedFraming(`${shot.what || ''}\n${shot.action || ''}`)
  if (sizeInAction) {
    const chosen = suggestFraming(shot)
    const same = chosen.id === sizeInAction.term.id
    warnings.push(warning(
      shot,
      'shot_size_in_action',
      same
        ? `The action already states the shot size “${sizeInAction.raw}”. The prompt uses that size once.`
        : `The action states “${sizeInAction.raw}” (${sizeInAction.term.label}) and the shot framing is ${chosen.label}. The prompt uses ${sizeInAction.term.label} once.`,
      'Keep one shot size. Remove it from the action, or set framing to that size.'
    ))
  }
  if (CROWD.test(source)) {
    warnings.push(warning(shot, 'crowd', 'A crowd is hard to keep stable in a short clip.', 'Show one or two people instead of a crowd.'))
  }
  if (shotInvolvesHands(shot)) {
    warnings.push(warning(shot, 'hands_or_held_object', 'Hands or a held object are easy for a video model to melt or change shape.', 'Keep the hands simple, and say the held object stays the same shape.'))
  }
  const named = new Set([
    ...nameParts(shot.who).map(name => name.toLowerCase()),
    ...(project.filmSheet?.characters || []).filter(character => new RegExp(`\\b${character.name}\\b`, 'i').test(source)).map(character => character.name.toLowerCase())
  ].filter(Boolean))
  if (named.size > 2) {
    warnings.push(warning(shot, 'too_many_characters', 'More than two people in one short shot is hard to keep consistent.', 'Keep at most two people in this shot.'))
  }
  const camera = `${shot.camera || ''} ${shot.framing || ''}`
  CAMERA_CONFLICTS.forEach(([left, right, label]) => {
    if (left.test(camera) && right.test(camera)) {
      warnings.push(warning(shot, 'conflicting_camera', `The camera asks for ${label} in the same shot.`, 'Pick one camera move for this shot.'))
    }
  })
  warnings.push(...unresolved(shot, project))
  const text = userText(shot, project)
  const lower = text.toLowerCase()
  const celebrity = CELEBRITIES.find(name => lower.includes(name))
  if (celebrity) warnings.push(warning(shot, 'celebrity', `A public figure (${celebrity}) is hard for a video model to depict accurately.`, 'Describe a fictional person instead of a named celebrity.'))
  if (GORE.test(text)) warnings.push(warning(shot, 'gore', 'Gore and injury are unstable in a short clip and may be blocked.', 'Show the aftermath or the tension without blood or injury.'))
  if (BRAND_LOGO.test(text) || BRANDS.some(name => containsPhrase(text, name))) warnings.push(warning(shot, 'brand_logo', 'A logo or brand mark is easy for a video model to misspell.', 'Describe the object without a logo, wordmark, or brand name in the frame.'))
  if (COPYRIGHT.test(text)) warnings.push(warning(shot, 'copyrighted_character', 'Copyrighted characters are a poor fit for a generated clip.', 'Invent an original character instead of a known franchise character.'))
  const extra = continuityWarnings(shot, project)
  const covered = warnings.some(item => item.code === 'too_many_actions')
  extra.forEach(item => {
    if (covered && item.code === 'several_actions') return
    warnings.push(item)
  })
  return warnings
}

function emptyCastWarnings(project) {
  const sheet = project?.filmSheet
  if (!sheet) return []
  const shots = project.shots || []
  const anchor = shots[0] || { id: project.id || 'board', order: 1 }
  const warnings = []
  const people = (sheet.characters || []).filter(item => cleanText(item?.name))
  const places = (sheet.places || []).filter(item => cleanText(item?.name))
  if (!people.length) warnings.push(warning(anchor, 'empty_characters', 'This board has no character.', 'Send characters with name, look, and outfit.'))
  if (!places.length) warnings.push(warning(anchor, 'empty_places', 'This board has no place.', 'Send places with name and description.'))
  if (project.sequenceMode === 'scenario') {
    shots.forEach(shot => {
      if (!cleanText(shot.who)) warnings.push(warning(shot, 'empty_who', 'This shot has no character.', 'Set who to a name, or to a list of names, from the cast.'))
      if (!cleanText(shot.where)) warnings.push(warning(shot, 'empty_where', 'This shot has no place.', 'Set where to a place from the sheet.'))
    })
  }
  return warnings
}

export function assessProject(project) {
  const shots = project?.shots || []
  const ranges = shots.length ? partitionShots(shots) : []
  const warnings = ranges.flatMap(range => shots.slice(range.start, range.end).flatMap(shot => assessShot(shot, project)))
  warnings.push(...emptyCastWarnings(project))
  warnings.push(...partJoinWarnings(project))
  const seen = new Set()
  return warnings.filter(item => {
    if (item.code !== 'sora_long_clip') return true
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}
