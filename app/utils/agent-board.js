/** One compact board every mode can hand to an agent or the API. */
import { canonicalModel } from '../integrations/models/model-registry.js'
import { agentCameraValue, createStoryboard, refreshProjectPrompts, refreshShotPrompt } from './prompt-engine.js'
import { BOARD_MODES, isPresetMode } from './preset-modes.js'
import { asCharacter, lockLineFor, lockLinesForShot, publicSheet } from './character-lock.js'
import { promptFraming, termById } from './framing.js'
import { resolveUserCamera } from './scenario.js'

export const AGENT_BOARD_SCHEMA = 'shotboard.compact.v1'

function applyAgentCamera(shot, source) {
  const next = { ...shot }
  if (source?.framing) next.framing = source.framing
  if (source?.framingTerm && termById(source.framingTerm)) {
    next.framingTerm = source.framingTerm
    next.framing = termById(source.framingTerm).label
  }
  if (source?.framingChosen === true) next.framingChosen = true
  if (source?.camera) {
    const resolved = resolveUserCamera(source.camera)
    next.cam = resolved.cam
    next.camChosen = Boolean(resolved.cam)
    next.camera = resolved.chosen ? resolved.move : null
    next.cameraChosen = resolved.chosen
    if (resolved.framing) next.framing = resolved.framing
  } else {
    next.camera = null
    next.cameraChosen = false
  }
  return next
}

function copyCharacter(item) {
  const person = asCharacter(item)
  const copy = { name: person.name, look: person.look, outfit: person.outfit }
  ;['body', 'face', 'hair', 'colors', 'marks'].forEach(key => { if (person[key]) copy[key] = person[key] })
  const line = person.lockEdited ? person.lockLine : lockLineFor(person, 1)
  if (line) copy.lockLine = line
  if (person.lockEdited) copy.lockEdited = true
  if (person.states.length) copy.states = person.states
  const sheet = publicSheet(person)
  if (Object.keys(sheet).length) copy.sheet = sheet
  return copy
}

function copySheet(sheet) {
  if (!sheet) return undefined
  const copy = {
    characters: (sheet.characters || []).map(copyCharacter),
    places: (sheet.places || []).map(item => ({ name: item.name || '', description: item.description || '' })),
    light: sheet.light || '',
    mood: sheet.mood || '',
    style: sheet.style || ''
  }
  if (sheet.product?.name) copy.product = { name: sheet.product.name, benefit: sheet.product.benefit || '', cta: sheet.product.cta || '' }
  if (sheet.topic) copy.topic = sheet.topic
  if (sheet.audience) copy.audience = sheet.audience
  return copy
}

export function exportAgentBoard(project) {
  return {
    schema: AGENT_BOARD_SCHEMA,
    title: project.title || '',
    premise: project.premise || '',
    model: canonicalModel(project.model || project.target_model) || 'grok',
    aspectRatio: project.aspectRatio || '16:9',
    mode: project.sequenceMode || 'continuous',
    style: project.preset?.family || '',
    genre: project.preset?.genre || '',
    promptStyle: project.promptStyle === 'detailed' ? 'detailed' : 'short',
    ...(project.promptLanguage && project.promptLanguage !== 'en' ? { promptLanguage: project.promptLanguage } : {}),
    filmSheet: copySheet(project.filmSheet),
    ...(Array.isArray(project.cuts) && project.cuts.length ? { cuts: project.cuts } : {}),
    shots: (project.shots || []).map((shot, index) => {
      const item = {
        id: shot.id || shot.shot_id,
        order: shot.order,
        duration: shot.duration_seconds || shot.duration,
        who: shot.who || '',
        where: shot.where || '',
        what: shot.what || shot.action || '',
        camera: agentCameraValue(shot),
        light: shot.light || '',
        mood: shot.mood || '',
        prompt: shot.prompt || '',
        framing: promptFraming(shot)
      }
      if (shot.framingTerm) item.framingTerm = shot.framingTerm
      if (shot.framingChosen === true) item.framingChosen = true
      const lines = lockLinesForShot(shot, project, index)
      if (lines.length) item.lockLines = lines
      if (shot.promptEdited === true) item.promptEdited = true
      if (shot.sceneCut === true) item.sceneCut = true
      if (shot.cutCue) item.cutCue = shot.cutCue
      if (shot.cutReason) item.cutReason = shot.cutReason
      if (shot.cutUncertain === true) item.cutUncertain = true
      if (shot.timeLabel) item.time = shot.timeLabel
      return item
    }),
    ...(project.parts?.length > 1 ? { parts: project.parts.map(part => ({ index: part.index, from: part.from, to: part.to, place: part.place, time: part.time })) } : {})
  }
}

export function importAgentBoard(board, options = {}) {
  if (!board || board.schema !== AGENT_BOARD_SCHEMA) throw new Error('This file is not a Moovicut agent board.')
  const overwrite = options.overwritePrompt === true
  const mode = BOARD_MODES.includes(board.mode) ? board.mode : 'continuous'
  if (mode === 'scenario' && board.filmSheet?.characters?.length && board.filmSheet?.places?.length) {
    const project = createStoryboard({
      premise: board.premise,
      model: board.model,
      aspectRatio: board.aspectRatio,
      sequenceMode: 'scenario',
      style: board.style,
      genre: board.genre,
      promptStyle: board.promptStyle || board.prompt_style,
      promptLanguage: board.promptLanguage || board.prompt_language,
      overwritePrompt: overwrite,
      scenario: {
        characters: board.filmSheet.characters,
        places: board.filmSheet.places,
        light: board.filmSheet.light,
        mood: board.filmSheet.mood,
        scenes: (board.shots || []).map(shot => ({
          who: shot.who,
          where: shot.where,
          what: shot.what,
          camera: shot.camera || undefined,
          light: shot.light,
          mood: shot.mood,
          duration: shot.duration,
          prompt: !overwrite && shot.promptEdited ? shot.prompt : undefined
        }))
      }
    })
    project.shots = project.shots.map((shot, index) => {
      const source = board.shots?.[index]
      if (!source) return shot
      const next = applyAgentCamera(shot, source)
      if (next === shot) return shot
      return refreshShotPrompt(next, project, index)
    })
    project.title = board.title || project.title
    return project
  }
  const project = createStoryboard({
    premise: board.premise,
    model: board.model,
    aspectRatio: board.aspectRatio,
    sequenceMode: mode === 'scenario' || isPresetMode(mode) ? 'continuous' : mode,
    count: Math.max(1, board.shots?.length || 5),
    promptStyle: board.promptStyle || board.prompt_style,
    promptLanguage: board.promptLanguage || board.prompt_language,
    skipDetection: true
  })
  project.promptStyle = project.promptStyle === 'detailed' ? 'detailed' : 'short'
  project.sequenceMode = mode
  if (board.filmSheet) project.filmSheet = copySheet(board.filmSheet)
  project.shots = (board.shots || []).map((shot, index) => {
    const current = project.shots[index] || project.shots[0]
    const next = applyAgentCamera({ ...current, ...shot, id: shot.id || current.id, shot_id: shot.id || current.shot_id, action: shot.what || current.action, order: index + 1 }, shot)
    if (!overwrite && shot.promptEdited && shot.prompt) {
      next.prompt = shot.prompt
      next.promptEdited = true
    } else if (overwrite) {
      delete next.prompt
      delete next.promptEdited
    }
    return next
  })
  project.title = board.title || project.title
  if (overwrite) {
    const refreshed = refreshProjectPrompts(project, { overwrite: true })
    refreshed.title = board.title || refreshed.title
    return refreshed
  }
  if (options.project) return project
  return project
}
