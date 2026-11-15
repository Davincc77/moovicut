/**
 * Optional local check of rule candidates.
 * julian-schelb/roberta-ner-multilingual (XLM-R, WikiANN PER/LOC/ORG).
 * The weights are not required: if they are missing or MOOVICUT_NER=0, the rules stand.
 * Licence of the model: see docs/ner.md. This module never calls a paid API.
 */

let enabled = process.env.MOOVICUT_NER !== '0'
let loader = null
let loadError = ''
const cache = new Map()

export function setVerifierEnabled(value) {
  enabled = value !== false && process.env.MOOVICUT_NER !== '0'
}

export function verifierEnabled() {
  return enabled
}

/** Tests inject a classifier. Production loads Transformers.js lazily. */
export function setVerifierLoader(fn) {
  loader = fn || null
  loadError = ''
}

function spans(text, label) {
  return cache.get(`${label}\n${text}`) || null
}

function remember(text, label, found) {
  cache.set(`${label}\n${text}`, found)
}

async function classify(text) {
  if (!loader) {
    try {
      const runtime = await import('@huggingface/transformers')
      loader = async (value) => {
        const model = await runtime.pipeline('token-classification', 'Xenova/roberta-ner-multilingual', { dtype: 'q8' })
        return model(value)
      }
    } catch (error) {
      loadError = error?.message || 'model unavailable'
      return null
    }
  }
  try {
    return await loader(text)
  } catch (error) {
    loadError = error?.message || 'model failed'
    return null
  }
}

function mentions(found, name, kind) {
  if (!Array.isArray(found) || !name) return null
  const key = name.toLowerCase()
  const hit = found.find(item => String(item.word || item.entity || '').toLowerCase().includes(key.slice(0, 12)))
  if (!hit) return null
  const entity = String(hit.entity_group || hit.entity || '')
  if (kind === 'person') return /per/i.test(entity)
  if (kind === 'place') return /loc/i.test(entity)
  return null
}

/**
 * Confirms or vetoes rule candidates. An unsure or missing model leaves the rules unchanged.
 * `people` and `places` are arrays of { name }.
 */
export async function verifyCandidates(text, people = [], places = [], options = {}) {
  const started = Date.now()
  if (options.enabled === false || !enabled) {
    return { used: false, fallback: false, people, places, ms: Date.now() - started }
  }
  const found = spans(text, 'ner') || await classify(text)
  if (!found) {
    return { used: false, fallback: true, reason: loadError || 'model unavailable', people, places, ms: Date.now() - started }
  }
  remember(text, 'ner', found)
  const nextPeople = people.filter(person => mentions(found, person.name, 'person') !== false)
  const nextPlaces = places.filter(place => mentions(found, place.name, 'place') !== false)
  // A veto only applies when the model named the span as the other type. Unsure keeps the rule.
  return {
    used: true,
    fallback: false,
    people: nextPeople.length ? nextPeople : people,
    places: nextPlaces.length ? nextPlaces : places,
    ms: Date.now() - started
  }
}
