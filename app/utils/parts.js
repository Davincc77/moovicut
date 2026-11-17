/** Split a long board into parts of at most 40 shots. No model call. */
import { cleanText } from './text.js'
import { lockLineFor } from './character-lock.js'
import { isRejectedPlace, tidyPlaceLemma } from './place-lexicon.js'

export const PART_SHOT_LIMIT = 40

export function sceneIdOf(shot, index = 0) {
  if (shot?.sceneId != null && shot.sceneId !== '') return `scene:${shot.sceneId}`
  if (shot?.sceneKey) return String(shot.sceneKey)
  if (shot?.id) return `shot:${shot.id}`
  if (shot?.shot_id) return `shot:${shot.shot_id}`
  return `index:${index}`
}

/** Ranges of shots. A cut is the last scene boundary at or before the limit. */
export function partitionShots(shots, limit = PART_SHOT_LIMIT) {
  const list = Array.isArray(shots) ? shots : []
  const ranges = []
  let start = 0
  while (start < list.length) {
    if (list.length - start <= limit) {
      ranges.push({ start, end: list.length, splitInside: false })
      break
    }
    const windowEnd = start + limit
    let cut = -1
    for (let index = windowEnd; index > start; index -= 1) {
      if (sceneIdOf(list[index - 1], index - 1) !== sceneIdOf(list[index], index)) {
        cut = index
        break
      }
    }
    if (cut < 0) {
      ranges.push({ start, end: windowEnd, splitInside: true })
      start = windowEnd
    } else {
      ranges.push({ start, end: cut, splitInside: false })
      start = cut
    }
  }
  return ranges
}

function openingState(project) {
  const sheet = project?.filmSheet || {}
  const continuity = project?.continuitySheet || {}
  const place = usablePlace(sheet.places?.[0]?.name) || usablePlace(continuity.place) || ''
  const time = cleanText(sheet.light) || cleanText(continuity.time) || ''
  return { place, time }
}

function usablePlace(value) {
  const place = tidyPlaceLemma(cleanText(value))
  if (!place || isRejectedPlace(place)) return ''
  return place
}

function carry(state, shot) {
  const next = { ...state }
  const place = usablePlace(shot?.where)
  if (place) next.place = place
  const light = cleanText(shot?.time) || cleanText(shot?.light)
  if (light) next.time = light
  return next
}

/** Place and time in effect after `index` shots (0 is the opening). */
export function stateAt(project, index) {
  let state = openingState(project)
  const shots = project?.shots || []
  const end = Math.max(0, Math.min(Number(index) || 0, shots.length))
  for (let cursor = 0; cursor < end; cursor += 1) state = carry(state, shots[cursor])
  return state
}

/** Place and time of the first shot in a part. An empty shot light stays empty. */
export function partOpening(project, index) {
  const shot = project?.shots?.[index]
  const carried = stateAt(project, index)
  if (!shot) return carried
  const place = usablePlace(shot.where) || usablePlace(carried.place)
  const time = cleanText(shot.time) || cleanText(shot.light) || carried.time
  return { place, time }
}

export function describeParts(project, ranges = partitionShots(project?.shots)) {
  return ranges.map((range, index) => {
    const state = partOpening(project, range.start)
    return {
      index: index + 1,
      from: range.start + 1,
      to: range.end,
      place: state.place,
      time: state.time,
      splitInside: range.splitInside
    }
  })
}

export function publicParts(parts) {
  return (parts || []).map(part => ({
    index: part.index,
    from: part.from,
    to: part.to,
    place: part.place,
    time: part.time
  }))
}

export const SHOT_LIMIT = 40

/** Shown in every site language. English is the catalog key. */
export const SHOT_LIMIT_MESSAGE = 'Moovicut is built for up to 40 shots (a short or medium film, or one chapter). Split the story into chapters and send them one by one, reusing the exported character sheet so faces stay consistent.'

/** Attach `parts` only when the board needs more than one. Single-part boards gain no fields. */
export function finalizeParts(project) {
  if (!project || !Array.isArray(project.shots)) return project
  const described = describeParts(project)
  if (described.length < 2) {
    delete project.parts
    return project
  }
  project.parts = publicParts(described)
  return project
}

const INSIDE_MESSAGE = 'This part starts inside a scene because that scene is longer than 40 shots.'
const INSIDE_FIX = 'Keep each scene within 40 shots when you can. This cut is at a shot boundary.'
const CARRY_MESSAGE = 'This part does not start from the place and time in effect at the end of the previous part.'
const CARRY_FIX = 'Carry the place and time from the end of the previous part.'
const JOIN_MESSAGE = '{name}\'s lock line changes across the part join.'
const JOIN_FIX = 'Keep the same lock line on both sides of the part join.'

/** Continuity across a part boundary, plus a warning when a scene had to be cut. */
export function partJoinWarnings(project) {
  const parts = project?.parts
  if (!parts || parts.length < 2) return []
  const shots = project.shots || []
  const ranges = partitionShots(shots)
  const warnings = []
  ranges.forEach(range => {
    if (!range.splitInside) return
    const next = shots[range.end]
    if (!next) return
    warnings.push({
      shotId: next.id || next.shot_id,
      order: next.order,
      code: 'part_split_inside_scene',
      message: INSIDE_MESSAGE,
      fix: INSIDE_FIX
    })
  })
  for (let index = 1; index < ranges.length; index += 1) {
    const prev = shots[ranges[index].start - 1]
    const next = shots[ranges[index].start]
    if (!prev || !next) continue
    const opening = partOpening(project, ranges[index].start)
    const published = parts[index]
    if (published && (published.place !== opening.place || published.time !== opening.time)) {
      warnings.push({
        shotId: next.id || next.shot_id,
        order: next.order,
        code: 'part_join',
        message: CARRY_MESSAGE,
        fix: CARRY_FIX
      })
    }
    ;(project.filmSheet?.characters || []).forEach(character => {
      const left = lockLineFor(character, prev.order || ranges[index].start)
      const right = lockLineFor(character, next.order || ranges[index].start + 1)
      if (!left || !right || left === right) return
      warnings.push({
        shotId: next.id || next.shot_id,
        order: next.order,
        code: 'part_join',
        message: JOIN_MESSAGE.replace('{name}', character.name),
        fix: JOIN_FIX,
        name: character.name
      })
    })
  }
  return warnings
}
