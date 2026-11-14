/** Deterministic pre-generation checks. Warnings never block a board. */
import { findByName, nameParts } from './scenario.js'
import { allowedDurations, profileFor, snapAspect } from './model-profiles.js'

const ACTION_VERBS = /\b(pours|pour|spills|spill|laughs|laugh|runs|run|opens|open|walks|walk|enters|enter|leaves|leave|rides|ride|turns|turn|verse|renverse|rit|court|entre|sort|marche|revient|ouvre)\b/gi
const TEXT_ON_SCREEN = /\b(title card|subtitle|subtitles|caption|captions|logo|on-screen text|onscreen text|écrit|ecrit|sign reads|text reading|words on screen)\b/i
const CROWD = /\b(crowd|crowds|army|armies|dozens|hundreds|foule|foules)\b/i
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
  return warnings
}

export function assessProject(project) {
  return (project?.shots || []).flatMap(shot => assessShot(shot, project))
}
