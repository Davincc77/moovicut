/** One action per shot. Deterministic splits, no model call. */
import { cleanText } from './text.js'
import { hasConstraint, joinConstraint } from './physical-constraint.js'
import { STORY_VERB_FORMS } from './story-verbs.js'

const ACTION_VERB_LIST = 'pours?|spills?|runs?|opens?|walks?|enters?|leaves?|rides?|turns?|hands?|gives?|takes?|sits?|stands?|looks?|knocks?|returns?|climbs?|fights?|repairs?|guides?|delivers?|laughs?|reads?|writes?|calls?|falls?|jumps?|flies|holds?|lifts?|removes?|puts?|picks?|grabs?|throws?|catches?|hugs?|waves?|points?|steps?|stops?|starts?|begins?|closes?|cuts?|slices?|serves?|washes?|rinses?|offers?|waits?|follows?|chases?'
const ACTION_VERB = new RegExp(`\\b(?:${ACTION_VERB_LIST})\\b`, 'i')

const LAX_VERB = new RegExp(`\\b(?:${STORY_VERB_FORMS}|${ACTION_VERB_LIST})\\b`, 'i')
const LAX_INFLECTION = /\b\p{L}{3,}(?:s|es|ed|ing|d)\b/iu

/**
 * Strict mode keeps the historical closed vocabulary: the planner segments
 * prose with it and its output must not drift. Lenient mode adds the shared
 * story verbs and an English inflection fallback; only the wizard's split
 * offer uses it, so a multi-beat idea is never a dead end there.
 */
function hasVerb(text, lax = false) {
  const clean = String(text || '')
  if (ACTION_VERB.test(clean)) return true
  if (!lax) return false
  return LAX_VERB.test(clean) || LAX_INFLECTION.test(clean)
}

function clauseParts(text, lax, laxJoin = lax) {
  const clean = cleanText(text).replace(/[.!?]+$/, '')
  if (!clean) return []
  const timed = clean.split(/\s+\b(?:and then|then|while)\b\s+/i).map(part => part.trim()).filter(Boolean)
  if (timed.length >= 2 && timed.filter(part => hasVerb(part, lax)).length >= 2) return timed
  const joined = clean.split(/\s+\band\b\s+/i).map(part => part.trim()).filter(Boolean)
  if (joined.length >= 2 && joined.every(part => hasVerb(part, laxJoin))) return joined
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
export function splitActionText(text, options = {}) {
  // 'timed' : les conjoncteurs explicites (and then/then/while) se decident
  // en vocabulaire large, le simple « and » reste scelle au vocabulaire
  // ferme — une beat authored (« Ama blows the whistle and the train
  // leaves. ») ne se scinde pas sur un capteur elargi. Re-audit 24-11, F1b.
  const lenient = options.lenient === true || options.lenient === 'timed'
  const laxJoin = options.lenient === true
  const clean = cleanText(text)
  if (!clean) return []
  const sentences = clean.split(/(?<=[.!?。！？])\s+/u).map(part => part.trim()).filter(Boolean)
  const pieces = []
  let pending = ''
  const hold = sentence => {
    pending = pending ? joinConstraint(pending, sentence) : cleanText(sentence).replace(/[.!?。！？]+$/u, '')
  }
  sentences.forEach(sentence => {
    if (!hasVerb(sentence, lenient)) {
      if (hasConstraint(sentence)) {
        if (pieces.length) pieces[pieces.length - 1] = joinConstraint(pieces[pieces.length - 1], sentence)
        else hold(sentence)
      }
      return
    }
    const parts = inheritSubject(clauseParts(sentence, lenient, laxJoin))
    if (pending) {
      parts[0] = joinConstraint(parts[0], pending)
      pending = ''
    }
    pieces.push(...parts)
  })
  if (pending && pieces.length) pieces[pieces.length - 1] = joinConstraint(pieces[pieces.length - 1], pending)
  if (pieces.length < 2) return []
  return pieces.map(part => part.replace(/[.!?。！？]+$/u, ''))
}
