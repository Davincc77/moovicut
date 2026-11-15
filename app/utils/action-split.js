/** One action per shot. Deterministic splits, no model call. */
import { cleanText } from './text.js'

const ACTION_VERB = /\b(pours?|spills?|runs?|opens?|walks?|enters?|leaves?|rides?|turns?|hands?|gives?|takes?|sits?|stands?|looks?|knocks?|returns?|climbs?|fights?|repairs?|guides?|delivers?|laughs?|reads?|writes?|calls?|falls?|jumps?|flies|holds?|lifts?|removes?|puts?|picks?|grabs?|throws?|catches?|hugs?|waves?|points?|steps?|stops?|starts?|begins?|closes?|cuts?|slices?|serves?|washes?|rinses?|offers?|waits?|follows?|chases?)\b/i

function hasVerb(text) {
  return ACTION_VERB.test(String(text || ''))
}

function clauseParts(text) {
  const clean = cleanText(text).replace(/[.!?]+$/, '')
  if (!clean) return []
  const timed = clean.split(/\s+\b(?:and then|then|while)\b\s+/i).map(part => part.trim()).filter(Boolean)
  if (timed.length >= 2 && timed.filter(hasVerb).length >= 2) return timed
  const joined = clean.split(/\s+\band\b\s+/i).map(part => part.trim()).filter(Boolean)
  if (joined.length >= 2 && joined.every(hasVerb)) return joined
  return [clean]
}

/** A following clause with no subject keeps the subject of the clause before it. */
function inheritSubject(parts) {
  let subject = ''
  return parts.map(part => {
    const pronoun = part.match(/^(she|he|they)\b/i)
    if (pronoun) {
      subject = pronoun[1]
      return part
    }
    const name = part.match(/^(\p{Lu}[\p{L}'’-]{1,40})\b/u)
    if (name && !/^(She|He|They)$/.test(name[1])) {
      if (hasVerb(part)) subject = name[1]
      return part
    }
    if (!subject || !hasVerb(part)) return part
    const lead = /^(she|he|they)$/i.test(subject)
      ? subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase()
      : subject
    return `${lead} ${part.charAt(0).toLowerCase()}${part.slice(1)}`
  })
}

/** Clauses that should become separate shots. Empty when the line is already one action. */
export function splitActionText(text) {
  const clean = cleanText(text)
  if (!clean) return []
  const sentences = clean.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean)
  const pieces = []
  sentences.forEach(sentence => {
    if (!hasVerb(sentence)) return
    pieces.push(...inheritSubject(clauseParts(sentence)))
  })
  if (pieces.length < 2) return []
  return pieces.map(part => part.replace(/[.!?]+$/, ''))
}
