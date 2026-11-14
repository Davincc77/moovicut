/** On-device library. Nothing is sent to a server. */
import { foldName } from './scenario.js'

export const LIBRARY_KEY = 'shotboard.library.v1'

export function emptyLibrary() {
  return { schema: LIBRARY_KEY, characters: [], places: [], styles: [] }
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function normalizeLibrary(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const characters = (Array.isArray(source.characters) ? source.characters : []).slice(0, 200).map(item => ({
    name: text(item?.name, 80),
    look: text(item?.look, 300),
    outfit: text(item?.outfit, 200)
  })).filter(item => item.name && item.look && item.outfit)
  const places = (Array.isArray(source.places) ? source.places : []).slice(0, 200).map(item => ({
    name: text(item?.name, 80),
    description: text(item?.description, 300)
  })).filter(item => item.name && item.description)
  const styles = (Array.isArray(source.styles) ? source.styles : []).slice(0, 100).map(item => ({
    family: text(item?.family, 40).toLowerCase(),
    genre: text(item?.genre, 40).toLowerCase(),
    label: text(item?.label, 80)
  })).filter(item => item.family && item.genre)
  return { schema: LIBRARY_KEY, characters, places, styles }
}

function upsert(list, item, key) {
  const folded = foldName(key)
  const index = list.findIndex(entry => foldName(entry.name || entry.label) === folded)
  if (index >= 0) list.splice(index, 1, item)
  else list.push(item)
  return list
}

export function saveCharacter(library, character) {
  const next = normalizeLibrary(library)
  const item = normalizeLibrary({ characters: [character] }).characters[0]
  if (!item) throw new Error('A saved character needs a name, a look, and an outfit.')
  upsert(next.characters, item, item.name)
  return next
}

export function savePlace(library, place) {
  const next = normalizeLibrary(library)
  const item = normalizeLibrary({ places: [place] }).places[0]
  if (!item) throw new Error('A saved place needs a name and a description.')
  upsert(next.places, item, item.name)
  return next
}

export function saveStyle(library, style) {
  const next = normalizeLibrary(library)
  const item = normalizeLibrary({ styles: [style] }).styles[0]
  if (!item) throw new Error('A saved style needs a family and a genre.')
  const index = next.styles.findIndex(entry => entry.family === item.family && entry.genre === item.genre)
  if (index >= 0) next.styles.splice(index, 1, item)
  else next.styles.push(item)
  return next
}

export function exportLibrary(library) {
  return JSON.stringify(normalizeLibrary(library), null, 2)
}

export function importLibrary(text) {
  if (typeof text !== 'string') throw new Error('Library import requires a JSON file.')
  if (text.length > 1_000_000) throw new Error('Library file is larger than the 1 MB limit.')
  const parsed = JSON.parse(text)
  if (parsed?.schema && parsed.schema !== LIBRARY_KEY) throw new Error('This file is not a Moovicut library.')
  return normalizeLibrary(parsed)
}

export function readLibrary(storage) {
  try { return normalizeLibrary(JSON.parse(storage?.getItem(LIBRARY_KEY) || 'null')) }
  catch { return emptyLibrary() }
}

export function writeLibrary(storage, library) {
  storage?.setItem(LIBRARY_KEY, JSON.stringify(normalizeLibrary(library)))
}
