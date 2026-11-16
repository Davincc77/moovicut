/** One fixed identity line per character. No model call. The line is copied, not rewritten. */
import { cleanText } from './text.js'
import { findByName, foldName, nameParts } from './scenario.js'
import { phrase } from './prompt-lang.js'

export const SHEET_KEYS = Object.freeze(['front', 'side', 'back', 'expressions', 'palette', 'outfit', 'props'])
const REF_SLOTS = Object.freeze(['front', 'side', 'back'])
const META_LOOK = /^(?:identical in every shot|the same clothes, hair, and face from the first shot)\.?$/i

const COLOR_WORDS = ['black', 'brown', 'blonde', 'blond', 'red', 'ginger', 'auburn', 'silver', 'white', 'grey', 'gray', 'blue', 'green', 'pink', 'purple', 'navy', 'charcoal', 'oatmeal', 'rust', 'gold', 'amber', 'ash']
const HAIR_ANCHOR = /\b(hair|undercut|pixie|bob|bangs|braid)\b/gi
const EYE_ANCHOR = /\beyes?\b/gi
const GARMENT_FAMILIES = Object.freeze([
  ['coat', /\b(peacoats?|overcoats?|coats?)\b/i],
  ['jacket', /\bjackets?\b/i],
  ['scarf', /\b(?:scarves|scarf)\b/i],
  ['apron', /\baprons?\b/i],
  ['sweater', /\bsweaters?\b/i],
  ['boots', /\bboots?\b/i],
  ['dress', /\b(?:dresses|dress)\b/i],
  ['shirt', /\bshirts?\b/i],
  ['suit', /\bsuits?\b/i],
  ['hoodie', /\bhoodies?\b/i],
  ['hakama', /\bhakama\b/i],
  ['cap', /\b(?:caps?|hats?)\b/i]
])
const TRAIT_PHRASE = /\b(?:[\p{L}'’-]+\s+){1,4}(?:hair|undercut|pixie cut|bob|peacoat|overcoat|jacket|coat|scarf|apron|sweater|boots|dress|shirt|suit|hoodie|hakama|cap|hat|glasses|earrings)\b/giu

export function normalizeStates(states) {
  if (!Array.isArray(states)) return []
  return states.map(item => ({
    fromOrder: Math.max(1, Math.min(999, Math.round(Number(item?.fromOrder ?? item?.from) || 1))),
    change: cleanText(item?.change || item?.note || item?.state).slice(0, 160)
  })).filter(item => item.change).slice(0, 12)
}

export function normalizeSheet(sheet) {
  const source = sheet && typeof sheet === 'object' && !Array.isArray(sheet) ? sheet : {}
  const next = {}
  SHEET_KEYS.forEach(key => { next[key] = cleanText(source[key]).slice(0, 600) })
  const refs = Array.isArray(source.refs) ? source.refs : []
  next.refs = REF_SLOTS.map(slot => {
    const found = refs.find(item => item && item.slot === slot) || {}
    const dataUrl = typeof found.dataUrl === 'string' && found.dataUrl.startsWith('data:image/') && found.dataUrl.length <= 180000 ? found.dataUrl : ''
    const ref = { slot, name: cleanText(found.name).slice(0, 80), note: cleanText(found.note).slice(0, 160) }
    if (dataUrl) ref.dataUrl = dataUrl
    return ref
  })
  return next
}

export function asCharacter(character = {}) {
  return {
    name: cleanText(character.name).slice(0, 80),
    look: cleanText(character.look).slice(0, 400),
    outfit: cleanText(character.outfit).slice(0, 300),
    age: cleanText(character.age).slice(0, 160),
    role: cleanText(character.role).slice(0, 160),
    body: cleanText(character.body).slice(0, 160),
    face: cleanText(character.face).slice(0, 200),
    hair: cleanText(character.hair).slice(0, 200),
    colors: cleanText(character.colors).slice(0, 160),
    marks: cleanText(character.marks).slice(0, 200),
    lockLine: typeof character.lockLine === 'string' ? character.lockLine.trim().slice(0, 700) : '',
    lockEdited: character.lockEdited === true,
    states: normalizeStates(character.states),
    sheet: normalizeSheet(character.sheet)
  }
}

function splitClauses(text) {
  return cleanText(text)
    .split(/\s*,\s*/)
    .map(part => part.replace(/^(?:and|the same)\s+/i, '').trim())
    .filter(Boolean)
}

function covers(longer, shorter) {
  const a = foldName(longer)
  const b = foldName(shorter)
  if (!a || !b) return false
  if (a === b) return true
  if (b.length < 4) return false
  return ` ${a} `.includes(` ${b} `) || a.startsWith(`${b} `) || a.endsWith(` ${b}`) || a.includes(`${b} `)
}

export function dedupeParts(texts) {
  const clauses = texts.flatMap(splitClauses)
  const kept = []
  clauses.forEach(clause => {
    const index = kept.findIndex(item => covers(item, clause) || covers(clause, item))
    if (index < 0) kept.push(clause)
    else if (clause.length > kept[index].length) kept[index] = clause
  })
  return kept
}

function usable(text) {
  const clean = cleanText(text)
  if (!clean || META_LOOK.test(clean)) return ''
  return clean
}

/** The lock with no wardrobe change. Same characters always produce the same string. */
export function derivedLockLine(character) {
  const person = asCharacter(character)
  const name = person.name
  if (!name) return ''
  const identity = [person.age, person.role, person.body, person.face, person.hair, person.colors, person.marks, usable(person.look)].filter(Boolean)
  const outfit = usable(person.outfit)
  const parts = dedupeParts([...identity, outfit].filter(Boolean))
  if (!parts.length) return `${name}.`
  return `${name} — ${parts.join(', ')}.`
}

export function activeState(character, order = 1) {
  const person = asCharacter(character)
  const current = Number(order) || 1
  const states = person.states.filter(item => item.fromOrder <= current)
  if (!states.length) return null
  return states.sort((a, b) => a.fromOrder - b.fromOrder).at(-1)
}

function identityParts(person) {
  return dedupeParts([person.age, person.role, person.body, person.face, person.hair, person.colors, person.marks, usable(person.look)].filter(Boolean))
}

/** Byte-stable line for this character at this shot, including a carried wardrobe change. */
export function lockLineFor(character, order = 1, lang = 'en') {
  const line = lockLineEnglish(character, order)
  if (!lang || lang === 'en') return line
  return localizeLockLine(line, character, lang)
}

function lockLineEnglish(character, order = 1) {
  const person = asCharacter(character)
  if (!person.name) return ''
  const state = activeState(person, order)
  if (person.lockEdited && person.lockLine) {
    if (!state) return person.lockLine
    const note = state.change
    if (person.lockLine.includes(note)) return person.lockLine
    const base = person.lockLine.replace(/\.$/, '')
    return `${base}. State: ${note}.`
  }
  if (!state) return derivedLockLine(person)
  const parts = dedupeParts([...identityParts(person), state.change])
  if (!parts.length) return `${person.name} — ${state.change}.`
  return `${person.name} — ${parts.join(', ')}.`
}

function localizeLockLine(line, character, lang) {
  const person = asCharacter(character)
  if (!line || !person.name) return line
  if (person.lockEdited) return line.replace(/\. State: /g, `. ${phrase(lang, 'State:')} `)
  const tail = line.slice(person.name.length).replace(/^ — /, '').replace(/\.$/, '')
  const translated = phrase(lang, tail)
  if (translated === tail) return line
  return `${person.name} — ${translated}.`
}

function nameMentioned(text, name) {
  const needle = foldName(name)
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(foldName(text))
}

/** People actually in this shot. The same rules the prompt compiler uses. */
export function charactersInShot(shot, project = {}) {
  const characters = project.filmSheet?.characters || []
  const named = nameParts(shot?.who)
  if (named.length) {
    return named.map(name => {
      const match = findByName(characters, name)
      if (match) return match
      const lead = project.continuitySheet
      if (lead && foldName(lead.character) === foldName(name)) return { name: lead.character, look: '', outfit: lead.appearance || '' }
      return { name, look: '', outfit: '' }
    })
  }
  const source = [shot?.action, shot?.what, shot?.title].filter(Boolean).join(' ')
  const mentioned = characters.filter(character => nameMentioned(source, character.name))
  if (mentioned.length) return mentioned
  if (characters.length === 1) return [characters[0]]
  const leadName = project.continuitySheet?.character
  if (leadName) return [findByName(characters, leadName) || { name: leadName, look: '', outfit: project.continuitySheet.appearance || '' }]
  return []
}

export function lockLinesForShot(shot, project, index = 0) {
  const order = shot?.order || index + 1
  const lang = project?.promptLanguage || 'en'
  return charactersInShot(shot, project).map(character => lockLineFor(character, order, lang)).filter(Boolean)
}

function pickedExtras(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {}
  const next = {}
  ;['body', 'face', 'hair', 'colors', 'marks'].forEach(key => {
    const value = cleanText(entry[key])
    if (value) next[key] = value.slice(0, 200)
  })
  const age = cleanText(entry.age || entry.years)
  const role = cleanText(entry.role || entry.job || entry.occupation)
  if (age) next.age = age.slice(0, 160)
  if (role) next.role = role.slice(0, 160)
  if (typeof entry.lockLine === 'string' && entry.lockLine.trim()) next.lockLine = entry.lockLine.trim().slice(0, 700)
  if (entry.lockEdited === true) next.lockEdited = true
  if (Array.isArray(entry.states) && entry.states.length) next.states = normalizeStates(entry.states)
  if (entry.sheet && typeof entry.sheet === 'object') next.sheet = normalizeSheet(entry.sheet)
  return next
}

/** Keep sheet fields that scenario parsing does not require. */
export function mergeCharacterExtras(characters, scenario) {
  const raw = scenario && typeof scenario === 'object' && !Array.isArray(scenario) && Array.isArray(scenario.characters) ? scenario.characters : []
  return (characters || []).map(item => {
    const extra = raw.find(entry => foldName(entry?.name || entry?.n) === foldName(item.name))
    if (!extra) return item
    return { ...item, ...pickedExtras(extra) }
  })
}

export function publicSheet(character) {
  const person = asCharacter(character)
  const sheet = {}
  SHEET_KEYS.forEach(key => { if (person.sheet[key]) sheet[key] = person.sheet[key] })
  const refs = person.sheet.refs.filter(ref => ref.name || ref.note).map(({ slot, name, note }) => ({ slot, name, note }))
  if (refs.length) sheet.refs = refs
  return sheet
}

function normalizeColor(word) {
  if (word === 'blond') return 'blonde'
  if (word === 'gray') return 'grey'
  return word
}

function colorsNear(text, anchor) {
  const found = new Set()
  const source = String(text || '')
  const re = new RegExp(anchor.source, anchor.flags.includes('g') ? anchor.flags : `${anchor.flags}g`)
  let match
  while ((match = re.exec(source))) {
    const start = Math.max(0, match.index - 48)
    const window = source.slice(start, match.index + match[0].length + 48)
    COLOR_WORDS.forEach(color => {
      if (new RegExp(`\\b${color}\\b`, 'i').test(window)) found.add(normalizeColor(color))
    })
    if (match.index === re.lastIndex) re.lastIndex += 1
  }
  return found
}

function outfitColors(text) {
  const map = new Map()
  GARMENT_FAMILIES.forEach(([family, pattern]) => {
    if (!pattern.test(text)) return
    map.set(family, colorsNear(text, pattern))
  })
  return map
}

function setsConflict(left, right) {
  if (!left.size || !right.size) return false
  for (const color of left) if (right.has(color)) return false
  return true
}

export function conflictingTrait(lockText, outside) {
  const hairLock = colorsNear(lockText, HAIR_ANCHOR)
  const hairOut = colorsNear(outside, HAIR_ANCHOR)
  if (setsConflict(hairLock, hairOut)) return { kind: 'hair', phrase: [...hairOut].join(' '), replacement: [...hairLock].join(' ') }
  const lockLong = /\blong\b/i.test(lockText) && /\b(?:hair|undercut|pixie|bob|bangs|braid)\b/i.test(lockText)
  const lockShort = /\b(?:short|pixie|undercut|bob)\b/i.test(lockText)
  const outLong = /\blong\s+(?:\w+\s+){0,3}(?:hair|undercut|pixie|bob)\b/i.test(outside)
  const outShort = /\b(short|pixie|undercut|bob)\s+(?:\w+\s+){0,2}(?:hair|cut|undercut)?\b/i.test(outside)
  if (lockShort && outLong) return { kind: 'hair', phrase: 'long hair', replacement: 'the locked hair' }
  if (lockLong && outShort && !lockShort) return { kind: 'hair', phrase: 'short hair', replacement: 'the locked hair' }
  const eyeLock = colorsNear(lockText, EYE_ANCHOR)
  const eyeOut = colorsNear(outside, EYE_ANCHOR)
  if (setsConflict(eyeLock, eyeOut)) return { kind: 'eyes', phrase: `${[...eyeOut][0]} eyes`, replacement: `${[...eyeLock][0]} eyes` }
  const lockOutfit = outfitColors(lockText)
  const outOutfit = outfitColors(outside)
  for (const [family, colors] of outOutfit) {
    const locked = lockOutfit.get(family)
    if (locked && setsConflict(locked, colors)) return { kind: family, phrase: `${[...colors][0]} ${family}`, replacement: `${[...locked][0]} ${family}` }
  }
  return null
}

export function repeatedTraits(line) {
  const source = String(line || '')
  const counts = new Map()
  const re = new RegExp(TRAIT_PHRASE.source, 'giu')
  let match
  while ((match = re.exec(source))) {
    const phrase = match[0].replace(/\s+/g, ' ').trim()
    const key = foldName(phrase)
    if (!key) continue
    const current = counts.get(key) || { phrase, count: 0 }
    current.count += 1
    if (phrase.length > current.phrase.length) current.phrase = phrase
    counts.set(key, current)
    if (match.index === re.lastIndex) re.lastIndex += 1
  }
  return [...counts.values()].filter(item => item.count > 1).map(item => item.phrase)
}

export function dedupePromptLine(prompt) {
  return String(prompt || '').split('\n').map(line => {
    let next = line
    repeatedTraits(next).forEach(trait => {
      const first = next.toLowerCase().indexOf(trait.toLowerCase())
      if (first < 0) return
      const second = next.toLowerCase().indexOf(trait.toLowerCase(), first + trait.length)
      if (second < 0) return
      next = `${next.slice(0, second).replace(/,\s*$/, '')}${next.slice(second + trait.length).replace(/^\s*,\s*/, ', ')}`
    })
    return next.replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim()
  }).join('\n')
}

export function insertLockLines(prompt, lines) {
  const missing = (lines || []).filter(line => line && !String(prompt || '').includes(line))
  if (!missing.length) return prompt || ''
  const block = missing.join('\n')
  const text = String(prompt || '')
  const style = text.match(/^Style:.*$/m)
  if (style) return text.replace(style[0], `${style[0]}\n${block}`)
  const breakAt = text.indexOf('\n')
  if (breakAt >= 0) return `${text.slice(0, breakAt)}\n${block}\n${text.slice(breakAt + 1)}`
  return `${text.trim()}\n${block}`.trim()
}

const WARDROBE_CHANGE = /\b(?:takes off|take off|removes|removed|without (?:his|her|their))\s+(?:the\s+|a\s+|an\s+|his\s+|her\s+|their\s+)?(coat|jacket|scarf|hat|cap|apron|peacoat|sweater|boots|hakama)\b/i
const WARDROBE_SHORT = /\b(coat|jacket|scarf|hat|cap|apron|peacoat|sweater|hakama)\s+(?:is\s+)?(?:removed|off)\b/i

export function wardrobeChangeNote(text) {
  const source = cleanText(text)
  const direct = source.match(WARDROBE_SHORT)
  if (direct) return `${direct[1].toLowerCase()} removed`
  const phrase = source.match(WARDROBE_CHANGE)
  if (phrase) return `${phrase[1].toLowerCase()} removed`
  return ''
}
