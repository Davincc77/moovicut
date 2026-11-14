/** One compact board every mode can hand to an agent or the API. */
import { canonicalModel } from '../integrations/models/model-registry.js'
import { createStoryboard } from './prompt-engine.js'

export const AGENT_BOARD_SCHEMA = 'shotboard.compact.v1'

function copySheet(sheet) {
  if (!sheet) return undefined
  return {
    characters: (sheet.characters || []).map(item => ({ name: item.name || '', look: item.look || '', outfit: item.outfit || '' })),
    places: (sheet.places || []).map(item => ({ name: item.name || '', description: item.description || '' })),
    light: sheet.light || '',
    mood: sheet.mood || '',
    style: sheet.style || ''
  }
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
    filmSheet: copySheet(project.filmSheet),
    shots: (project.shots || []).map(shot => {
      const item = {
        id: shot.id || shot.shot_id,
        order: shot.order,
        duration: shot.duration_seconds || shot.duration,
        who: shot.who || '',
        where: shot.where || '',
        what: shot.what || shot.action || '',
        camera: shot.cam || '',
        light: shot.light || '',
        mood: shot.mood || '',
        prompt: shot.prompt || ''
      }
      if (shot.promptEdited === true) item.promptEdited = true
      return item
    })
  }
}

export function importAgentBoard(board, options = {}) {
  if (!board || board.schema !== AGENT_BOARD_SCHEMA) throw new Error('This file is not a Moovicut agent board.')
  const mode = ['continuous', 'varied', 'scenario'].includes(board.mode) ? board.mode : 'continuous'
  if (mode === 'scenario' && board.filmSheet?.characters?.length && board.filmSheet?.places?.length) {
    const project = createStoryboard({
      premise: board.premise,
      model: board.model,
      aspectRatio: board.aspectRatio,
      sequenceMode: 'scenario',
      style: board.style,
      genre: board.genre,
      scenario: {
        characters: board.filmSheet.characters,
        places: board.filmSheet.places,
        light: board.filmSheet.light,
        mood: board.filmSheet.mood,
        scenes: (board.shots || []).map(shot => ({
          who: shot.who,
          where: shot.where,
          what: shot.what,
          camera: shot.camera,
          light: shot.light,
          mood: shot.mood,
          duration: shot.duration,
          prompt: shot.promptEdited ? shot.prompt : undefined
        }))
      }
    })
    project.title = board.title || project.title
    return project
  }
  const project = createStoryboard({
    premise: board.premise,
    model: board.model,
    aspectRatio: board.aspectRatio,
    sequenceMode: mode === 'scenario' ? 'continuous' : mode,
    count: Math.max(1, board.shots?.length || 5),
    skipDetection: true
  })
  if (board.filmSheet) project.filmSheet = copySheet(board.filmSheet)
  project.shots = (board.shots || []).map((shot, index) => {
    const current = project.shots[index] || project.shots[0]
    const next = { ...current, ...shot, id: shot.id || current.id, shot_id: shot.id || current.shot_id, action: shot.what || current.action, order: index + 1 }
    if (shot.promptEdited && shot.prompt) {
      next.prompt = shot.prompt
      next.promptEdited = true
    }
    return next
  })
  project.title = board.title || project.title
  if (options.project) return project
  return project
}
