/** Place lemmas. Membership is not a sentence list; a noun still needs a locative frame. */
import data from '../data/place-lexicon.json' with { type: 'json' }

const FULL = new Set(data.lemmas)
let active = FULL

export function placeLexiconHas(word) {
  const key = String(word || '').toLowerCase()
  return key.length > 2 && active.has(key)
}

export function placeLexiconSize() {
  return active.size
}

export function placeLexiconMeta() {
  return {
    size: data.lemmas.length,
    license: data.license,
    attribution: data.attribution,
    builtFrom: data.builtFrom
  }
}

/** Tests use this to drop part of the lexicon and restore it afterwards. */
export function usePlaceLexicon(lemmas) {
  active = new Set(lemmas || data.lemmas)
}

export function placeLexiconLemmas() {
  return data.lemmas
}
