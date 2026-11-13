import { sentence } from '../../utils/text.js'

function endSentence(value) { return String(value || '').trim().replace(/[.]+$/, '') }

/**
 * Model boundaries are data plus a formatter, not remote generation services.
 * Hosts may supply a registry with additional or replacement adapters.
 */
export function createModelRegistry(adapters = []) {
  const models = [...adapters]
  return Object.freeze({
    options: models.map(({ id, label, note, mark, markClass }) => ({ id, label, note, mark, markClass })),
    ids: models.map(model => model.id),
    get(id) { return models.find(model => model.id === id) || models[0] }
  })
}

const grok = {
  id: 'grok', label: 'Grok Imagine', note: 'Natural, cinematic', mark: '𝕏', markClass: 'x-glyph',
  compose({ shot, project, premise, aspect, duration, genre, style }) {
    return [
      `Create a ${duration}-second ${aspect} shot.`,
      `${shot.framing || 'Medium shot'} of ${endSentence(shot.action || sentence(premise))}.`,
      `CAMERA: ${shot.camera || 'Slow cinematic camera move'}, ${shot.lens || '35mm lens'}. STYLE: ${genre.look}, ${style.suffix}.`,
      `${endSentence(shot.lighting || 'cinematic dimensional light')}. ${shot.directions || 'Natural action, deliberate movement and a consistent cinematic tone.'}`,
      `Continuity: ${endSentence(shot.continuity || 'Preserve established appearance, geography and lighting')}. ${endSentence(shot.sound || shot.cue || 'natural environmental ambience')}. ${duration}s, ${aspect}. No captions, titles, logos or watermarks.`
    ].join('\n')
  }
}
const google = {
  id: 'google', label: 'Google (Veo / Gemini)', note: 'Veo / Gemini', mark: 'G', markClass: 'google-glyph',
  compose({ shot, index, premise, aspect, duration, genre, style }) {
    return [
      `SCENE: ${sentence(shot.title || `Shot ${index + 1}`)}. ${endSentence(shot.action || premise)}.`,
      `CAMERA: ${shot.framing || 'Medium shot'}, ${shot.camera || 'Slow push-in'}, ${shot.lens || '35mm lens'}.`,
      `LIGHTING: ${shot.lighting || 'motivated cinematic light with dimensional shadows'}.`,
      `STYLE: ${genre.look}. ${style.suffix}. ${aspect}.`,
      `ACTION: ${shot.directions || 'The action unfolds with natural movement and a restrained cinematic performance.'}`,
      `AUDIO: ${shot.sound || shot.cue || 'environmental ambience and a restrained score'}.`,
      `CONTINUITY: ${shot.continuity || 'Match the established character, location and lighting across the story.'}`,
      `TIMING: ${duration} seconds. No captions, titles, logos or watermarks.`
    ].join('\n')
  }
}
export const modelRegistry = createModelRegistry([grok, google])
export const MODEL_IDS = modelRegistry.ids
export const REFERENCE_MODEL_NAMES = Object.freeze(['Grok Imagine', 'Google (Veo / Gemini)'])
export const MODEL_OPTIONS = modelRegistry.options

/** Map current ids and retired selector labels onto grok or google. Unknown values stay empty so validation still rejects them. */
const LEGACY_MODEL_KEYS = Object.freeze({
  grok: 'grok',
  grokimagine: 'grok',
  x: 'grok',
  wan: 'grok',
  wan26: 'grok',
  kling: 'grok',
  kling26: 'grok',
  happyhorse: 'grok',
  muse: 'grok',
  omni: 'grok',
  re: 'grok',
  '24fps': 'grok',
  cinema: 'grok',
  portrait: 'grok',
  commercial: 'grok',
  google: 'google',
  googlevoe: 'google',
  veo: 'google',
  gemini: 'google',
  googlevegemini: 'google',
  vegemini: 'google',
  googlevoemini: 'google'
})

export function canonicalModel(value) {
  const compact = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
  return LEGACY_MODEL_KEYS[compact] || ''
}
