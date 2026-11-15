/** One action per shot. Deterministic splits, no model call. */
import { cleanText } from './text.js'

const ACTION_VERB = /\b(pours?|spills?|runs?|opens?|walks?|enters?|leaves?|rides?|turns?|hands?|gives?|takes?|sits?|stands?|looks?|knocks?|returns?|climbs?|fights?|repairs?|guides?|delivers?|laughs?|reads?|writes?|calls?|falls?|jumps?|flies|holds?|lifts?|removes?|puts?|picks?|grabs?|throws?|catches?|hugs?|waves?|points?|steps?|stops?|starts?|begins?|closes?|cuts?|slices?|serves?|washes?|rinses?|offers?|waits?|follows?|chases?)\b/i

function hasVerb(text) {
  return ACTION_VERB.test(String(text || ''))
}

/** Clauses that should become separate shots. Empty when the line is already one action. */
export function splitActionText(text) {
  const clean = cleanText(text)
  if (!clean) return []
  const sentences = clean.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean)
  const verbalSentences = sentences.filter(hasVerb)
  if (sentences.length >= 2 && verbalSentences.length >= 2) return verbalSentences.map(part => part.replace(/[.!?]+$/, ''))
  const timed = clean.split(/\s+\b(?:and then|then|while)\b\s+/i).map(part => part.trim()).filter(Boolean)
  if (timed.length >= 2 && timed.filter(hasVerb).length >= 2) return timed.map(part => part.replace(/[.!?]+$/, ''))
  const joined = clean.split(/\s+\band\b\s+/i).map(part => part.trim()).filter(Boolean)
  if (joined.length >= 2 && joined.every(hasVerb)) return joined.map(part => part.replace(/[.!?]+$/, ''))
  return []
}
