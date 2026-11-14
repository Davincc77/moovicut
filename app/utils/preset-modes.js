/** Light preset packs on the existing planner. No model call. */
import { CAMERAS } from './scenario.js'
import { cleanText, sentence } from './text.js'

export const PRESET_MODES = Object.freeze(['ad', 'series', 'explainer'])
export const BOARD_MODES = Object.freeze(['continuous', 'varied', 'scenario', 'ad', 'series', 'explainer'])

const SERIES_TURNS = Object.freeze([
  hook => hook,
  hook => `Closer on the same moment. ${hook}`,
  hook => `The next beat in the same place. ${hook}`,
  hook => `A held detail from the same scene. ${hook}`,
  hook => `The turn, with the same cast. ${hook}`,
  hook => `What follows, in the same place. ${hook}`,
  hook => `The quiet button. ${hook}`,
  hook => `The last frame of the series. ${hook}`
])

function problem(message, extra = {}) {
  return { message, ...extra }
}

function tooLong(value, max, field, section, label) {
  if ([...String(value || '')].length <= max) return null
  return problem(`Keep the ${label} under ${max} characters.`, { field, section })
}

function textOf(value, max) {
  return cleanText(value).slice(0, max)
}

function promptOf(value) {
  return typeof value === 'string' ? value.trim().slice(0, 16000) : ''
}

function objectOf(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

export function isPresetMode(value) {
  return PRESET_MODES.includes(value)
}

export function parseAd(input = {}) {
  const source = objectOf(input.ad) || input
  const product = cleanText(source.product || source.name || '')
  const benefit = cleanText(source.benefit || '')
  const cta = cleanText(source.cta || source.callToAction || '')
  const setting = cleanText(source.setting || source.place || '')
  const errors = []
  if (product.length < 2) errors.push(problem('Name the product in at least 2 characters.', { field: 'product', section: 'ad' }))
  if (benefit.length < 8) errors.push(problem('Add a benefit of at least 8 characters.', { field: 'benefit', section: 'ad' }))
  for (const item of [
    tooLong(product, 80, 'product', 'ad', 'product name'),
    tooLong(benefit, 400, 'benefit', 'ad', 'benefit'),
    tooLong(cta, 120, 'cta', 'ad', 'call to action'),
    tooLong(setting, 200, 'setting', 'ad', 'setting')
  ]) if (item) errors.push(item)
  if (errors.length) return { ok: false, errors }
  const placeName = setting ? setting.slice(0, 80) : 'the product setting'
  const placeDescription = setting || 'a clean setting built around the product'
  const spoken = cta ? ` A voice says ${cta}.` : ''
  const shots = [
    { stage: 'Hook', title: 'Hook', cam: 'wide', action: `The want is clear. ${benefit}`, what: `The want is clear. ${benefit}` },
    { stage: 'Hero', title: 'Hero', cam: 'push', action: `${product} holds the frame. ${benefit}`, what: `${product} holds the frame. ${benefit}` },
    { stage: 'Proof', title: 'Proof', cam: 'close', action: `One clear proof of the benefit. ${benefit}`, what: `One clear proof of the benefit. ${benefit}` },
    { stage: 'Pack shot', title: 'Pack shot', cam: 'static', action: `${product} fills the frame.${spoken} No lettering in the frame.`, what: `${product} fills the frame.${spoken} No lettering in the frame.` }
  ].map(shot => ({
    ...shot,
    who: product,
    where: placeName,
    prompt: ''
  }))
  const supplied = Array.isArray(source.prompts) ? source.prompts : []
  shots.forEach((shot, index) => { shot.prompt = promptOf(supplied[index]) })
  return {
    ok: true,
    errors: [],
    premise: `${product}. ${benefit}`,
    title: sentence(product),
    aspectRatio: '9:16',
    filmSheet: {
      characters: [{ name: product, look: 'identical in every shot', outfit: '' }],
      places: [{ name: placeName, description: placeDescription }],
      product: { name: product, benefit, cta },
      light: 'day',
      mood: ''
    },
    shots
  }
}

function characterOf(value) {
  if (typeof value === 'string') return { name: cleanText(value), look: '', outfit: '' }
  const source = objectOf(value)
  if (!source) return { name: '', look: '', outfit: '' }
  return {
    name: cleanText(source.name || source.n || ''),
    look: cleanText(source.look || source.l || ''),
    outfit: cleanText(source.outfit || source.o || '')
  }
}

function placeOf(value) {
  if (typeof value === 'string') return { name: cleanText(value), description: '' }
  const source = objectOf(value)
  if (!source) return { name: '', description: '' }
  return {
    name: cleanText(source.name || source.n || ''),
    description: cleanText(source.description || source.desc || source.d || '')
  }
}

function episodeLines(raw, hook, errors) {
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (typeof item === 'string') return { text: cleanText(item), prompt: '' }
      const source = objectOf(item)
      if (!source) return { text: '', prompt: '' }
      return { text: cleanText(source.text || source.action || source.what || source.do || ''), prompt: promptOf(source.prompt) }
    }).filter(item => item.text)
  }
  if (typeof raw === 'string') {
    return raw.split(/\n+/).map(line => cleanText(line.replace(/^\s*(?:episode\s+)?\d+[\.\)]\s+/i, ''))).filter(Boolean).map(text => ({ text, prompt: '' }))
  }
  if (raw == null || raw === '') {
    errors.push(problem('Give 3 to 8 episodes, as a count or one line each.', { field: 'episodes', section: 'series' }))
    return []
  }
  const count = Number(raw)
  if (!Number.isInteger(count) || count < 3 || count > 8) {
    errors.push(problem('Episode count must be a whole number from 3 to 8.', { field: 'episodes', section: 'series' }))
    return []
  }
  return Array.from({ length: count }, (_, index) => ({ text: SERIES_TURNS[index](hook), prompt: '' }))
}

export function parseSeries(input = {}) {
  const source = objectOf(input.series) || {}
  const title = cleanText(source.title || input.seriesTitle || '')
  const hook = cleanText(source.hook || input.hook || '')
  const errors = []
  if (title.length < 2) errors.push(problem('Name the series in at least 2 characters.', { field: 'title', section: 'series' }))
  if (hook.length < 8) errors.push(problem('Add a hook of at least 8 characters.', { field: 'hook', section: 'series' }))
  for (const item of [
    tooLong(title, 80, 'title', 'series', 'series title'),
    tooLong(hook, 400, 'hook', 'series', 'hook')
  ]) if (item) errors.push(item)
  const lines = episodeLines(source.episodes ?? input.episodes, hook, errors)
  if (!errors.some(item => item.field === 'episodes') && (lines.length < 3 || lines.length > 8)) {
    errors.push(problem('A short series needs 3 to 8 episodes.', { field: 'episodes', section: 'series' }))
  }
  lines.forEach((line, index) => {
    const item = tooLong(line.text, 400, 'episodes', 'series', `episode ${index + 1}`)
    if (item) errors.push(item)
  })
  const character = characterOf(source.character || source.cast || input.character)
  const place = placeOf(source.place || input.place)
  for (const item of [
    tooLong(character.name, 80, 'character', 'series', 'character name'),
    tooLong(character.look, 300, 'character', 'series', 'character look'),
    tooLong(character.outfit, 200, 'character', 'series', 'character outfit'),
    tooLong(place.name, 80, 'place', 'series', 'place name'),
    tooLong(place.description, 300, 'place', 'series', 'place description')
  ]) if (item) errors.push(item)
  if (errors.length) return { ok: false, errors }
  const lead = {
    name: character.name || 'the lead',
    look: character.look || 'the same person in every episode',
    outfit: character.outfit || 'the same clothes in every episode'
  }
  const setting = {
    name: place.name || 'the series place',
    description: place.description || 'the same place in every episode'
  }
  const shots = lines.flatMap((line, index) => {
    const episode = index + 1
    return [
      { stage: `Episode ${episode} · Open`, title: `Episode ${episode}`, action: line.text, what: line.text, cam: 'medium', prompt: line.prompt },
      { stage: `Episode ${episode} · Hold`, title: `Episode ${episode}, closer`, action: 'The same action, closer.', what: 'The same action, closer.', cam: 'close', prompt: '' },
      { stage: `Episode ${episode} · Land`, title: `Episode ${episode}, last frame`, action: 'The episode ends on that image.', what: 'The episode ends on that image.', cam: 'static', prompt: '' }
    ].map(shot => ({ ...shot, who: lead.name, where: setting.name, episode }))
  })
  return {
    ok: true,
    errors: [],
    premise: `${title}. ${hook}`,
    title: sentence(title),
    aspectRatio: '9:16',
    filmSheet: {
      characters: [lead],
      places: [setting],
      light: 'day',
      mood: '',
      series: { title, hook, episodes: lines.length }
    },
    shots
  }
}

function numberedSteps(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean)
  const head = []
  const steps = []
  lines.forEach(line => {
    const match = line.match(/^(?:\d+[\.\)]\s+|[-•]\s+)(.+)$/)
    if (match) steps.push({ text: cleanText(match[1]), prompt: '' })
    else if (!steps.length) head.push(line)
    else steps.push({ text: cleanText(line), prompt: '' })
  })
  return { topic: cleanText(head.join(' ')), steps: steps.filter(step => step.text) }
}

function stepList(raw) {
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (typeof item === 'string') return { text: cleanText(item.replace(/^\s*\d+[\.\)]\s+/, '')), prompt: '' }
      const source = objectOf(item)
      if (!source) return { text: '', prompt: '' }
      return { text: cleanText(source.text || source.action || source.what || source.do || source.step || ''), prompt: promptOf(source.prompt) }
    }).filter(item => item.text)
  }
  if (typeof raw === 'string') return numberedSteps(raw).steps
  return []
}

export function parseExplainer(input = {}) {
  const source = objectOf(input.explainer) || {}
  const fromPremise = numberedSteps(typeof input.premise === 'string' ? input.premise : '')
  const topic = cleanText(source.topic || input.topic || fromPremise.topic || '')
  const audience = cleanText(source.audience || input.audience || '')
  const provided = source.steps ?? input.steps
  const steps = stepList(provided)
  const list = steps.length ? steps : fromPremise.steps
  const errors = []
  if (topic.length < 8) errors.push(problem('Name the topic in at least 8 characters.', { field: 'topic', section: 'explainer' }))
  if (!list.length) errors.push(problem('Add a numbered list. Each line becomes one shot.', { field: 'steps', section: 'explainer' }))
  if (list.length > 48) errors.push(problem('An explainer can include at most 48 steps.', { field: 'steps', section: 'explainer' }))
  for (const item of [
    tooLong(topic, 200, 'topic', 'explainer', 'topic'),
    tooLong(audience, 200, 'audience', 'explainer', 'audience')
  ]) if (item) errors.push(item)
  list.forEach((step, index) => {
    const item = tooLong(step.text, 400, 'steps', 'explainer', `step ${index + 1}`)
    if (item) errors.push(item)
  })
  if (errors.length) return { ok: false, errors }
  const shots = list.map((step, index) => ({
    stage: `Step ${index + 1}`,
    title: sentence(step.text).slice(0, 80) || `Step ${index + 1}`,
    action: step.text,
    what: step.text,
    who: '',
    where: 'the demonstration',
    cam: index === 0 ? 'wide' : index === list.length - 1 ? 'close' : 'medium',
    prompt: step.prompt
  }))
  return {
    ok: true,
    errors: [],
    premise: topic,
    title: sentence(topic).slice(0, 80),
    aspectRatio: '16:9',
    filmSheet: {
      characters: [],
      places: [{ name: 'the demonstration', description: topic }],
      topic,
      audience,
      light: 'day',
      mood: ''
    },
    shots
  }
}

export function cameraFor(id) {
  return CAMERAS[id] || CAMERAS.medium
}

export function episodePacks(project) {
  const shots = project?.shots || []
  const groups = new Map()
  shots.forEach((shot, index) => {
    const key = shot.episode || 1
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(index)
  })
  return [...groups.entries()].map(([episode, indexes], order) => ({
    order: order + 1,
    episode,
    duration: indexes.reduce((sum, index) => sum + (Number(shots[index].duration_seconds || shots[index].duration) || 0), 0),
    label: project?.sequenceMode === 'ad' ? 'Spot' : `Episode ${episode}`,
    withinPreset: true,
    shotOrders: indexes.map(index => index + 1),
    shotIds: indexes.map(index => shots[index].shot_id || shots[index].id).filter(Boolean),
    export: indexes.map(index => shots[index].prompt || '').filter(Boolean).join('\n\n')
  }))
}
