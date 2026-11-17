/** Ordered lock versions per character. No model call. Each line is copied, not rewritten. */
import { cleanText } from './text.js'
import { findByName, foldName, nameParts } from './scenario.js'
import { phrase } from './prompt-lang.js'
import { keptTrait, namedWornAndCarried } from './prose-extra.js'
import { placeIsSure, settingName } from './place-lexicon.js'

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
  ['cape', /\b(?:capes?|capas?)\b/i],
  ['cap', /\b(?:caps?|hats?)\b/i],
  ['cloak', /\b(?:cloaks?|capas?)\b/i],
  ['blazer', /\bblazers?\b/i],
  ['raincoat', /\b(?:raincoats?|impermeáveis|impermeaveis|gabardinas?)\b/i],
  ['parka', /\bparkas?\b/i],
  ['cardigan', /\bcardigans?\b/i],
  ['waistcoat', /\bwaistcoats?\b/i],
  ['gloves', /\bgloves?\b/i],
  ['anorak', /\banoraks?\b/i]
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
    items: cleanText(character.items || character.props || character.carried).slice(0, 240),
    lockLine: typeof character.lockLine === 'string' ? character.lockLine.trim().slice(0, 700) : '',
    lockEdited: character.lockEdited === true,
    states: normalizeStates(character.states),
    locks: Array.isArray(character.locks) ? character.locks.map(item => ({ ...item })) : [],
    sheet: normalizeSheet(character.sheet)
  }
}

function orderOf(item) {
  const raw = item?.fromOrder ?? item?.from ?? item?.shot ?? item?.fromShot
  const match = String(raw ?? '').match(/\d+/)
  const order = match ? Number(match[0]) : 0
  return Number.isInteger(order) && order > 0 ? order : 0
}

function publicLocks(locks) {
  if (!Array.isArray(locks)) return []
  return locks.slice(0, 12).map(item => {
    const fromOrder = orderOf(item)
    if (!fromOrder) return null
    const next = { fromOrder }
    ;['age', 'role', 'body', 'face', 'hair', 'colors', 'marks', 'look', 'outfit', 'items'].forEach(key => {
      const value = cleanText(item?.[key])
      if (value) next[key] = value.slice(0, 300)
    })
    return next
  }).filter(Boolean)
}

function splitClauses(text) {
  return cleanText(text)
    .split(/\s*,\s*/)
    .map(part => part.replace(/^(?:and|the same)\s+/i, '').trim())
    .filter(Boolean)
}

function covers(longer, shorter) {
  const a = foldName(longer).replace(/-/g, ' ')
  const b = foldName(shorter).replace(/-/g, ' ')
  if (!a || !b) return false
  if (a === b) return true
  if (b.length < 4) return false
  return ` ${a} `.includes(` ${b} `)
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
  const items = usable(person.items)
  const parts = dedupeParts([...identity, outfit, items].filter(Boolean))
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
  const version = versionAt(person.locks, order)
  if (version) return lockFromVersion(person, version)
  if (!state) return derivedLockLine(person)
  const parts = dedupeParts([...identityParts(person), usable(person.items), state.change])
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

function characterNamedIn(text, character, characters) {
  if (nameMentioned(text, character.name)) return true
  const tokens = String(character.name || '').split(/\s+/).filter(token => foldName(token).length >= 3)
  return tokens.some(token => {
    if (!nameMentioned(text, token)) return false
    const owners = characters.filter(other => other.name.split(/\s+/).some(part => foldName(part) === foldName(token)))
    return owners.length === 1
  })
}

function personFromWho(name, characters, project) {
  const match = findByName(characters, name)
  if (match) return match
  const lead = project.continuitySheet
  if (lead && foldName(lead.character) === foldName(name)) return { name: lead.character, look: '', outfit: lead.appearance || '' }
  return { name, look: '', outfit: '' }
}

/** People actually in this shot. A name in the action counts, not only the `who` subject. */
export function charactersInShot(shot, project = {}) {
  const characters = project.filmSheet?.characters || []
  const named = nameParts(shot?.who)
  const source = [shot?.action, shot?.what, shot?.title].filter(Boolean).join(' ')
  const found = []
  const add = person => {
    if (!person?.name) return
    if (found.some(item => foldName(item.name) === foldName(person.name))) return
    found.push(person)
  }
  const chunks = []
  named.forEach(part => {
    const bits = part.split(/\s+\be\b\s+/i)
    if (bits.length > 1 && bits.every(bit => findByName(characters, bit))) chunks.push(...bits)
    else chunks.push(part)
  })
  chunks.forEach(name => add(personFromWho(name, characters, project)))
  characters.forEach(character => {
    if (characterNamedIn(source, character, characters)) add(character)
  })
  if (found.length) return found
  if (characters.length === 1) return [characters[0]]
  const leadName = project.continuitySheet?.character
  if (leadName) return [findByName(characters, leadName) || { name: leadName, look: '', outfit: project.continuitySheet.appearance || '' }]
  return []
}

export function lockLinesForShot(shot, project, index = 0) {
  ensureLockVersions(project)
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
  const items = cleanText(entry.items || entry.props || entry.carried)
  if (age) next.age = age.slice(0, 160)
  if (role) next.role = role.slice(0, 160)
  if (items) next.items = items.slice(0, 240)
  if (typeof entry.lockLine === 'string' && entry.lockLine.trim()) next.lockLine = entry.lockLine.trim().slice(0, 700)
  if (entry.lockEdited === true) next.lockEdited = true
  if (Array.isArray(entry.states) && entry.states.length) next.states = normalizeStates(entry.states)
  const declared = declaredLockInput(entry)
  if (declared.length) next.locks = declared
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

const COMPUTED = Symbol('lockVersion')
const userLockMap = new WeakMap()
const appliedVersions = new WeakMap()
const versionWarnings = new WeakMap()
const VERB_RULES = Object.freeze([
  { op: 'replace', re: /(?<![\p{L}])(?:changes?\s+into|troca\s+de\s+roupa)(?![\p{L}])/iu },
  { op: 'wear', re: /(?<![\p{L}])(?:puts?\s+on|veste|vestem|põe|poe|põem|poem)(?![\p{L}])/iu },
  { op: 'remove', re: /(?<![\p{L}])(?:takes?\s+off|take\s+off|removes?|tira|tiram|despe|despem)(?![\p{L}])/iu },
  { op: 'pickup', re: /(?<![\p{L}])(?:picks?\s+up|pick\s+up|grabs?|pega|pegam|agarra|agarram|receives?|recebe|recebem)(?![\p{L}])/iu },
  { op: 'drop', re: /(?<![\p{L}])(?:drops?|sets?\s+down|set\s+down|larga|largam|pousa|pousam)(?![\p{L}])/iu },
  { op: 'hand', re: /(?<![\p{L}])(?:hands?(?:\s+over)?|entrega|entregam)(?![\p{L}])/iu },
  { op: 'return', re: /(?<![\p{L}])(?:returns?|gives?\s+back|hands?\s+back|devolve|devolvem)(?![\p{L}])/iu },
  { op: 'carry', re: /(?<![\p{L}])(?:carries|carrying|carrega|carregam|leva|levam|traz|trazem)(?![\p{L}])/iu }
])

function versionAt(locks, order) {
  const current = Number(order) || 1
  const list = (locks || []).filter(item => item && item.fromOrder <= current && item[COMPUTED] !== false)
  if (!list.length) return null
  return list.sort((a, b) => a.fromOrder - b.fromOrder).at(-1)
}

function lockFromVersion(person, version) {
  const next = { ...person, states: [], lockEdited: false, lockLine: '' }
  ;['age', 'role', 'body', 'face', 'hair', 'colors', 'marks', 'look', 'outfit', 'items'].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(version, key)) next[key] = version[key]
  })
  return derivedLockLine(next)
}

function snapshotOf(person) {
  return {
    age: person.age || '',
    role: person.role || '',
    body: person.body || '',
    face: person.face || '',
    hair: person.hair || '',
    colors: person.colors || '',
    marks: person.marks || '',
    look: person.look || '',
    outfit: person.outfit || '',
    items: person.items || ''
  }
}

function hasToken(text, value) {
  const needle = foldName(value)
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(foldName(text))
}

function garmentFamily(text) {
  const source = String(text || '')
  for (const [family, pattern] of GARMENT_FAMILIES) {
    if (pattern.test(source)) return family
  }
  return ''
}

function related(text, value) {
  if (!text || !value) return false
  if (hasToken(text, value) || hasToken(value, text)) return true
  const tail = foldName(value).split(/\s+/).filter(Boolean).at(-1) || ''
  if (tail.length >= 3 && hasToken(text, tail)) return true
  const left = garmentFamily(text)
  const right = garmentFamily(value)
  return Boolean(left && right && left === right)
}

function fieldClauses(text) {
  const ageJoin = /^(?:vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/iu
  const ageUnit = /^(?:um|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|one|two|three|four|five|six|seven|eight|nine)\b/iu
  return cleanText(text).split(/\s*,\s*/).flatMap(part => {
    const pieces = part.split(/\s+\b(?:and|e)\b\s+/iu).map(piece => piece.trim()).filter(Boolean)
    if (pieces.length === 2 && ageJoin.test(pieces[0]) && ageUnit.test(pieces[1])) return [part.trim()]
    return pieces
  })
}

function writeClauses(parts) {
  return parts.filter(Boolean).join(', ')
}

function withoutRelated(text, value) {
  return writeClauses(fieldClauses(text).filter(part => !related(part, value)))
}

function withClause(text, value) {
  const clean = cleanText(value)
  if (!clean) return text || ''
  const parts = fieldClauses(text)
  if (parts.some(part => related(part, clean))) return writeClauses(parts)
  parts.push(clean)
  return writeClauses(parts)
}

function namesIn(text, characters) {
  return (characters || []).filter(person => hasToken(text, person.name))
}

function singleWho(who, characters) {
  const parts = nameParts(who)
  if (parts.length !== 1) return ''
  const found = (characters || []).find(person => foldName(person.name) === foldName(parts[0]))
  return found?.name || ''
}

function shotPlain(shot) {
  return [shot?.what, shot?.action].filter(Boolean).join('. ')
}

function sentencesOf(text) {
  const source = String(text || '')
  const parts = []
  const re = /[^.!?。！？]+[.!?。！？]?/gu
  let match
  while ((match = re.exec(source))) {
    if (cleanText(match[0])) parts.push({ text: match[0], index: match.index })
    if (match.index === re.lastIndex) re.lastIndex += 1
  }
  if (!parts.length && cleanText(source)) parts.push({ text: source, index: 0 })
  return parts
}

const OBJECT_ARTICLE = new Set(['the', 'a', 'an', 'his', 'her', 'their', 'its', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'meus', 'minhas', 'este', 'esta', 'esse', 'essa', 'aquele', 'aquela'])
const OBJECT_PRONOUN = new Set(['him', 'her', 'them', 'it', 'me', 'you', 'lhe', 'lo', 'la', 'ele', 'ela', 'eles', 'elas', 'isso', 'isto'])
const OBJECT_STOP = new Set(['to', 'for', 'at', 'in', 'on', 'into', 'onto', 'from', 'over', 'with', 'upon', 'down', 'up', 'off', 'para', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'à', 'aos', 'às', 'com', 'por', 'pelo', 'pela', 'sobre', 'até', 'ate', 'num', 'numa', 'and', 'e', 'then', 'while', 'before', 'after', 'quando', 'when'])
const OBJECT_OF = new Set(['de', 'do', 'da', 'dos', 'das', 'of'])
const ABSTRACT_NOUN = new Set(['hope', 'fear', 'love', 'hate', 'idea', 'thought', 'memory', 'dream', 'name', 'voice', 'courage', 'luck', 'truth', 'time', 'moment', 'chance', 'silence', 'light', 'darkness', 'distance', 'place', 'circle', 'way', 'joy', 'sorrow', 'anger', 'doubt', 'faith', 'peace', 'life', 'death', 'beauty', 'pain', 'wish', 'secret', 'reason', 'sense', 'feeling', 'meaning', 'purpose', 'pride', 'shame', 'guilt', 'trust', 'power', 'freedom', 'justice', 'soul', 'mind', 'rest', 'sleep', 'hurry', 'weather', 'fate', 'destiny', 'spirit', 'attention', 'trouble', 'help', 'honor', 'honour', 'esperanca', 'medo', 'amor', 'odio', 'ideia', 'pensamento', 'memoria', 'sonho', 'nome', 'voz', 'coragem', 'sorte', 'verdade', 'tempo', 'momento', 'silencio', 'luz', 'escuridao', 'distancia', 'lugar', 'circulo', 'caminho', 'alegria', 'tristeza', 'raiva', 'duvida', 'fe', 'paz', 'vida', 'morte', 'beleza', 'dor', 'segredo', 'razao', 'sentido', 'honra', 'orgulho', 'vergonha', 'culpa', 'confianca', 'poder', 'liberdade', 'justica', 'alma', 'mente', 'descanso', 'sono', 'pressa', 'vez', 'jeito', 'modo'])
const BODY_NOUN = new Set(['hand', 'hands', 'head', 'arm', 'arms', 'leg', 'legs', 'foot', 'feet', 'finger', 'fingers', 'eye', 'eyes', 'face', 'hair', 'mouth', 'ear', 'ears', 'nose', 'shoulder', 'shoulders', 'mao', 'maos', 'rosto', 'cabelo', 'cabeca', 'braco', 'perna', 'olho', 'olhos', 'boca', 'nariz', 'pe', 'pes', 'dedo', 'dedos'])
const ACTION_HEAD = new Set(['walks', 'runs', 'sits', 'waits', 'waves', 'opens', 'closes', 'reads', 'turns', 'enters', 'leaves', 'goes', 'comes', 'looks', 'stands', 'smiles', 'nods', 'bows', 'checks', 'taps', 'stacks', 'espera', 'acena', 'abre', 'fecha', 'senta', 'corre', 'caminha', 'entra', 'sai', 'le', 'olha'])
const GARMENT_HEAD = /(?<![\p{L}])(?:cardigans?|waistcoats?|jumpers?|pullovers?|overalls|dungarees|gloves?|goggles|coletes?|vestidos?|casacos?|jaquetas?|blusas?|saias?|calças|calcas|camisas?|aprons?|coats?|jackets?|dresses?|shirts?|sweaters?|peacoats?|cloaks?|robes?|uniforms?|skirts?|blouses?|trousers|pants|hats?|caps?|scarves?|scarfs?|avental|aventais|jardineiras?|luvas?|camisolas?|macacões|macacoes|macacão|macacao|suits?|parkas?|anoraks?|fatos?|fardas?|lenços|lencos|lenço|lenco|cachecóis|cachecois|cachecol|chapéus|chapeus|chapéu|chapeu|hakama|hoodies?|boots?)(?![\p{L}])/iu

function isPlaceNoun(word) {
  const key = foldName(word)
  if (!key || key.length < 3) return false
  if (placeIsSure('en', key) || placeIsSure('pt', key)) return true
  const named = settingName(key, 'en') || settingName(key, 'pt')
  return Boolean(named) && foldName(named) === key
}

function isGarmentPhrase(phrase) {
  return Boolean(garmentFamily(phrase) || GARMENT_HEAD.test(phrase))
}

function rejectedObject(phrase) {
  const words = foldName(phrase).split(/\s+/).filter(Boolean)
  const head = words.at(-1) || ''
  if (!head || head.length < 2) return true
  if (ABSTRACT_NOUN.has(head) || BODY_NOUN.has(head) || ACTION_HEAD.has(head) || OBJECT_ARTICLE.has(head) || OBJECT_PRONOUN.has(head)) return true
  if (isPlaceNoun(head) || isPlaceNoun(phrase)) return true
  if (words.length === 1 && OBJECT_STOP.has(head)) return true
  return false
}

function phraseFromObjectWords(words, characters) {
  let index = 0
  while (index < words.length) {
    const folded = foldName(words[index])
    if (OBJECT_ARTICLE.has(folded) || OBJECT_PRONOUN.has(folded)) {
      index += 1
      continue
    }
    if ((characters || []).some(person => foldName(person.name) === folded || person.name.split(/\s+/).some(part => foldName(part) === folded && folded.length >= 3))) {
      index += 1
      continue
    }
    break
  }
  const collected = []
  while (index < words.length && collected.length < 5) {
    const word = words[index]
    const folded = foldName(word)
    if (!folded) break
    if (collected.length && (OBJECT_STOP.has(folded) || OBJECT_ARTICLE.has(folded) || OBJECT_PRONOUN.has(folded))) break
    if (collected.length && (characters || []).some(person => foldName(person.name) === folded)) break
    if (OBJECT_OF.has(folded)) {
      const next = words[index + 1]
      const nextFold = foldName(next)
      if (!next || OBJECT_ARTICLE.has(nextFold) || isPlaceNoun(nextFold) || (characters || []).some(person => foldName(person.name) === nextFold)) break
      collected.push(word)
      index += 1
      continue
    }
    if (!collected.length && (ABSTRACT_NOUN.has(folded) || isPlaceNoun(folded))) return ''
    collected.push(word)
    index += 1
  }
  while (collected.length && OBJECT_OF.has(foldName(collected.at(-1)))) collected.pop()
  const phrase = cleanText(collected.join(' '))
  if (!phrase || phrase.length > 80 || rejectedObject(phrase)) return ''
  return phrase
}

/** Concrete noun after a carry, hand, pick-up, or drop. Abstracts and places are not items. */
function concreteObjectPhrases(text, characters) {
  const found = []
  String(text || '').split(/\s+\b(?:and|e)\b\s+/iu).forEach(part => {
    const words = part.match(/[\p{L}][\p{L}'’-]*/gu) || []
    const phrase = phraseFromObjectWords(words, characters)
    if (!phrase) return
    if (found.some(item => related(item, phrase) || related(phrase, item))) return
    found.push(phrase)
  })
  return found
}

function objectsAfterVerb(after, characters) {
  const listed = namedWornAndCarried(after)
  concreteObjectPhrases(after, characters).forEach(phrase => {
    const garments = isGarmentPhrase(phrase)
    const bucket = garments ? listed.garments : listed.items
    const other = garments ? listed.items : listed.garments
    if ([...bucket, ...other].some(item => related(item, phrase) || related(phrase, item))) return
    bucket.push(phrase)
  })
  return listed
}

function sheetHasValue(person, value) {
  if (!person) return false
  return related(`${person.outfit || ''} ${person.items || ''} ${person.look || ''} ${person.props || ''} ${person.carried || ''}`, value)
}

function originalClause(person, value) {
  if (!person || !value) return ''
  const blob = [person.outfit, person.items, person.look, person.props, person.carried].filter(Boolean).join(', ')
  return fieldClauses(blob).find(part => related(part, value)) || ''
}

function storyEvents(shots, characters) {
  const events = []
  ;(shots || []).forEach((shot, index) => {
    const order = shot?.order || index + 1
    sentencesOf(shotPlain(shot)).forEach(sentence => {
      const found = []
      for (const rule of VERB_RULES) {
        const flags = rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`
        const re = new RegExp(rule.re.source, flags)
        let match
        while ((match = re.exec(sentence.text))) {
          found.push({ op: rule.op, index: match.index, length: match[0].length })
          if (match.index === re.lastIndex) re.lastIndex += 1
        }
      }
      found.sort((a, b) => a.index - b.index)
      found.forEach((verb, verbIndex) => {
        const before = sentence.text.slice(0, verb.index)
        const afterEnd = found[verbIndex + 1]?.index ?? sentence.text.length
        const after = sentence.text.slice(verb.index + verb.length, afterEnd)
        const named = namesIn(before, characters)
        const who = singleWho(shot?.who, characters)
        let actor = ''
        if (named.length === 1) actor = named[0].name
        else if (who && (named.length === 0 || named.some(person => foldName(person.name) === foldName(who)))) actor = who
        if (!actor) return
        const objects = objectsAfterVerb(after, characters)
        const receiver = namesIn(after, characters).find(person => foldName(person.name) !== foldName(actor))
        const actorSheet = (characters || []).find(person => foldName(person.name) === foldName(actor))
        const push = (op, value, field, target) => {
          const clean = cleanText(value)
          if (!clean || !target) return
          if (events.some(item => item.order === order && item.op === op && foldName(item.actor) === foldName(target) && foldName(item.value) === foldName(clean))) return
          events.push({ order, op, actor: target, value: clean, field })
        }
        if (verb.op === 'wear' || verb.op === 'replace') {
          objects.garments.forEach(value => push(verb.op, value, 'outfit', actor))
        } else if (verb.op === 'remove') {
          objects.garments.forEach(value => push('remove', value, 'outfit', actor))
          objects.items.forEach(value => push('remove', value, 'items', actor))
        } else if (verb.op === 'pickup') {
          objects.items.forEach(value => push('add', value, 'items', actor))
          objects.garments.forEach(value => push('wear', value, 'outfit', actor))
        } else if (verb.op === 'drop') {
          objects.items.forEach(value => push('remove', value, 'items', actor))
          objects.garments.forEach(value => push('remove', value, 'outfit', actor))
        } else if (verb.op === 'hand') {
          ;[...objects.items.map(value => ({ value, field: 'items' })), ...objects.garments.map(value => ({ value, field: 'outfit' }))].forEach(item => {
            if (sheetHasValue(actorSheet, item.value)) push('remove', item.value, item.field, actor)
            if (receiver) push('add', item.value, item.field, receiver.name)
          })
        } else if (verb.op === 'carry') {
          objects.items.forEach(value => { if (!sheetHasValue(actorSheet, value)) push('add', value, 'items', actor) })
          objects.garments.forEach(value => { if (!sheetHasValue(actorSheet, value)) push('wear', value, 'outfit', actor) })
        } else if (verb.op === 'return') {
          let values = objects.items.filter(value => !/^(?:it|o|a|lo|la|isso|isto)$/iu.test(value))
          if (!values.length) {
            const recent = [...events].reverse().find(item => item.field === 'items')
            if (recent) values = [recent.value]
          }
          values.forEach(value => {
            const prior = [...events].reverse().find(item => item.field === 'items' && foldName(item.actor) !== foldName(actor) && related(item.value, value))
            const holder = (characters || []).find(person => foldName(person.name) !== foldName(actor) && (sheetHasValue(person, value) || (prior && foldName(person.name) === foldName(prior.actor))))
            const owner = holder?.name || prior?.actor || ''
            const restored = originalClause(holder || (characters || []).find(person => foldName(person.name) === foldName(owner)), value) || value
            push('remove', value, 'items', actor)
            if (owner) push('add', restored, 'items', owner)
          })
        }
      })
    })
  })
  return events
}

function readDeclaredOrder(entry, shotCount) {
  const raw = entry?.fromOrder ?? entry?.from ?? entry?.shot ?? entry?.fromShot
  if (raw == null || raw === '') return { invalid: false, order: 0 }
  const text = String(raw).trim()
  const match = text.match(/\d+/)
  const order = match ? Number(match[0]) : NaN
  if (!Number.isInteger(order) || order < 1) return { invalid: true, value: text.slice(0, 40) }
  if (shotCount > 0 && order > shotCount) return { invalid: true, value: String(order) }
  return { invalid: false, order, value: String(order) }
}

export function declaredLockInput(entry) {
  const fromLocks = Array.isArray(entry?.locks) ? entry.locks : []
  const fromStates = Array.isArray(entry?.states) ? entry.states.filter(item => item && (item.outfit || item.items || item.props || item.carried || item.age || item.look)) : []
  return publicLocks([...fromLocks, ...fromStates.map(item => ({
    fromOrder: item.fromOrder ?? item.from ?? item.shot,
    outfit: item.outfit,
    items: item.items || item.props || item.carried,
    age: item.age,
    look: item.look
  }))])
}

function userLocks(person) {
  if (userLockMap.has(person)) return userLockMap.get(person)
  const raw = Array.isArray(person?.locks) ? person.locks.filter(item => !item?.[COMPUTED]) : []
  const copy = declaredLockInput({ locks: raw })
  userLockMap.set(person, copy)
  return copy
}

function noteOperation(note) {
  const text = cleanText(note)
  if (!text) return null
  const worn = text.match(/^(?:puts?\s+on|put\s+on|veste|põe|poe|põem|poem)\s+(?:the\s+|a\s+|an\s+|o\s+|os\s+|as\s+|um\s+|uma\s+)?(.+)$/iu)
  if (worn) return { op: 'wear', value: cleanText(worn[1]), field: 'outfit' }
  const taken = text.match(/^(?:takes?\s+off|take\s+off|removes?|tira|tiram|despe|despem)\s+(?:the\s+|a\s+|an\s+|o\s+|os\s+|as\s+|um\s+|uma\s+|seu\s+|sua\s+)?(.+)$/iu)
  if (taken) return { op: 'remove', value: cleanText(taken[1]), field: 'outfit' }
  const removed = text.match(/^(.+?)\s+(?:removed|tirado|tirada|despido|despida)$/iu)
  if (removed) return { op: 'remove', value: cleanText(removed[1]), field: 'outfit' }
  return null
}

function sameSnapshot(left, right) {
  return ['age', 'role', 'body', 'face', 'hair', 'colors', 'marks', 'look', 'outfit', 'items'].every(key => (left?.[key] || '') === (right?.[key] || ''))
}

function applyToSnapshot(snapshot, event) {
  const next = { ...snapshot }
  if (event.op === 'replace' && event.field === 'outfit') next.outfit = cleanText(event.value)
  else if (event.op === 'wear' || event.op === 'add') next[event.field] = withClause(next[event.field], event.value)
  else if (event.op === 'remove') {
    next.outfit = withoutRelated(next.outfit, event.value)
    next.items = withoutRelated(next.items, event.value)
    next.look = withoutRelated(next.look, event.value)
  } else if (event.op === 'declare') {
    if (event.outfit) next.outfit = withClause(next.outfit, event.outfit)
    if (event.items) next.items = withClause(next.items, event.items)
    if (event.age) next.age = event.age
    if (event.look) next.look = withClause(next.look, event.look)
  }
  return next
}

function mentionedBefore(shots, order, value) {
  return (shots || []).some((shot, index) => (shot?.order || index + 1) < order && related(shotPlain(shot), value))
}

export function lockVersionWarnings(project) {
  return versionWarnings.get(project) || []
}

function signature(project) {
  const shots = (project.shots || []).map(shot => `${shot.order}|${shot.who || ''}|${shot.what || ''}|${shot.action || ''}`).join('\n')
  const people = (project.filmSheet?.characters || []).map(person => JSON.stringify({
    name: person.name,
    age: person.age,
    look: person.look,
    outfit: person.outfit,
    items: person.items,
    states: person.states,
    locks: userLocks(person)
  })).join('\n')
  return `${shots}\n${people}`
}

export function ensureLockVersions(project) {
  if (!project?.filmSheet?.characters?.length || !project.shots?.length) return
  const sign = signature(project)
  if (appliedVersions.get(project) === sign) return
  applyLockVersions(project)
  appliedVersions.set(project, sign)
}

function scrubChangeText(snapshot) {
  const cleanClause = part => {
    const text = cleanText(part)
    if (!text) return ''
    if (/(?:takes?\s+off|take\s+off|removes?|tira|tiram|despe|despem)\b/iu.test(text) || /^(?:off|out)\s+/iu.test(text)) {
      const worn = namedWornAndCarried(text)
      return worn.garments[0] || worn.items[0] || ''
    }
    if (/(?:puts?\s+on|put\s+on|veste|vestem|põe|poe|poem)\s+(?:o|a|os|as|the)\b/iu.test(text)) return ''
    if (/(?:pulls?|puxa|puxam)\b/iu.test(text)) {
      const worn = namedWornAndCarried(text)
      return worn.items[0] || worn.garments[0] || ''
    }
    if (/^\p{Lu}[\p{L}'’-]+\s+(?:tira|veste|pulls|takes|lava|yawns|boceja)\b/u.test(text)) {
      const worn = namedWornAndCarried(text)
      if (/(?:tira|takes|despe|removes)/iu.test(text)) return worn.garments[0] || worn.items[0] || ''
      return ''
    }
    return keptTrait(text) || ''
  }
  const next = { ...snapshot }
  ;['look', 'outfit', 'items'].forEach(key => {
    const original = fieldClauses(next[key])
    const cleaned = original.map(cleanClause)
    const changed = original.length !== cleaned.filter(Boolean).length || original.some((part, index) => cleanText(part) !== cleanText(cleaned[index] || ''))
    if (changed) next[key] = writeClauses(cleaned.filter(Boolean))
  })
  return next
}

function applyLockVersions(project) {
  const characters = project.filmSheet.characters
  const shots = project.shots || []
  const warnings = []
  const events = storyEvents(shots, characters)
  characters.forEach(person => {
    if (!person?.name) return
    const declared = userLocks(person)
    let current = scrubChangeText(snapshotOf(asCharacter(person)))
    const additions = events.filter(event => foldName(event.actor) === foldName(person.name) && (event.op === 'wear' || event.op === 'add' || event.op === 'replace'))
    additions.forEach(event => {
      if (mentionedBefore(shots, event.order, event.value)) return
      current.outfit = withoutRelated(current.outfit, event.value)
      current.items = withoutRelated(current.items, event.value)
      current.look = withoutRelated(current.look, event.value)
    })
    const planned = []
    events.filter(event => foldName(event.actor) === foldName(person.name)).forEach(event => planned.push(event))
    declared.forEach(entry => {
      const parsed = readDeclaredOrder(entry, shots.length)
      if (parsed.invalid) {
        warnings.push({
          character: person.name,
          field: 'fromOrder',
          value: parsed.value,
          source: 'sheet',
          code: 'lock_version',
          message: `${person.name}: lock version from shot ${parsed.value} is outside this board.`
        })
        return
      }
      if (!parsed.order) return
      planned.push({ order: parsed.order, op: 'declare', outfit: entry.outfit, items: entry.items, age: entry.age, look: entry.look, actor: person.name })
    })
    normalizeStates(person.states).forEach(state => {
      const op = noteOperation(state.change)
      if (!op) return
      planned.push({ order: state.fromOrder, op: op.op, value: op.value, field: op.field, actor: person.name })
    })
    planned.sort((a, b) => a.order - b.order)
    const versions = [{ fromOrder: 1, ...current }]
    planned.forEach(event => {
      const nextSnap = applyToSnapshot(current, event)
      if (sameSnapshot(current, nextSnap)) return
      current = nextSnap
      const last = versions[versions.length - 1]
      const next = { fromOrder: event.order, ...current }
      if (event.order <= last.fromOrder) versions[versions.length - 1] = { ...next, fromOrder: last.fromOrder }
      else versions.push(next)
    })
    const baseLine = derivedLockLine(person)
    const lines = versions.map(version => lockFromVersion(person, version))
    if (lines.length === 1 && lines[0] === baseLine) {
      if (person.locks?.some(item => item?.[COMPUTED])) delete person.locks
      return
    }
    person.locks = versions.map(version => ({ ...version, [COMPUTED]: true }))
  })
  versionWarnings.set(project, warnings)
}

const WARDROBE_GARMENT = 'coat|jacket|scarf|hat|cap|apron|peacoat|sweater|boots|hakama|casaco|jaqueta|lenço|lenco|cachecol|chapéu|chapeu|avental|colete|camisola|botas|fato|farda|vestido|camisa|saia|blusa|parka|cardigan|cloak|anorak'
const WARDROBE_CHANGE = new RegExp(`(?<![\\p{L}])(?:takes?\\s+off|take\\s+off|removes?|tira|tiram|despe|despem|without(?:\\s+(?:his|her|their))?|sem)\\s+(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+|o\\s+|os\\s+|as\\s+|um\\s+|uma\\s+|seu\\s+|sua\\s+)?(${WARDROBE_GARMENT})(?![\\p{L}])`, 'iu')
const WARDROBE_SHORT = new RegExp(`(?<![\\p{L}])(${WARDROBE_GARMENT})\\s+(?:is\\s+)?(?:removed|off|tirado|tirada|despido|despida)(?![\\p{L}])`, 'iu')

export function wardrobeChangeNote(text) {
  const source = cleanText(text)
  const direct = source.match(WARDROBE_SHORT)
  if (direct) return `${direct[1].toLowerCase()} removed`
  const phrase = source.match(WARDROBE_CHANGE)
  if (phrase) return `${phrase[1].toLowerCase()} removed`
  return ''
}

/** True when the versioned lock already removed or added the garment this note names. */
export function lockReflectsWardrobe(character, order, note) {
  const op = noteOperation(note)
  if (!op?.value) return false
  const person = asCharacter(character)
  const bare = { ...person, states: [], locks: [], lockEdited: false, lockLine: '' }
  const before = Number(order) > 1 ? lockLineEnglish(person, Number(order) - 1) : derivedLockLine(bare)
  const current = lockLineEnglish(person, order)
  if (op.op === 'remove') return related(before, op.value) && !related(current, op.value)
  if (op.op === 'wear' || op.op === 'add') return !related(before, op.value) && related(current, op.value)
  return false
}
