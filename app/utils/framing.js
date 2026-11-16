/** Fixed cinematic framing. The English term is the source. Other prompt languages translate it. */
import { cleanText } from './text.js'
import { foldName } from './scenario.js'
import { PROMPT_LANGUAGES, framingTermsForMatch, phrase } from './prompt-lang.js'

export const FRAMING_TERMS = Object.freeze([
  { id: 'ecu', label: 'extreme close-up', hint: 'très gros plan', aliases: ['extreme close up', 'close up insert', 'macro insert', 'tres gros plan', 'insert'] },
  { id: 'close', label: 'close-up', hint: 'gros plan', aliases: ['close up', 'closeup', 'gros plan', 'tight close up', 'medium close up'] },
  { id: 'ots', label: 'over-the-shoulder', hint: 'amorce', aliases: ['over the shoulder', 'amorce'] },
  { id: 'pov', label: 'POV', hint: '', aliases: ['point of view', 'pov', 'subjective'] },
  { id: 'high', label: 'high angle', hint: 'plongée', aliases: ['high angle', 'plongee', 'overhead', 'top down', 'birds eye', "bird's eye"] },
  { id: 'low', label: 'low angle', hint: 'contre-plongée', aliases: ['low angle', 'contre plongee', 'hero shot'] },
  { id: 'tracking', label: 'tracking shot', hint: '', aliases: ['lateral tracking', 'tracking shot', 'tracking', 'dolly', 'travelling'] },
  { id: 'crane', label: 'crane shot', hint: '', aliases: ['crane shot', 'crane', 'jib'] },
  { id: 'static', label: 'static shot', hint: '', aliases: ['locked off', 'static shot', 'static'] },
  { id: 'wide', label: 'wide shot', hint: "plan d'ensemble", aliases: ['extreme wide', 'plan d ensemble', 'establishing', 'wide shot', 'full body', 'tableau', 'silhouette', 'environmental', 'wide'] },
  { id: 'medium', label: 'medium shot', hint: 'plan moyen', aliases: ['medium shot', 'plan moyen', 'medium portrait', 'portrait', 'handheld shot', 'medium'] }
])

export function termById(id) {
  return FRAMING_TERMS.find(term => term.id === id) || null
}

export function framingOptionLabel(term) {
  return term.hint ? `${term.label} · ${term.hint}` : term.label
}

function foldFraming(value) {
  return foldName(value).replace(/[-_’']/g, ' ').replace(/\s+/g, ' ')
}

function aliasMatch(text) {
  const folded = foldFraming(text)
  if (!folded) return null
  let best = null
  FRAMING_TERMS.forEach(term => {
    term.aliases.forEach(alias => {
      const needle = foldFraming(alias)
      if (!needle) return
      const at = folded.indexOf(needle)
      if (at < 0) return
      if (!best || needle.length > best.length || (needle.length === best.length && at < best.at)) best = { term, length: needle.length, at }
    })
  })
  return best?.term || null
}

function fromAction(text) {
  const source = foldFraming(text)
  if (/\b(point of view|through (his|her|their) eyes)\b/.test(source)) return termById('pov')
  if (/\b(over the shoulder|from behind)\b/.test(source)) return termById('ots')
  if (/\b(extreme close|macro|insert|fingerprint)\b/.test(source)) return termById('ecu')
  if (/\b(eyes|face|tear|smile|expression)\b/.test(source)) return termById('close')
  if (/\b(from above|looks down|overhead|bird)\b/.test(source)) return termById('high')
  if (/\b(from below|looks up)\b/.test(source)) return termById('low')
  if (/\b(walks|runs|follows|chases|tracking|dollies)\b/.test(source)) return termById('tracking')
  if (/\b(crane|rises over|rising)\b/.test(source)) return termById('crane')
  if (/\b(wide|horizon|skyline|landscape|establish)\b/.test(source)) return termById('wide')
  return termById('medium')
}

/** English framing label for a picker value, an alias, or a translated label such as 特写. */
export function canonicalFramingLabel(value) {
  const direct = aliasMatch(value)
  if (direct) return direct.label
  const folded = foldFraming(value)
  if (!folded) return ''
  for (const term of FRAMING_TERMS) {
    for (const lang of PROMPT_LANGUAGES) {
      const spoken = phrase(lang, term.label)
      if (spoken && foldFraming(spoken) === folded) return term.label
    }
  }
  return ''
}

/** Auto suggestion. An explicit picker choice wins when framingChosen is set. */
export function suggestFraming(shot = {}) {
  if (shot.framingChosen) {
    const chosen = termById(shot.framingTerm)
    if (chosen) return chosen
  }
  const fromFraming = aliasMatch(shot.framing || '')
  if (fromFraming) return fromFraming
  const fromCamera = aliasMatch(shot.camera || '')
  if (fromCamera) return fromCamera
  return fromAction(`${shot.action || ''} ${shot.what || ''} ${shot.title || ''}`)
}

export function promptFraming(shot = {}) {
  return suggestFraming(shot).label
}

export function promptHasFraming(prompt) {
  const folded = foldFraming(prompt)
  if (FRAMING_TERMS.some(term => folded.includes(foldFraming(term.label)))) return true
  return framingTermsForMatch().some(label => folded.includes(foldFraming(label)))
}

export function ensureFramingInPrompt(prompt, label) {
  const text = String(prompt || '')
  const term = cleanText(label)
  if (!term || foldFraming(text).includes(foldFraming(term))) return text
  if (/^Camera:/m.test(text)) return text.replace(/^Camera:\s*/m, `Camera: ${term}, `)
  const sentence = term.charAt(0).toUpperCase() + term.slice(1)
  return `${sentence}: ${text.trim()}`
}
