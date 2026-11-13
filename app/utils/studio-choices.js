import { canonicalAspect } from './prompt-engine.js'

export const STUDIO_CHOICES_KEY = 'shotboard.studio.choices.v1'
const STYLES = ['Fun', 'Normal', 'Spicy']
const MODELS = ['grok', 'google']
const SEQUENCE_MODES = ['continuous', 'varied']
const STRENGTHS = ['standard', 'strict']
const DENSITIES = ['standard', 'concise']

function sequenceModeOf(value, fallback = '') {
  return SEQUENCE_MODES.includes(value) ? value : fallback
}

function strengthOf(value) {
  return STRENGTHS.includes(value) ? value : 'standard'
}

function densityOf(value) {
  return DENSITIES.includes(value) ? value : 'standard'
}

export function readStudioChoices(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(STUDIO_CHOICES_KEY) || '{}')
    return {
      style: STYLES.includes(saved.style) ? saved.style : 'Normal',
      model: MODELS.includes(saved.model) ? saved.model : 'grok',
      sequenceMode: sequenceModeOf(saved.sequenceMode),
      aspectRatio: canonicalAspect(saved.aspectRatio),
      continuityStrength: strengthOf(saved.continuityStrength),
      promptDensity: densityOf(saved.promptDensity)
    }
  } catch {
    return { style: 'Normal', model: 'grok', sequenceMode: '', aspectRatio: '16:9', continuityStrength: 'standard', promptDensity: 'standard' }
  }
}

export function writeStudioChoices(storage, choices = {}) {
  const next = {
    style: STYLES.includes(choices.style) ? choices.style : 'Normal',
    model: MODELS.includes(choices.model) ? choices.model : 'grok',
    sequenceMode: sequenceModeOf(choices.sequenceMode, 'continuous'),
    aspectRatio: canonicalAspect(choices.aspectRatio),
    continuityStrength: strengthOf(choices.continuityStrength),
    promptDensity: densityOf(choices.promptDensity)
  }
  storage?.setItem(STUDIO_CHOICES_KEY, JSON.stringify(next))
  return next
}
