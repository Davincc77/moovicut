export const STUDIO_CHOICES_KEY = 'shotboard.studio.choices.v1'
const STYLES = ['Fun', 'Normal', 'Spicy']
const MODELS = ['grok', 'google']
const SEQUENCE_MODES = ['continuous', 'varied']

function sequenceModeOf(value, fallback = '') {
  return SEQUENCE_MODES.includes(value) ? value : fallback
}

export function readStudioChoices(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(STUDIO_CHOICES_KEY) || '{}')
    return {
      style: STYLES.includes(saved.style) ? saved.style : 'Normal',
      model: MODELS.includes(saved.model) ? saved.model : 'grok',
      sequenceMode: sequenceModeOf(saved.sequenceMode)
    }
  } catch {
    return { style: 'Normal', model: 'grok', sequenceMode: '' }
  }
}

export function writeStudioChoices(storage, choices = {}) {
  const next = {
    style: STYLES.includes(choices.style) ? choices.style : 'Normal',
    model: MODELS.includes(choices.model) ? choices.model : 'grok',
    sequenceMode: sequenceModeOf(choices.sequenceMode, 'continuous')
  }
  storage?.setItem(STUDIO_CHOICES_KEY, JSON.stringify(next))
  return next
}
