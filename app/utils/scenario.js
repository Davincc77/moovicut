/** Deterministic scenario intake. No model call. */
import { cleanText } from './text.js'

export const CHARS_PER_MINUTE = 1500
export const SCENARIO_WARN_AT = 6000
export const SCENARIO_MAX_CHARS = 8000
export const SEQUENCE_MIN_SECONDS = 15
export const SEQUENCE_MAX_SECONDS = 60
export const MAX_SCENARIO_SCENES = 48
export const SCENARIO_EXAMPLE = 'Scène 3 — Léa — Café — Elle renverse son latte et rit.'

export const CAMERAS = Object.freeze({
  wide: { framing: 'Extreme wide establishing shot', camera: 'Slow lateral move', lens: '24mm wide-angle lens' },
  medium: { framing: 'Medium shot', camera: 'Gentle tracking at eye level', lens: '35mm lens' },
  close: { framing: 'Close-up', camera: 'Slow push-in', lens: '85mm lens' },
  insert: { framing: 'Close-up insert', camera: 'Precise slow push-in', lens: '85mm lens' },
  tracking: { framing: 'Full-body lateral tracking shot', camera: 'Measured dolly alongside', lens: '32mm lens' },
  static: { framing: 'Wide locked-off frame', camera: 'Locked-off camera', lens: '35mm lens' },
  push: { framing: 'Medium close-up', camera: 'Slow push-in', lens: '50mm lens' },
  crane: { framing: 'Wide shot', camera: 'Slow crane', lens: '24mm lens' },
  handheld: { framing: 'Medium handheld shot', camera: 'Handheld at eye level', lens: '35mm lens' }
})
export const CAMERA_VALUES = Object.freeze(Object.keys(CAMERAS))

export const LIGHTS = Object.freeze({
  day: 'bright natural daylight',
  dawn: 'dawn light, cool blue shadows warming into soft gold',
  dusk: 'dusk light, warm amber and deep shadows',
  night: 'night, deep navy and sparse practical lights',
  warm: 'warm practical light',
  cool: 'cool diffused light',
  hard: 'hard directional light and crisp shadows',
  soft: 'soft diffused light',
  neon: 'neon practicals and wet reflections',
  practical: 'practical lamps as the key light'
})
export const LIGHT_VALUES = Object.freeze(Object.keys(LIGHTS))

export const MOODS = Object.freeze({
  grounded: 'Grounded and clear',
  playful: 'Playful and light',
  tense: 'Tense and restrained',
  intimate: 'Intimate and close',
  bold: 'Bold and direct',
  quiet: 'Quiet and held',
  hopeful: 'Hopeful and open',
  uneasy: 'Uneasy and still'
})
export const MOOD_VALUES = Object.freeze(Object.keys(MOODS))

const HEADER = Object.freeze({
  characters: /^(?:characters|personnages)\s*:?$/i,
  places: /^(?:places|lieux)\s*:?$/i,
  scenes: /^(?:scenes|scènes|scènes|story)\s*:?$/i,
  style: /^style\s*:?$/i
})

function problem(message, extra = {}) {
  return { message, ...extra }
}

export function foldName(value) {
  return cleanText(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function findByName(list, name) {
  const folded = foldName(name)
  if (!folded) return null
  return (list || []).find(item => foldName(item.name) === folded) || null
}

export function nameParts(value) {
  return cleanText(value).split(/\s*(?:,|&|\/|\band\b|\bet\b)\s*/i).map(part => part.trim()).filter(Boolean)
}

export function splitParts(line) {
  const source = String(line || '').trim()
  const divider = source.includes('—') ? '—' : source.includes('–') ? '–' : source.includes('|') ? '|' : null
  const parts = (divider ? source.split(divider) : source.split(/\s+-\s+/)).map(part => part.trim()).filter(Boolean)
  return parts
}

export function looksLikeScenario(value) {
  const text = String(value || '').replace(/\r\n/g, '\n')
  return /(?:^|\n)\s*(?:characters|personnages)\s*:?\s*(?:\n|$)/i.test(text)
    && /(?:^|\n)\s*(?:places|lieux)\s*:?\s*(?:\n|$)/i.test(text)
    && /(?:^|\n)\s*(?:scenes|scènes|story)\s*:?\s*(?:\n|$)/i.test(text)
}

function linesOf(text) {
  return String(text || '').replace(/\r\n/g, '\n').split('\n').map((raw, index) => ({ line: index + 1, text: raw.trim() }))
}

function tooLong(value, max, line, section, field, label) {
  if ([...String(value || '')].length <= max) return null
  return problem(`Line ${line} ${label} is too long. Keep it under ${max} characters.`, { line, section, field })
}

function parseCharacterLine(text, line) {
  const parts = splitParts(text)
  const errors = []
  if (!parts[0]) errors.push(problem(`Line ${line} is missing a name. Write: Name — look — outfit.`, { line, section: 'characters', field: 'name' }))
  if (!parts[1]) errors.push(problem(`Line ${line} is missing a look. Write: Name — look — outfit.`, { line, section: 'characters', field: 'look' }))
  if (!parts[2]) errors.push(problem(`Line ${line} is missing an outfit. Write: Name — look — outfit.`, { line, section: 'characters', field: 'outfit' }))
  if (parts.length > 3) errors.push(problem(`Line ${line} has extra parts. Use exactly: Name — look — outfit.`, { line, section: 'characters', field: 'outfit' }))
  if (errors.length) return { errors }
  const character = { name: cleanText(parts[0]), look: cleanText(parts[1]), outfit: cleanText(parts[2]) }
  for (const item of [
    tooLong(character.name, 80, line, 'characters', 'name', 'name'),
    tooLong(character.look, 300, line, 'characters', 'look', 'look'),
    tooLong(character.outfit, 200, line, 'characters', 'outfit', 'outfit')
  ]) if (item) errors.push(item)
  return errors.length ? { errors } : { character }
}

function parsePlaceLine(text, line) {
  const parts = splitParts(text)
  const errors = []
  if (!parts[0]) errors.push(problem(`Line ${line} is missing a place name. Write: Name — short description.`, { line, section: 'places', field: 'name' }))
  if (!parts[1]) errors.push(problem(`Line ${line} is missing a description. Write: Name — short description.`, { line, section: 'places', field: 'description' }))
  if (parts.length > 2) errors.push(problem(`Line ${line} has extra parts. Use exactly: Name — short description.`, { line, section: 'places', field: 'description' }))
  if (errors.length) return { errors }
  const place = { name: cleanText(parts[0]), description: cleanText(parts[1]) }
  for (const item of [
    tooLong(place.name, 80, line, 'places', 'name', 'name'),
    tooLong(place.description, 300, line, 'places', 'description', 'description')
  ]) if (item) errors.push(item)
  return errors.length ? { errors } : { place }
}

function parseSceneLine(text, line) {
  const parts = splitParts(text)
  let rest = parts
  let number = null
  if (parts[0] && /^(?:scène|scene)\s+\d+$/i.test(parts[0])) {
    number = Number(parts[0].match(/\d+/)[0])
    rest = parts.slice(1)
  } else if (parts[0] && /^\d+$/.test(parts[0])) {
    number = Number(parts[0])
    rest = parts.slice(1)
  }
  const errors = []
  if (!rest[0]) errors.push(problem(`Line ${line} is missing who. Write: Scène 3 — Léa — Café — what happens.`, { line, section: 'scenes', field: 'who' }))
  if (!rest[1]) errors.push(problem(`Line ${line} is missing where. Write: Scène 3 — Léa — Café — what happens.`, { line, section: 'scenes', field: 'where' }))
  const what = cleanText(rest.slice(2).join(' — '))
  if (!what) errors.push(problem(`Line ${line} is missing what happens. Write: Scène 3 — Léa — Café — what happens.`, { line, section: 'scenes', field: 'what' }))
  if (errors.length) return { errors }
  const scene = { number, who: cleanText(rest[0]), where: cleanText(rest[1]), what, line }
  for (const item of [
    tooLong(scene.who, 120, line, 'scenes', 'who', 'character'),
    tooLong(scene.where, 120, line, 'scenes', 'where', 'place'),
    tooLong(scene.what, 400, line, 'scenes', 'what', 'action')
  ]) if (item) errors.push(item)
  return errors.length ? { errors } : { scene }
}

function headerOf(text) {
  for (const [name, pattern] of Object.entries(HEADER)) if (pattern.test(text)) return name
  return ''
}

export function parseCharacterBlock(text) {
  const characters = []
  const errors = []
  linesOf(text).forEach(entry => {
    if (!entry.text || headerOf(entry.text) === 'characters') return
    const parsed = parseCharacterLine(entry.text, entry.line)
    if (parsed.errors) errors.push(...parsed.errors)
    else characters.push(parsed.character)
  })
  return { characters, errors }
}

export function parsePlaceBlock(text) {
  const places = []
  const errors = []
  linesOf(text).forEach(entry => {
    if (!entry.text || headerOf(entry.text) === 'places') return
    const parsed = parsePlaceLine(entry.text, entry.line)
    if (parsed.errors) errors.push(...parsed.errors)
    else places.push(parsed.place)
  })
  return { places, errors }
}

export function parseSceneBlock(text) {
  const scenes = []
  const errors = []
  linesOf(text).forEach(entry => {
    if (!entry.text || headerOf(entry.text) === 'scenes') return
    const parsed = parseSceneLine(entry.text, entry.line)
    if (parsed.errors) errors.push(...parsed.errors)
    else scenes.push(parsed.scene)
  })
  return { scenes, errors }
}

function finish(characters, places, scenes, light, mood, errors, sourceText) {
  const seenCharacters = new Set()
  characters.forEach((character, index) => {
    const key = foldName(character.name)
    if (seenCharacters.has(key)) errors.push(problem(`The name ${character.name} is repeated. Use each character name once.`, { section: 'characters', field: 'name', index }))
    seenCharacters.add(key)
  })
  const seenPlaces = new Set()
  places.forEach(place => {
    const key = foldName(place.name)
    if (seenPlaces.has(key)) errors.push(problem(`The place ${place.name} is repeated. Use each place name once.`, { section: 'places', field: 'name' }))
    seenPlaces.add(key)
  })
  if (!characters.length) errors.push(problem('Add at least one character: Name — look — outfit.', { section: 'characters', field: 'name' }))
  if (!places.length) errors.push(problem('Add at least one place: Name — short description.', { section: 'places', field: 'name' }))
  if (!scenes.length) errors.push(problem('Add at least one scene line: Scène 1 — who — where — what happens.', { section: 'scenes', field: 'what' }))
  if (scenes.length > MAX_SCENARIO_SCENES) errors.push(problem(`A storyboard can include at most ${MAX_SCENARIO_SCENES} scenes.`, { section: 'scenes', field: 'scenes' }))
  const text = formatScenario({ characters, places, scenes, light, mood })
  const counted = String(sourceText || text)
  const duration = scenes.reduce((sum, scene) => sum + (scene.duration || 3), 0)
  const budget = scenarioBudget(counted, duration)
  if (budget.status === 'over') errors.push(problem(budget.message, { section: 'scenario', field: 'length' }))
  const premise = scenarioPremise({ characters, places, scenes })
  return {
    ok: errors.length === 0,
    errors,
    characters,
    places,
    scenes,
    light: light || '',
    mood: mood || '',
    text,
    premise,
    budget
  }
}

export function scenarioBudget(text, durationSeconds) {
  const length = String(text || '').length
  const seconds = Math.max(0, Number(durationSeconds) || 0)
  const minutes = seconds / 60
  const suggested = Math.max(1, Math.round(CHARS_PER_MINUTE * (minutes || 1)))
  const film = seconds ? (seconds < 60 ? `${seconds}s` : `${Math.round(minutes * 10) / 10} min`) : 'this film'
  let status = 'ok'
  let message = `About 1,500 characters per minute. This film is ${film}, so aim for about ${suggested}. You are at ${length}.`
  if (length > SCENARIO_MAX_CHARS) {
    status = 'over'
    message = `This scenario is ${length} characters. Keep it under 8,000 so it stays easy to paste and generate. About 1,500 characters per minute is enough.`
  } else if (length >= SCENARIO_WARN_AT) {
    status = 'warn'
    message = `This scenario is ${length} characters. It still works. Shorter input is easier to generate. Aim for about ${suggested} characters for this film.`
  }
  return { length, suggested, seconds, status, message, limit: SCENARIO_MAX_CHARS, warnAt: SCENARIO_WARN_AT }
}

export function scenarioPremise(parsed) {
  const who = (parsed.characters || []).map(item => item.name).filter(Boolean).join(', ')
  const where = (parsed.places || []).map(item => item.name).filter(Boolean).join(', ')
  const what = parsed.scenes?.[0]?.what || ''
  const text = cleanText(`${who} at ${where}. ${what}`)
  if (text.length >= 8) return text.slice(0, 6000)
  return cleanText(`${who} ${where} ${what}`).slice(0, 6000)
}

export function formatScenario({ characters = [], places = [], scenes = [], light = '', mood = '' } = {}) {
  const lines = ['CHARACTERS']
  characters.forEach(character => lines.push(`${character.name} — ${character.look} — ${character.outfit}`))
  lines.push('', 'PLACES')
  places.forEach(place => lines.push(`${place.name} — ${place.description}`))
  if (light || mood) {
    lines.push('', 'STYLE')
    if (light) lines.push(`light: ${light}`)
    if (mood) lines.push(`mood: ${mood}`)
  }
  lines.push('', 'SCENES')
  scenes.forEach((scene, index) => {
    const number = scene.number || index + 1
    lines.push(`Scène ${number} — ${scene.who} — ${scene.where} — ${scene.what}`)
  })
  return lines.join('\n')
}

export function composeScenarioText({ characters = '', places = '', scenes = '', light = '', mood = '' } = {}) {
  const lines = ['CHARACTERS', String(characters || '').trim(), '', 'PLACES', String(places || '').trim(), '']
  if (light || mood) {
    lines.push('STYLE')
    if (light) lines.push(`light: ${light}`)
    if (mood) lines.push(`mood: ${mood}`)
    lines.push('')
  }
  lines.push('SCENES', String(scenes || '').trim())
  return lines.join('\n')
}

export function scenarioFieldsFromText(text) {
  const fields = { characters: [], places: [], scenes: [], light: '', mood: '' }
  let section = ''
  linesOf(text).forEach(entry => {
    const header = headerOf(entry.text)
    if (header) { section = header; return }
    if (!entry.text || !section) return
    if (section === 'style') {
      const light = entry.text.match(/^(?:light|lighting)\s*:\s*(.+)$/i)
      const mood = entry.text.match(/^mood\s*:\s*(.+)$/i)
      if (light) fields.light = cleanText(light[1]).toLowerCase()
      else if (mood) fields.mood = cleanText(mood[1]).toLowerCase()
      return
    }
    fields[section].push(entry.text)
  })
  return {
    characters: fields.characters.join('\n'),
    places: fields.places.join('\n'),
    scenes: fields.scenes.join('\n'),
    light: fields.light,
    mood: fields.mood
  }
}

function enumError(value, allowed, label, extra) {
  return problem(`${label} must be one of: ${allowed.join(', ')}.`, { ...extra, field: label, value })
}

function readEnum(value, allowed, label, extra, errors) {
  if (value == null || value === '') return ''
  const token = cleanText(value).toLowerCase()
  if (!allowed.includes(token)) errors.push(enumError(token, allowed, label, extra))
  return allowed.includes(token) ? token : ''
}

function readDuration(value, extra, errors) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 2 || number > 15) {
    errors.push(problem('Duration must be a whole number from 2 to 15 seconds.', { ...extra, field: 'duration' }))
    return null
  }
  return number
}

function parseScenarioText(text) {
  const characters = []
  const places = []
  const scenes = []
  const errors = []
  let light = ''
  let mood = ''
  let section = ''
  linesOf(text).forEach(entry => {
    if (!entry.text) return
    const header = headerOf(entry.text)
    if (header) { section = header; return }
    if (!section) {
      errors.push(problem(`Line ${entry.line} is outside a block. Start with CHARACTERS, PLACES, or SCENES.`, { line: entry.line, section: 'scenario', field: 'block' }))
      return
    }
    if (section === 'characters') {
      const parsed = parseCharacterLine(entry.text, entry.line)
      if (parsed.errors) errors.push(...parsed.errors)
      else characters.push(parsed.character)
    } else if (section === 'places') {
      const parsed = parsePlaceLine(entry.text, entry.line)
      if (parsed.errors) errors.push(...parsed.errors)
      else places.push(parsed.place)
    } else if (section === 'scenes') {
      const parsed = parseSceneLine(entry.text, entry.line)
      if (parsed.errors) errors.push(...parsed.errors)
      else scenes.push(parsed.scene)
    } else if (section === 'style') {
      const lightMatch = entry.text.match(/^(?:light|lighting)\s*:\s*(.+)$/i)
      const moodMatch = entry.text.match(/^mood\s*:\s*(.+)$/i)
      if (lightMatch) light = readEnum(lightMatch[1], LIGHT_VALUES, 'light', { line: entry.line, section: 'style' }, errors) || light
      else if (moodMatch) mood = readEnum(moodMatch[1], MOOD_VALUES, 'mood', { line: entry.line, section: 'style' }, errors) || mood
      else errors.push(problem(`Line ${entry.line} is not a style field. Use light or mood.`, { line: entry.line, section: 'style', field: 'style' }))
    }
  })
  return finish(characters, places, scenes, light, mood, errors, text)
}

function pick(object, keys) {
  for (const key of keys) {
    const value = object?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function parseScenarioObject(input) {
  const errors = []
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : null
  if (!source) {
    return finish([], [], [], '', '', [problem('Send the scenario as text, or as an object with characters, places, and scenes.', { section: 'scenario', field: 'scenario' })], '')
  }
  const characters = []
  const characterList = Array.isArray(source.characters) ? source.characters : null
  if (!characterList) errors.push(problem('characters must be a list.', { path: 'characters', section: 'characters', field: 'characters' }))
  ;(characterList || []).forEach((entry, index) => {
    const path = `characters[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(problem(`${path} must be an object with name, look, and outfit.`, { path, section: 'characters', field: 'name' }))
      return
    }
    const name = cleanText(pick(entry, ['name', 'n']))
    const look = cleanText(pick(entry, ['look', 'l']))
    const outfit = cleanText(pick(entry, ['outfit', 'o']))
    if (!name) errors.push(problem(`${path} is missing a name.`, { path: `${path}.name`, section: 'characters', field: 'name', index }))
    if (!look) errors.push(problem(`${path} is missing a look.`, { path: `${path}.look`, section: 'characters', field: 'look', index }))
    if (!outfit) errors.push(problem(`${path} is missing an outfit.`, { path: `${path}.outfit`, section: 'characters', field: 'outfit', index }))
    if (name && look && outfit) characters.push({ name, look, outfit })
  })
  const places = []
  const placeList = Array.isArray(source.places) ? source.places : null
  if (!placeList) errors.push(problem('places must be a list.', { path: 'places', section: 'places', field: 'places' }))
  ;(placeList || []).forEach((entry, index) => {
    const path = `places[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(problem(`${path} must be an object with name and description.`, { path, section: 'places', field: 'name' }))
      return
    }
    const name = cleanText(pick(entry, ['name', 'n']))
    const description = cleanText(pick(entry, ['description', 'desc', 'd']))
    if (!name) errors.push(problem(`${path} is missing a name.`, { path: `${path}.name`, section: 'places', field: 'name', index }))
    if (!description) errors.push(problem(`${path} is missing a description.`, { path: `${path}.description`, section: 'places', field: 'description', index }))
    if (name && description) places.push({ name, description })
  })
  const light = readEnum(source.light ?? source.lighting, LIGHT_VALUES, 'light', { path: 'light', section: 'style' }, errors)
  const mood = readEnum(source.mood, MOOD_VALUES, 'mood', { path: 'mood', section: 'style' }, errors)
  const scenes = []
  const sceneList = Array.isArray(source.scenes) ? source.scenes : null
  if (!sceneList) errors.push(problem('scenes must be a list.', { path: 'scenes', section: 'scenes', field: 'scenes' }))
  ;(sceneList || []).forEach((entry, index) => {
    const path = `scenes[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(problem(`${path} must be an object with who, where, and what.`, { path, section: 'scenes', field: 'what', index }))
      return
    }
    const who = cleanText(pick(entry, ['who', 'w', 'character']))
    const where = cleanText(pick(entry, ['where', 'at', 'place']))
    const what = cleanText(pick(entry, ['what', 'do', 'action', 'beat']))
    if (!who) errors.push(problem(`${path} is missing who.`, { path: `${path}.who`, section: 'scenes', field: 'who', index }))
    if (!where) errors.push(problem(`${path} is missing where.`, { path: `${path}.where`, section: 'scenes', field: 'where', index }))
    if (!what) errors.push(problem(`${path} is missing what happens.`, { path: `${path}.what`, section: 'scenes', field: 'what', index }))
    const camera = readEnum(entry.camera ?? entry.cam, CAMERA_VALUES, 'camera', { path: `${path}.camera`, section: 'scenes', index }, errors)
    const sceneLight = readEnum(entry.light ?? entry.lighting, LIGHT_VALUES, 'light', { path: `${path}.light`, section: 'scenes', index }, errors)
    const sceneMood = readEnum(entry.mood, MOOD_VALUES, 'mood', { path: `${path}.mood`, section: 'scenes', index }, errors)
    const duration = readDuration(entry.duration ?? entry.s, { path: `${path}.duration`, section: 'scenes', index }, errors)
    const prompt = typeof entry.prompt === 'string' ? entry.prompt.trim().slice(0, 16000) : ''
    if (who && where && what) scenes.push({ number: index + 1, who, where, what, line: index + 1, camera, light: sceneLight, mood: sceneMood, duration, prompt })
  })
  const canonical = formatScenario({ characters, places, scenes, light, mood })
  return finish(characters, places, scenes, light, mood, errors, canonical)
}

export function parseScenario(input) {
  if (typeof input === 'string') return parseScenarioText(input)
  if (input && typeof input === 'object' && !Array.isArray(input) && typeof input.text === 'string' && !input.characters) return parseScenarioText(input.text)
  return parseScenarioObject(input)
}

export function agentScenarioPrompt(idea = '') {
  const trimmed = String(idea || '').trim()
  return [
    'Turn the idea below into a Moovicut scenario. Reply with only the scenario. No preamble.',
    '',
    'CHARACTERS',
    'Name — look — outfit',
    '',
    'PLACES',
    'Name — short description',
    '',
    'SCENES',
    'Scène 1 — Name — Place — what happens in one line.',
    SCENARIO_EXAMPLE,
    '',
    'Rules:',
    '- One character per line: name, look, and outfit, separated by an em dash (—).',
    '- One place per line: name and a short description, separated by an em dash.',
    '- One scene per line: Scène N — who — where — what happens.',
    '- Use only character and place names from the blocks above.',
    '- One action per scene. No on-screen text. No crowds.',
    '- About 1,500 characters per minute of film, and never more than 8,000 characters.',
    '- Optional STYLE block, one word each:',
    `  light: ${LIGHT_VALUES.join(', ')}`,
    `  mood: ${MOOD_VALUES.join(', ')}`,
    '',
    'My idea:',
    trimmed || '(paste the idea here)'
  ].join('\n')
}

function sumDuration(items) {
  return items.reduce((total, item) => total + (Number(item.duration) || 3), 0)
}

export function packSequences(scenes) {
  const items = (scenes || []).map((scene, index) => ({ index, duration: Math.max(2, Math.min(15, Number(scene.duration || scene.duration_seconds) || 3)) }))
  if (!items.length) return []
  const groups = []
  let current = []
  for (const item of items) {
    if (current.length && sumDuration(current) + item.duration > SEQUENCE_MAX_SECONDS) {
      groups.push(current)
      current = []
    }
    current.push(item)
  }
  if (current.length) groups.push(current)
  if (groups.length >= 2) {
    const last = groups[groups.length - 1]
    const previous = groups[groups.length - 2]
    while (sumDuration(last) < SEQUENCE_MIN_SECONDS && previous.length > 1) {
      const moved = previous[previous.length - 1]
      if (sumDuration(previous) - moved.duration < SEQUENCE_MIN_SECONDS) break
      if (sumDuration(last) + moved.duration > SEQUENCE_MAX_SECONDS) break
      previous.pop()
      last.unshift(moved)
    }
  }
  return groups.map((group, index) => {
    const duration = sumDuration(group)
    return {
      order: index + 1,
      duration,
      label: `${duration}s`,
      withinPreset: duration >= SEQUENCE_MIN_SECONDS && duration <= SEQUENCE_MAX_SECONDS,
      shotOrders: group.map(item => item.index + 1)
    }
  })
}

export function sequencePacks(project) {
  const shots = project?.shots || []
  return packSequences(shots).map(sequence => ({
    ...sequence,
    shotIds: sequence.shotOrders.map(order => shots[order - 1]?.shot_id || shots[order - 1]?.id).filter(Boolean),
    export: sequence.shotOrders.map(order => shots[order - 1]?.prompt || '').filter(Boolean).join('\n\n')
  }))
}

export function describeCast(who, characters) {
  const parts = nameParts(who)
  if (!parts.length) return ''
  return parts.map(part => {
    const match = findByName(characters, part)
    if (!match) return part
    const worn = match.outfit ? `, wearing ${match.outfit}` : ''
    const look = match.look ? `${match.look}${worn}` : (match.outfit ? `wearing ${match.outfit}` : '')
    return look ? `${match.name} (${look})` : match.name
  }).join(' and ')
}

export function describePlace(where, places) {
  const parts = nameParts(where)
  if (!parts.length) return ''
  return parts.map(part => {
    const match = findByName(places, part)
    return match ? `${match.name} (${match.description})` : part
  }).join(' and ')
}

export function scenarioFromProject(project) {
  if (!project?.filmSheet?.characters?.length || !project?.filmSheet?.places?.length) return null
  return {
    characters: project.filmSheet.characters.map(item => ({ name: item.name, look: item.look, outfit: item.outfit })),
    places: project.filmSheet.places.map(item => ({ name: item.name, description: item.description })),
    light: project.filmSheet.light || '',
    mood: project.filmSheet.mood || '',
    scenes: (project.shots || []).map((shot, index) => {
      const scene = {
        who: shot.who || '',
        where: shot.where || '',
        what: shot.what || shot.action || ''
      }
      if (shot.cam) scene.camera = shot.cam
      if (shot.light) scene.light = shot.light
      if (shot.mood) scene.mood = shot.mood
      if (shot.duration) scene.duration = shot.duration
      if (!scene.who) scene.who = project.filmSheet.characters[0]?.name || `Character ${index + 1}`
      if (!scene.where) scene.where = project.filmSheet.places[0]?.name || `Place ${index + 1}`
      return scene
    })
  }
}

export function scenarioToFields(scenario) {
  const parsed = scenario?.characters ? scenario : null
  if (!parsed) return { characters: '', places: '', scenes: '', light: '', mood: '' }
  return {
    characters: (parsed.characters || []).map(item => `${item.name} — ${item.look} — ${item.outfit}`).join('\n'),
    places: (parsed.places || []).map(item => `${item.name} — ${item.description}`).join('\n'),
    scenes: (parsed.scenes || []).map((scene, index) => `Scène ${scene.number || index + 1} — ${scene.who} — ${scene.where} — ${scene.what}`).join('\n'),
    light: parsed.light || '',
    mood: parsed.mood || ''
  }
}
