import { sentence } from '../../utils/text.js'
import { MODEL_PROFILES, canonicalProfileId } from '../../utils/model-profiles.js'

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
  compose({ shot, project, premise, aspect, duration, genre, style, lockedStyle }) {
    const look = lockedStyle || `${genre.look}, ${style.suffix}`
    return [
      `Create a ${duration}-second ${aspect} shot.`,
      `${shot.framing || 'Medium shot'} of ${endSentence(shot.action || sentence(premise))}.`,
      `CAMERA: ${shot.camera || 'Slow cinematic camera move'}, ${shot.lens || '35mm lens'}. STYLE: ${look}.`,
      `${endSentence(shot.lighting || 'cinematic dimensional light')}. ${shot.directions || 'Natural action, deliberate movement and a consistent cinematic tone.'}`,
      `Continuity: ${endSentence(shot.continuity || 'Preserve established appearance, geography and lighting')}. ${endSentence(shot.sound || shot.cue || 'natural environmental ambience')}. ${duration}s, ${aspect}. No captions, titles, logos or watermarks.`
    ].join('\n')
  }
}
const google = {
  id: 'google', label: 'Google (Veo / Gemini)', note: 'Veo / Gemini', mark: 'G', markClass: 'google-glyph',
  compose({ shot, index, premise, aspect, duration, genre, style, lockedStyle }) {
    const look = lockedStyle || `${genre.look}. ${style.suffix}`
    return [
      `SCENE: ${sentence(shot.title || `Shot ${index + 1}`)}. ${endSentence(shot.action || premise)}.`,
      `CAMERA: ${shot.framing || 'Medium shot'}, ${shot.camera || 'Slow push-in'}, ${shot.lens || '35mm lens'}.`,
      `LIGHTING: ${shot.lighting || 'motivated cinematic light with dimensional shadows'}.`,
      `STYLE: ${look}. ${aspect}.`,
      `ACTION: ${shot.directions || 'The action unfolds with natural movement and a restrained cinematic performance.'}`,
      `AUDIO: ${shot.sound || shot.cue || 'environmental ambience and a restrained score'}.`,
      `CONTINUITY: ${shot.continuity || 'Match the established character, location and lighting across the story.'}`,
      `TIMING: ${duration} seconds. No captions, titles, logos or watermarks.`
    ].join('\n')
  }
}
function proseCompose({ shot, index, premise, aspect, duration, genre, style, lockedStyle }) {
  const look = lockedStyle || `${genre.look}, ${style.suffix}`
  const action = endSentence(shot.action || sentence(premise))
  return [
    `${shot.framing || 'Medium shot'} of ${action}.`,
    `Camera: ${shot.camera || 'Slow cinematic camera move'}. Lens: ${shot.lens || '35mm lens'}.`,
    `Light: ${endSentence(shot.lighting || 'cinematic dimensional light')}. Look: ${look}.`,
    shot.directions ? `${endSentence(shot.directions)}.` : '',
    `Continuity: ${endSentence(shot.continuity || 'Preserve established appearance, geography and lighting')}.`,
    `Sound: ${endSentence(shot.sound || shot.cue || 'natural environmental ambience')}.`,
    `${duration} seconds, ${aspect}. Shot ${index + 1}. No captions, titles, logos or watermarks.`
  ].filter(Boolean).join('\n')
}
function proseAdapter(id, mark, markClass) {
  const profile = MODEL_PROFILES[id]
  return { id, label: profile.label, note: profile.providerModel || 'Any video model', mark, markClass, compose: proseCompose }
}
export const modelRegistry = createModelRegistry([
  grok,
  google,
  proseAdapter('sora', 'S', 'model-mark'),
  proseAdapter('kling', 'K', 'model-mark'),
  proseAdapter('runway', 'R', 'model-mark'),
  proseAdapter('luma', 'L', 'model-mark'),
  proseAdapter('wan', 'W', 'model-mark'),
  proseAdapter('generic', '•', 'model-mark')
])
export const MODEL_IDS = modelRegistry.ids
export const REFERENCE_MODEL_NAMES = Object.freeze(['Grok Imagine', 'Google (Veo / Gemini)'])
export const MODEL_OPTIONS = modelRegistry.options

export function canonicalModel(value) {
  return canonicalProfileId(value)
}
