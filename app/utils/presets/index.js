/** Loads style-preset data and resolves a family + genre into one locked sheet. */
import anime from './anime.js'
import cinema from './cinema.js'
import documentary from './documentary.js'

export const STYLE_PRESETS = Object.freeze([anime, cinema, documentary])

const FAMILIES = new Map(STYLE_PRESETS.map(family => [family.id, family]))

export function listPresets() {
  return STYLE_PRESETS.map(family => ({
    id: family.id,
    label: family.label,
    defaultGenre: family.defaultGenre,
    genres: family.genres.map(genre => ({ id: genre.id, label: genre.label }))
  }))
}

export function presetFamilies() {
  return STYLE_PRESETS.map(family => family.id)
}

export function presetGenres(familyId) {
  return FAMILIES.get(familyId)?.genres.map(genre => genre.id) || []
}

/** The studio label is “Anime / manga”, so manga is the same family. */
const FAMILY_ALIASES = Object.freeze({ manga: 'anime' })

export function canonicalStyleFamily(value) {
  const id = String(value || '').trim().toLowerCase()
  if (!id) return ''
  const aliased = FAMILY_ALIASES[id] || id
  return FAMILIES.has(aliased) ? aliased : ''
}

function presetError(errors) {
  const message = errors.length === 1 ? errors[0].message : `The style preset has ${errors.length} problems.`
  const error = new Error(message)
  error.status = 400
  error.code = 'invalid_preset'
  error.errors = errors
  return error
}

function familyByGenre(genreId) {
  return STYLE_PRESETS.filter(family => family.genres.some(genre => genre.id === genreId))
}

/**
 * Resolve a style family and genre. Empty inputs use Cinema / Drama.
 * Unknown ids throw a 400 with every problem in `errors`.
 */
export function resolvePreset(familyInput = '', genreInput = '') {
  const requested = String(familyInput || '').trim().toLowerCase()
  const familyId = canonicalStyleFamily(requested)
  if (requested && !familyId) {
    const error = new Error(`Style family must be one of: ${presetFamilies().join(', ')}. manga is an alias of anime.`)
    error.status = 400
    error.code = 'invalid_preset'
    error.errors = [{ field: 'style', message: error.message }]
    throw error
  }
  const genreId = String(genreInput || '').trim().toLowerCase()
  const errors = []
  if (familyId && !FAMILIES.has(familyId)) {
    errors.push({ field: 'style', message: `Style family must be one of: ${presetFamilies().join(', ')}.` })
  }
  const requestedFamily = FAMILIES.get(familyId)
  if (requestedFamily && genreId && !requestedFamily.genres.some(genre => genre.id === genreId)) {
    errors.push({ field: 'genre', message: `Genre for ${requestedFamily.label} must be one of: ${presetGenres(familyId).join(', ')}.` })
  }
  if (!familyId && genreId && familyByGenre(genreId).length === 0) {
    errors.push({ field: 'genre', message: `Unknown preset genre "${genreId}".` })
  }
  if (!familyId && genreId && familyByGenre(genreId).length > 1) {
    errors.push({ field: 'style', message: `Genre "${genreId}" belongs to more than one family. Set the style family too.` })
  }
  if (errors.length) throw presetError(errors)
  const family = requestedFamily || (genreId ? familyByGenre(genreId)[0] : FAMILIES.get('cinema'))
  const resolvedGenreId = genreId || family.defaultGenre
  const genre = family.genres.find(item => item.id === resolvedGenreId) || family.genres[0]
  return Object.freeze({
    family: family.id,
    familyLabel: family.label,
    genre: genre.id,
    genreLabel: genre.label,
    visual: genre.visual,
    palette: genre.palette,
    lighting: genre.lighting,
    lens: genre.lens,
    framing: genre.framing,
    pacing: genre.pacing,
    defaultCam: genre.defaultCam || 'medium',
    cameraNote: genre.cameraNote || '',
    characters: family.characters,
    voiceOver: family.voiceOver || ''
  })
}

export function formatPresetBlock(preset) {
  if (!preset) return ''
  const lines = [
    'STYLE PRESET',
    `Family: ${preset.familyLabel}`,
    `Genre: ${preset.genreLabel}`,
    `Visual: ${preset.visual}`,
    `Palette: ${preset.palette}`,
    `Lighting: ${preset.lighting}`,
    `Lens: ${preset.lens}`,
    `Framing: ${preset.framing}`,
    `Pacing: ${preset.pacing}`,
    `Characters: ${preset.characters}`
  ]
  if (preset.cameraNote) lines.push(`Camera: ${preset.cameraNote}`)
  if (preset.voiceOver) lines.push(`Voice-over: ${preset.voiceOver}`)
  return lines.join('\n')
}
