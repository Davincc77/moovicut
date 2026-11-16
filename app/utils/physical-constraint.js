/** Negative physical constraints. Kept in the video prompt. No model call. */
import { cleanText } from './text.js'

const PATTERNS = [
  /\b(?:do not|don't|dont|never|not|without|no)\s+touch(?:ing)?(?:\s+each\s+other)?\b/giu,
  /\b(?:without|no)\s+contact\b/giu,
  /\bsans\s+(?:se\s+)?toucher\b/giu,
  /\bne\s+(?:se\s+touchent\s+pas|pas\s+se\s+toucher)\b/giu,
  /\bsans\s+contact\b/giu,
  /\bsem\s+(?:se\s+)?tocar\b/giu,
  /\bsem\s+contact[oa]\b/giu,
  /\bn[aã]o\s+se\s+tocam\b/giu,
  /\bsenza\s+toccarsi\b/giu,
  /\bsenza\s+toccare\b/giu,
  /\bsenza\s+contatto\b/giu,
  /\bnon\s+si\s+toccano\b/giu,
  /触れずに|触らずに|触れないように|接触せず|接触しない/gu,
  /不接触|不要接触|没有接触|互不接触|互不碰|不碰/gu
]

/** Phrases such as "without touching" or "sans se toucher", in the order they appear. */
export function constraintPhrases(text) {
  const source = String(text || '')
  const found = []
  for (const pattern of PATTERNS) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    const re = new RegExp(pattern.source, flags)
    for (const match of source.matchAll(re)) {
      const phrase = cleanText(match[0])
      if (!phrase) continue
      if (found.some(item => item.toLowerCase() === phrase.toLowerCase())) continue
      found.push(phrase)
    }
  }
  return found.sort((a, b) => source.toLowerCase().indexOf(a.toLowerCase()) - source.toLowerCase().indexOf(b.toLowerCase()))
}

export function hasConstraint(text) {
  return constraintPhrases(text).length > 0
}

function includesPhrase(text, phrase) {
  return String(text || '').toLowerCase().includes(String(phrase || '').toLowerCase())
}

function soften(clause) {
  const clean = cleanText(clause).replace(/[.!?。！？]+$/u, '')
  if (!clean) return ''
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(clean[0])) return clean
  if (/^\p{Lu}/u.test(clean)) return `${clean.charAt(0).toLowerCase()}${clean.slice(1)}`
  return clean
}

/** Attach a constraint clause once. The words stay as written. */
export function joinConstraint(part, extra) {
  const clause = soften(extra)
  if (!clause) return part
  if (includesPhrase(part, clause)) return part
  const base = cleanText(part).replace(/[.!?。！？]+$/u, '')
  return base ? `${base}, ${clause}` : clause
}

function appendClause(line, clause) {
  const extra = soften(clause)
  if (!extra || includesPhrase(line, extra)) return line
  if (/[.。]\s*$/.test(line)) return line.replace(/([.。])\s*$/, `, ${extra}$1`)
  return `${line.replace(/\s*$/, '')}, ${extra}`
}

/** Put any constraint from the action into the prompt when the line would have dropped it. */
export function ensureConstraints(prompt, source) {
  const missing = constraintPhrases(source).filter(phrase => !includesPhrase(prompt, phrase))
  if (!missing.length) return String(prompt || '')
  const lines = String(prompt || '').split('\n')
  const hint = cleanText(source).slice(0, 40).toLowerCase()
  let index = lines.findIndex(line => hint && line.toLowerCase().includes(hint.slice(0, Math.min(16, hint.length))))
  if (index < 0) index = lines.findIndex(line => /:\s*\S/.test(line))
  if (index < 0) index = lines.findIndex(line => line.trim())
  if (index < 0) return [prompt, missing.join(', ')].filter(Boolean).join('\n')
  lines[index] = appendClause(lines[index], missing.join(', '))
  return lines.join('\n')
}
