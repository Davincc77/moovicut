/** Deterministic pre-generation checks. Warnings never block a board. */
import { findByName, foldName, nameParts } from './scenario.js'
import { allowedDurations, profileFor, snapAspect } from './model-profiles.js'

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
const CAMERA_CONFLICTS = [
  [/\bpush(?:-|\s)?in\b/i, /\bpull(?:-|\s)?(?:out|back)\b/i, 'push-in and pull-back'],
  [/\bzoom in\b/i, /\bzoom out\b/i, 'zoom in and zoom out'],
  [/\b(static|locked-off|locked off)\b/i, /\bhandheld\b/i, 'a locked camera and a handheld camera'],
  [/\bpan left\b/i, /\bpan right\b/i, 'pan left and pan right']
]

function warning(shot, code, message, fix) {
  return { shotId: shot.id || shot.shot_id, order: shot.order, code, message, fix }
}

function sourceOf(shot) {
  return [shot.what, shot.action].filter(Boolean).join(' ')
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
    if (name && !findByName(sheet.places, name)) found.push(warning(shot, 'unresolved_place', `${name} is not on the film sheet.`, `Add ${name} to the places, or use a place that is already there.`))
  })
  return found
}

export function assessShot(shot, project = {}) {
  const warnings = []
  const source = sourceOf(shot)
  const duration = Number(shot.duration_seconds || shot.duration || project.duration || 3)
  const verbs = source.match(ACTION_VERBS) || []
  if (duration <= 4 && (verbs.length >= 2 || /\b(and then|puis)\b/i.test(source))) {
    warnings.push(warning(shot, 'too_many_actions', 'This short shot asks for more than one action.', 'Keep one action in this shot and move the next beat to a new shot.'))
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
    if (!item.when && item.code !== 'veo_people_region' && item.code !== 'wan_prompt_extend') warnings.push(warning(shot, item.code, item.message, item.fix))
  })
  if (profile?.id === 'wan' && shot.order === 1) {
    const extend = profile.weakSpots.find(item => item.code === 'wan_prompt_extend')
    if (extend) warnings.push(warning(shot, extend.code, extend.message, extend.fix))
  }
  if (profile && Number.isFinite(profile.maxPromptLength) && String(shot.prompt || '').length > profile.maxPromptLength) {
    warnings.push(warning(shot, 'prompt_too_long', `This prompt is longer than the ${profile.maxPromptLength} characters ${profile.label} documents.`, 'Shorten the prompt before you paste it.'))
  }
  if (CROWD.test(source)) {
    warnings.push(warning(shot, 'crowd', 'A crowd is hard to keep stable in a short clip.', 'Show one or two people instead of a crowd.'))
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
  return warnings
}

export function assessProject(project) {
  const warnings = (project?.shots || []).flatMap(shot => assessShot(shot, project))
  const seen = new Set()
  return warnings.filter(item => {
    if (item.code !== 'sora_long_clip') return true
    if (seen.has(item.code)) return false
    seen.add(item.code)
    return true
  })
}
