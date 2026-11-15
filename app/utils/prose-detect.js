/** Deterministic prose detection. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { flaggedNameKeys } from './shot-risk.js'
import { splitActionText } from './action-split.js'
import { detectLocalized } from './prose-extra.js'
import { isFunctionWord, isNeverPlace, isQuotedOrRemembered, placeMentionIsReal, splitNarrative } from './scene-split.js'

const STOP = new Set(['the', 'a', 'an', 'he', 'she', 'they', 'it', 'his', 'her', 'their', 'then', 'when', 'after', 'before', 'later', 'next', 'once', 'this', 'that', 'there', 'here', 'un', 'une', 'le', 'la', 'les', 'il', 'elle', 'ils', 'elles', 'lui', 'leur', 'puis', 'quand', 'apres', 'avant', 'dans', 'sur', 'sous', 'avec', 'pour', 'par', 'chez', 'au', 'aux', 'du', 'des', 'en', 'et', 'mais', 'ou', 'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'je', 'tu', 'nous', 'vous', 'on', 'plus', 'tout', 'toute', 'tous', 'morning', 'evening', 'night', 'day', 'matin', 'soir', 'nuit', 'jour', 'aube', 'tard', 'lendemain', 'and', 'with', 'from', 'into', 'over', 'while', 'its', 'our', 'your'])

const PLACES = [
  { keys: ['cafe', 'café'], fr: 'Café', en: 'Cafe', frDesc: 'un café', enDesc: 'a cafe' },
  { keys: ['foret', 'forêt', 'forest', 'bois'], fr: 'Forêt', en: 'Forest', frDesc: 'une forêt', enDesc: 'a forest' },
  { keys: ['plage', 'beach'], fr: 'Plage', en: 'Beach', frDesc: 'une plage', enDesc: 'a beach' },
  { keys: ['rue', 'street'], fr: 'Rue', en: 'Street', frDesc: 'une rue', enDesc: 'a street' },
  { keys: ['gare', 'station'], fr: 'Gare', en: 'Station', frDesc: 'une gare', enDesc: 'a station' },
  { keys: ['maison', 'house'], fr: 'Maison', en: 'House', frDesc: 'une maison', enDesc: 'a house' },
  { keys: ['appartement', 'apartment'], fr: 'Appartement', en: 'Apartment', frDesc: 'un appartement', enDesc: 'an apartment' },
  { keys: ['cuisine', 'kitchen'], fr: 'Cuisine', en: 'Kitchen', frDesc: 'une cuisine', enDesc: 'a kitchen' },
  { keys: ['parc', 'park'], fr: 'Parc', en: 'Park', frDesc: 'un parc', enDesc: 'a park' },
  { keys: ['jardin', 'garden'], fr: 'Jardin', en: 'Garden', frDesc: 'un jardin', enDesc: 'a garden' },
  { keys: ['phare', 'lighthouse'], fr: 'Phare', en: 'Lighthouse', frDesc: 'un phare', enDesc: 'a lighthouse' },
  { keys: ['boulangerie', 'bakery'], fr: 'Boulangerie', en: 'Bakery', frDesc: 'une boulangerie', enDesc: 'a bakery' },
  { keys: ['ecole', 'école', 'school'], fr: 'École', en: 'School', frDesc: 'une école', enDesc: 'a school' },
  { keys: ['ville', 'city'], fr: 'Ville', en: 'City', frDesc: 'une ville', enDesc: 'a city' },
  { keys: ['mer', 'ocean', 'sea'], fr: 'Mer', en: 'Sea', frDesc: 'la mer', enDesc: 'the sea' },
  { keys: ['montagne', 'mountain'], fr: 'Montagne', en: 'Mountain', frDesc: 'une montagne', enDesc: 'a mountain' },
  { keys: ['pont', 'bridge'], fr: 'Pont', en: 'Bridge', frDesc: 'un pont', enDesc: 'a bridge' },
  { keys: ['bureau', 'office'], fr: 'Bureau', en: 'Office', frDesc: 'un bureau', enDesc: 'an office' },
  { keys: ['restaurant'], fr: 'Restaurant', en: 'Restaurant', frDesc: 'un restaurant', enDesc: 'a restaurant' },
  { keys: ['bar'], fr: 'Bar', en: 'Bar', frDesc: 'un bar', enDesc: 'a bar' },
  { keys: ['salon', 'living room'], fr: 'Salon', en: 'Living room', frDesc: 'un salon', enDesc: 'a living room' },
  { keys: ['atelier', 'workshop'], fr: 'Atelier', en: 'Workshop', frDesc: 'un atelier', enDesc: 'a workshop' },
  { keys: ['quai', 'quay', 'harbour', 'harbor'], fr: 'Quai', en: 'Quay', frDesc: 'un quai', enDesc: 'a quay' }
]

const TIME_BLOCK = new Set(['matin', 'morning', 'soir', 'evening', 'nuit', 'night', 'jour', 'day', 'aube', 'dawn', 'dusk', 'soleil', 'sun', 'pluie', 'rain', 'tard', 'lendemain', 'petit'])
const JUMP = /\b(plus tard|le lendemain|au lendemain|le matin suivant|the next morning|next morning|the next day|later)\b/i
const VERBS = new Set(['entre', 'sort', 'verse', 'renverse', 'rit', 'rire', 'marche', 'court', 'revient', 'ouvre', 'ferme', 'regarde', 'sourit', 'prend', 'donne', 'boit', 'parle', 'dit', 'va', 'vient', 'arrive', 'part', 'tourne', 'tend', 'attrape', 'pose', 'voit', 'pleure', 'crie', 'attend', 'sert', 'quitte', 'traverse', 'monte', 'descend', 'pousse', 'tombe', 'lance', 'vole', 'porte', 'opens', 'open', 'pours', 'pour', 'laughs', 'laugh', 'walks', 'walk', 'returns', 'return', 'rides', 'ride', 'stops', 'stop', 'enters', 'enter', 'leaves', 'leave', 'sits', 'sit', 'stands', 'stand', 'looks', 'look', 'turns', 'turn', 'smiles', 'smile', 'spills', 'spill', 'runs', 'run', 'flies', 'fly', 'hits', 'hit', 'watches', 'watch', 'finds', 'find', 'follows', 'follow', 'crosses', 'cross', 'drinks', 'drink', 'waits', 'wait', 'closes', 'close', 'unlocks', 'unlock', 'meets', 'meet', 'boards', 'board', 'knocks', 'knock', 'hands', 'hand', 'gives', 'give', 'opens', 'reads', 'read'])
const NOT_A_PLACE = new Set(['window', 'door', 'table', 'glass', 'cup', 'bottle', 'hand', 'hands', 'umbrella', 'pastry', 'apron', 'hair', 'face', 'eye', 'eyes'])
const ROLE_WORDS = /\b(baker|boulanger|boulangère|keeper|gardien|neighbour|neighbor|courier|detective|astronaut|painter|explorer)\b/iu

const FR_MARK = /\b(le|la|les|un|une|des|dans|elle|il|avec|sur|au|aux|et|est|son|sa)\b/gi
const EN_MARK = /\b(the|and|she|he|with|on|in|at|her|his|is|a)\b/gi
const OTHER_MARKS = Object.freeze({
  pt: /\b(ela|ele|eles|elas|uma|não|nao|com|seu|sua|num|numa|pelo|pela|está|esta|encontra|entrega|dele|dela|cais|lê|le)\b/gi,
  de: /\b(und|sie|der|die|das|ein|eine|mit|ist|nicht|ihm|einen|dem|den|am|im|vom|trifft|gibt|liest)\b/gi,
  it: /\b(lei|lui|una|uno|con|nel|nella|sul|sulla|che|non|gli|della|del|di|ha|anni|per|sono|incontra|porge|legge|cappotto|molo|lettera)\b/gi,
  lb: /\b(hien|hie|si|eng|mat|fir|net|vun|ass|och|gëtt|vum|ëm|kënnt|geet|liest|huet|dem)\b/gi
})

function markCount(text, pattern) {
  pattern.lastIndex = 0
  return (String(text).match(pattern) || []).length
}

function cjkLanguage(text) {
  const han = (String(text).match(/\p{Script=Han}/gu) || []).length
  const kana = (String(text).match(/[\u3040-\u30ff]/gu) || []).length
  if (kana >= 2 && han + kana >= 8) return 'ja'
  if (han >= 8 && kana === 0) return 'zh-Hans'
  return ''
}

function languageScores(text) {
  const cjk = cjkLanguage(text)
  if (cjk) return { language: cjk, score: (text.match(/\p{Script=Han}|[\u3040-\u30ff]/gu) || []).length, second: 0 }
  const fr = markCount(text, FR_MARK)
  const en = markCount(text, EN_MARK)
  const scores = { fr, en }
  for (const [code, pattern] of Object.entries(OTHER_MARKS)) scores[code] = markCount(text, pattern)
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [top, topScore] = ranked[0]
  const second = ranked[1]?.[1] || 0
  if ((top === 'pt' || top === 'de' || top === 'it' || top === 'lb') && topScore >= 2 && topScore > Math.max(fr, en)) {
    return { language: top, score: topScore, second: Math.max(fr, en, second) }
  }
  return { language: fr > en ? 'fr' : 'en', score: Math.max(fr, en), second }
}

function languageOf(text) {
  return languageScores(text).language
}

export function detectTextLanguage(text) {
  const found = languageScores(String(text || ''))
  let confidence = 'low'
  if (found.language === 'ja' || found.language === 'zh-Hans') confidence = found.score >= 12 ? 'high' : 'medium'
  else if (found.score >= 4 && found.score > found.second) confidence = 'high'
  else if (found.score >= 2) confidence = 'medium'
  return { language: found.language, confidence }
}

/** Soft hint when the typed text is a different language from the site. Low confidence stays quiet. */
export function textLanguageHint(text, site) {
  const clean = String(text || '').trim()
  if (clean.length < 12) return null
  const found = detectTextLanguage(clean)
  if (found.confidence === 'low') return null
  const target = site || 'en'
  if (found.language === target) return null
  return { detected: found.language, site: target }
}

function tokens(text) {
  return String(text || '').match(/[\p{L}][\p{L}'’-]+/gu) || []
}

function hasVerb(text) {
  return tokens(text).some(token => VERBS.has(foldName(token)))
}

function sentencesOf(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).map(item => item.trim()).filter(Boolean)
}

function sentenceStarts(text) {
  const starts = new Set()
  sentencesOf(text).forEach(sentence => {
    const first = tokens(sentence)[0]
    if (first) starts.add(foldName(first))
  })
  return starts
}

function placeLexicon() {
  const keys = new Set()
  PLACES.forEach(place => place.keys.forEach(key => keys.add(foldName(key))))
  return keys
}

const PLACE_KEYS = placeLexicon()
const NAME_STOP = new Set(['the', 'a', 'an', 'she', 'he', 'they', 'une', 'le', 'la', 'les', 'il', 'elle', 'un'])
const LOOK_TRAIT = /\b(?:(?:early|mid|late)\s+)?\d{1,2}s\b|\b(?:short|long|curly|wavy|straight|black|brown|blonde|blond|red|grey|gray|silver|white|dark)\s+(?:black\s+|brown\s+|red\s+|grey\s+|gray\s+)?(?:pixie cut|bob|bangs|braid|hair)\b|\b(?:grey|gray|white|black|red|dark)\s+stubble\b|\bstubble\b|\bbeard\b|\bmoustache\b|\bmustache\b|\b(?:round\s+)?glasses\b|\b(?:blue|green|brown|amber|hazel)\s+eyes\b/giu
const OUTFIT_TRAIT = /\b(?:[\p{L}'’-]+\s+){0,3}(?:peacoats?|overcoats?|coats?|jackets?|scarves|scarf|aprons?|sweaters?|boots?|dresses|dress|shirts?|suits?|hoodies?|cloaks?|robes?|uniforms?|jeans|skirts?|caps?|hats?|hakama)\b/giu
const TRAIT_STOP = /\b(?:meets|sees|finds|wears|opens|walks|runs|enters|leaves|pours|hands|gives|sits|stands|laughs|reads|turns|crosses|follows|carries|holds|watches|on|in|at|inside|through|across)\b/i

function traitHits(clause) {
  const source = String(clause || '')
  const looks = []
  const outfits = []
  for (const match of source.matchAll(new RegExp(LOOK_TRAIT.source, 'giu'))) looks.push(cleanText(match[0]))
  for (const match of source.matchAll(new RegExp(OUTFIT_TRAIT.source, 'giu'))) {
    outfits.push(cleanText(match[0]).replace(/^(?:a|an|the)\s+/i, ''))
  }
  return { looks, outfits }
}

function absorbTrait(list, value) {
  const clean = cleanText(value)
  const key = foldName(clean)
  if (!key) return
  const index = list.findIndex(item => {
    const other = foldName(item)
    return other === key || other.includes(key) || key.includes(other)
  })
  if (index < 0) list.push(clean)
  else if (clean.length > list[index].length) list[index] = clean
}

function textAfterName(text, name, names) {
  const boundary = label => new RegExp(`(?<![\\p{L}])${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
  const match = boundary(name).exec(text)
  if (!match) return ''
  const after = text.slice(match.index + match[0].length)
  if (!/^\s*,/.test(after)) return ''
  let nextAt = after.length
  names.forEach(other => {
    if (foldName(other) === foldName(name)) return
    const found = boundary(other).exec(after)
    if (found) nextAt = Math.min(nextAt, found.index)
  })
  const slice = after.slice(0, nextAt).replace(/^\s*,\s*/, '')
  const stop = slice.search(TRAIT_STOP)
  return stop >= 0 ? slice.slice(0, stop) : slice
}

function commaTraits(text, name, names) {
  const slice = textAfterName(text, name, names)
  const looks = []
  const outfits = []
  if (!slice) return { looks, outfits }
  slice.split(',').forEach(part => {
    const found = traitHits(part)
    found.looks.forEach(item => absorbTrait(looks, item))
    found.outfits.forEach(item => absorbTrait(outfits, item))
  })
  return { looks, outfits }
}

/** A capitalized name followed by at least two comma-separated look or outfit traits. */
export function isNamedTraitPremise(text) {
  const source = cleanText(text)
  const match = source.match(/^(\p{Lu}[\p{L}'’-]{1,40}),\s+([^.]{0,500})/u)
  if (!match || NAME_STOP.has(foldName(match[1]))) return false
  const stop = match[2].search(TRAIT_STOP)
  const slice = stop >= 0 ? match[2].slice(0, stop) : match[2]
  let parts = 0
  slice.split(',').forEach(part => {
    const found = traitHits(part)
    if (found.looks.length || found.outfits.length) parts += 1
  })
  return parts >= 2
}

export function premiseShotPlan(text) {
  if (!isNamedTraitPremise(text)) return null
  const detected = detectProse(text)
  if (!detected.characters.length || !detected.scenes.length) return null
  const where = detected.places[0]?.name || ''
  return detected.scenes.map(scene => ({
    what: cleanText(scene.what).replace(/[.!?]+$/, ''),
    who: scene.who || '',
    where: scene.where || where
  }))
}

function placeTokens(places) {
  const keys = new Set()
  places.forEach(place => tokens(place.name).forEach(token => keys.add(foldName(token))))
  return keys
}

function traitWindow(text, name, names) {
  const boundary = label => new RegExp(`(?<![\\p{L}])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
  const match = boundary(name).exec(text)
  if (!match) return ''
  const after = match.index + match[0].length
  let nextAt = text.length
  names.forEach(other => {
    if (foldName(other) === foldName(name)) return
    const found = boundary(other).exec(text.slice(after))
    if (found) nextAt = Math.min(nextAt, after + found.index)
  })
  const lead = text.slice(Math.max(0, nextAt - 24), nextAt)
  const leadingAge = lead.match(/\b(?:old|young|little|poor)\s+$/iu)
  const end = leadingAge ? nextAt - leadingAge[0].length : nextAt
  const before = Math.max(0, match.index - 24)
  return text.slice(before, Math.max(after, end))
}

const OUTFIT_WORD = /(?<![\p{L}])(?:coats?|peacoats?|sweaters?|shirts?|dresses?|scarves?|scarf|aprons?|jackets?|boots?|bags?|rings?|manteaux?|manteau|pulls?|pull|tabliers?|tablier|casquettes?|vestes?|cirés?|ciré|cire|bottes|sacs?|sac|bagues?|bague|raincoats?|sleeves?|manches?|manche)(?![\p{L}])/iu
const LOOK_WORD = /(?<![\p{L}])(?:hair|cheveux|beards?|barbe|scars?|cicatrice|glasses|lunettes|eyes|yeux|stubble|pixie|thirties|forties|fifties|trentaine|quarantaine|cinquantaine|\d{1,2}s|\d+\s+ans|years|young|old|jeune)(?![\p{L}])/iu

function traitsInClause(clause) {
  const looks = []
  const outfits = []
  if (!clause) return { looks, outfits }
  const worn = clause.split(/\b(?:porte|portent|wears?|trägt|tragt|veste|indossa|dréit)\b/i)
  if (worn.length >= 2) {
    const look = cleanText(worn[0].replace(/^[^,]*,\s*/, ''))
    const outfit = cleanText(worn.slice(1).join(' '))
    if (look && (LOOK_WORD.test(look) || look.length < 180)) looks.push(look)
    const wornOutfit = cleanText(String(outfit || '').split(/\s+\b(?:in|inside|dans|sur|à|au|aux|on|at)\b\s+/i)[0])
    if (wornOutfit) outfits.push(wornOutfit)
    return { looks, outfits }
  }
  clause.split(',').slice(1).forEach(part => {
    const bit = cleanText(part)
    if (!bit || /\b(?:meets|entre|enters|comes|ouvre|opens|walks|lit|reads)\b/i.test(bit)) return
    if (OUTFIT_WORD.test(bit)) outfits.push(bit)
    else if (LOOK_WORD.test(bit)) looks.push(bit)
  })
  return { looks, outfits }
}

function castTraits(text, name, names) {
  const boundary = label => new RegExp(`(?<![\\p{L}])${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
  const finder = boundary(name)
  let best = { looks: [], outfits: [] }
  for (const match of String(text || '').matchAll(finder)) {
    const endNames = names.filter(other => foldName(other) !== foldName(name))
    let end = Math.min(text.length, match.index + 320)
    endNames.forEach(other => {
      const found = boundary(other).exec(text.slice(match.index + match[0].length))
      if (found) end = Math.min(end, match.index + match[0].length + found.index)
    })
    const slice = text.slice(match.index, end)
    const period = slice.search(/[.!?。！？]/)
    const found = traitsInClause(period >= 0 ? slice.slice(0, period) : slice)
    if (found.looks.length + found.outfits.length > best.looks.length + best.outfits.length) best = found
  }
  return best
}

function detectCharacters(text, places = [], language = 'en') {
  const flagged = flaggedNameKeys(text)
  const reserved = placeTokens(places)
  const starts = sentenceStarts(text)
  const counts = new Map()
  let skippedFlagged = false
  for (const match of String(text || '').matchAll(/[\p{L}][\p{L}'’-]+/gu)) {
    const token = match[0]
    if (!/^\p{Lu}/u.test(token)) continue
    if (/['’]s$/i.test(token)) continue
    if (isQuotedOrRemembered(text, match.index, language)) continue
    const key = foldName(token)
    if (flagged.has(key)) { skippedFlagged = true; continue }
    if (key.length < 2 || STOP.has(key) || isFunctionWord(token, language) || PLACE_KEYS.has(key) || TIME_BLOCK.has(key) || reserved.has(key) || NOT_A_PLACE.has(key) || isNeverPlace(token)) continue
    const entry = counts.get(key) || { forms: new Map(), count: 0, mid: 0 }
    entry.count += 1
    if (!starts.has(key)) entry.mid += 1
    entry.forms.set(token, (entry.forms.get(token) || 0) + 1)
    counts.set(key, entry)
  }
  const warnings = []
  const characters = []
  const candidateNames = [...counts.values()].map(entry => [...entry.forms.keys()][0])
  for (const [key, entry] of counts) {
    const forms = [...entry.forms.entries()].sort((a, b) => b[1] - a[1] || Number(/[^\u0000-\u007f]/.test(b[0])) - Number(/[^\u0000-\u007f]/.test(a[0])))
    const name = forms[0][0]
    const mentioned = traitWindow(text, name, candidateNames)
    const young = /\byoung\b/iu.test(mentioned) && !new RegExp(`\\byoung\\s+(?!${name}\\b)\\p{Lu}`, 'u').test(mentioned)
    const old = new RegExp(`\\bold\\s+${name}\\b`, 'iu').test(mentioned)
    const look = unique([
      matchOne(mentioned, /cheveux\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /(?:curly|wavy|straight|long|short|red|brown|black|blonde|blond|roux|rousse)\s+(?:red\s+|brown\s+|black\s+)?hair/iu),
      matchOne(mentioned, /yeux\s+[\p{L}'’-]+/iu),
      matchOne(mentioned, /(?:blue|green|brown|red|amber)\s+eyes/iu),
      matchOne(mentioned, /lunettes(?:\s+rondes)?/iu),
      matchOne(mentioned, /(?:round\s+)?glasses/iu),
      matchOne(mentioned, /jeune/iu),
      young ? 'young' : '',
      old ? 'old' : '',
      matchOne(mentioned, ROLE_WORDS)
    ])
    const outfit = unique([
      matchOne(mentioned, /flour[- ]dusted\s+apron|flour on (?:her |his )?apron/iu),
      matchOne(mentioned, /tablier(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /(?:green|red|blue|grey|gray|black|white|vert|verte|rouge|gris|grise)\s+(?:apron|tablier)/iu),
      /flour[- ]dusted\s+apron|flour on (?:her |his )?apron/iu.test(mentioned) ? '' : matchOne(mentioned, /apron/iu),
      matchOne(mentioned, /casquette(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /(?:grey|gray|red|black|grise|gris)\s+(?:cap|casquette)/iu),
      matchOne(mentioned, /manteau(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /jacket/iu)
    ])
    const extra = commaTraits(text, name, candidateNames)
    extra.looks.forEach(item => absorbTrait(look, item))
    extra.outfits.forEach(item => absorbTrait(outfit, item))
    const cast = castTraits(text, name, candidateNames)
    if (!look.length) cast.looks.forEach(item => absorbTrait(look, item))
    if (!outfit.length) cast.outfits.forEach(item => absorbTrait(outfit, item))
    const keep = entry.count >= 2 || entry.mid >= 1 || look.length > 0 || outfit.length > 0
    if (!keep) continue
    if (forms.length > 1) {
      warnings.push({ code: 'name_variant', message: `${forms.map(item => item[0]).join(' or ')}?`, target: 'characters', options: forms.map(item => item[0]), name })
    }
    let confidence = 'high'
    if (!look.length || !outfit.length) confidence = 'low'
    else if (entry.count < 2) confidence = 'medium'
    if (!look.length) warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
    if (!outfit.length) warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    characters.push({ name, look: look.join(', '), outfit: outfit.join(', '), confidence })
  }
  if (!characters.length && !skippedFlagged) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  return { characters, warnings, skippedFlagged }
}

function matchOne(text, pattern) {
  const found = String(text || '').match(pattern)
  return found ? cleanText(found[0]) : ''
}

function unique(values) {
  const seen = new Set()
  return values.filter(value => {
    const key = foldName(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function pushPlace(places, name, description, confidence, trusted = false) {
  const clean = cleanText(name)
  if (!clean || NOT_A_PLACE.has(foldName(clean)) || isNeverPlace(clean)) return
  if (places.some(place => foldName(place.name) === foldName(clean))) return
  places.push({ name: clean, description, confidence, trusted })
}

function detectPlaces(text, language) {
  const flagged = flaggedNameKeys(text)
  const places = []
  const warnings = []
  let skippedFlagged = false
  const namedFlag = value => tokens(value).some(token => flagged.has(foldName(token)))
  const source = String(text || '')
  for (const match of source.matchAll(/\b(village|town|city|hamlet|bourg)\s+of\s+(\p{Lu}[\p{L}'’-]*)/gu)) {
    if (namedFlag(match[2])) { skippedFlagged = true; continue }
    pushPlace(places, match[2], language === 'fr' ? `un ${match[1]}` : `a ${match[1].toLowerCase()}`, 'high', true)
  }
  for (const match of source.matchAll(/\b((?:\p{Lu}[\p{L}'’-]*)(?:\s+\p{Lu}[\p{L}'’-]*){0,2})\s+(Street|Road|Avenue|Lane|Boulevard|Way|Rue)\b/gu)) {
    if (namedFlag(match[1])) { skippedFlagged = true; continue }
    pushPlace(places, `${match[1]} ${match[2]}`, language === 'fr' ? 'une rue' : 'a street', 'high', true)
  }
  for (const match of source.matchAll(/\b((?:village|town|market|city)\s+square)\b/giu)) {
    const name = match[1].replace(/^\p{Ll}/u, char => char.toUpperCase())
    pushPlace(places, name, language === 'fr' ? 'une place' : 'a square', 'high', true)
  }
  for (const match of source.matchAll(/\b(?:in|at|through)\s+(\p{Lu}[\p{L}'’-]*)/gu)) {
    const name = match[1]
    if (flagged.has(foldName(name))) { skippedFlagged = true; continue }
    if (isQuotedOrRemembered(source, match.index, language)) continue
    const after = source.slice(match.index + match[0].length)
    if (/['’]s\b/i.test(name) || /^['’]s\b/i.test(after)) continue
    if (STOP.has(foldName(name)) || isFunctionWord(name, language) || TIME_BLOCK.has(foldName(name)) || PLACE_KEYS.has(foldName(name)) || isNeverPlace(name)) continue
    pushPlace(places, name, language === 'fr' ? 'un lieu cité dans le texte' : 'a place named in the text', 'medium', true)
  }
  for (const match of source.matchAll(/\b(?:on|in|at|along)\s+(?:a|an|the)\s+((?:[\p{L}'’-]+\s+){0,3}(?:quay|quayside|pier|dock|wharf|alley|rooftop|courtyard))\b/giu)) {
    const phrase = cleanText(match[1])
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    const head = foldName(phrase.split(/\s+/).at(-1))
    if (places.some(place => foldName(place.name) === foldName(name) || foldName(place.name) === head)) continue
    pushPlace(places, name, `a ${phrase}`, 'high', true)
  }
  const folded = foldName(source)
  const covered = new Set(places.flatMap(place => tokens(place.name).map(foldName)))
  PLACES.forEach(place => {
    const hit = place.keys.find(key => new RegExp(`(?:^|[^\\p{L}])${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded))
    if (!hit) return
    if (covered.has(foldName(hit)) && places.some(item => foldName(item.name).includes(foldName(hit)) && foldName(item.name) !== foldName(hit))) return
    const preceded = place.keys.some(key => new RegExp(`(?:au|aux|dans|sur|chez|du|de|at|in|on|to|through)\\s+(?:la\\s+|le\\s+|l'|the\\s+)?(?:[\\p{L}'’-]+\\s+){0,2}${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded))
    pushPlace(places, language === 'fr' ? place.fr : place.en, language === 'fr' ? place.frDesc : place.enDesc, preceded ? 'high' : 'medium')
  })
  const unknown = [...source.matchAll(/\b(?:at the|in the|through the|to the|au|dans la|dans le|sur la|sur le)\s+([\p{Ll}'’-]+(?:\s+[\p{Ll}'’-]+){0,2})/gu)]
  unknown.forEach(match => {
    const phrase = cleanText(match[1])
    if (namedFlag(phrase)) { skippedFlagged = true; return }
    const key = foldName(phrase.split(/\s+/).at(-1))
    if (!key || STOP.has(key) || TIME_BLOCK.has(key) || !PLACE_KEYS.has(key) || NOT_A_PLACE.has(key) || isNeverPlace(phrase) || isNeverPlace(key) || /\b(?:village|town|city|of)\b/i.test(phrase) || places.some(place => foldName(place.name) === key || foldName(place.name).endsWith(key))) return
    if (!placeMentionIsReal(source, key, language)) return
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    pushPlace(places, name, language === 'fr' ? 'un lieu cité dans le texte' : 'a place named in the text', 'low')
    warnings.push({ code: 'uncertain_place', message: `Confirm this place: ${name}.`, target: 'places', options: [name], name })
  })
  const visible = places.filter(place => {
    if (place.trusted) return true
    const known = PLACES.find(item => item.fr === place.name || item.en === place.name)
    const keys = known ? known.keys : [place.name]
    return keys.some(key => placeMentionIsReal(source, key, language))
  })
  return { places: visible, warnings, skippedFlagged }
}

function detectAmbience(text) {
  const source = foldName(text)
  let light = ''
  if (/\b(aube|dawn|sunrise|petit matin)\b/.test(source)) light = 'dawn'
  else if (/\b(crepuscule|dusk|sunset|soir)\b/.test(source)) light = 'dusk'
  else if (/\b(nuit|night|minuit|midnight)\b/.test(source)) light = 'night'
  else if (/\b(midi|noon|jour|day|afternoon)\b/.test(source)) light = 'day'
  let mood = ''
  if (/\b(rit|rire|laugh|laughs|sourire|smile|smiles)\b/.test(source)) mood = 'playful'
  else if (/\b(peur|fear|inquiet|anxious|cri|scream)\b/.test(source)) mood = 'uneasy'
  else if (/\b(tendre|murmure|whisper|embrasse)\b/.test(source)) mood = 'intimate'
  else if (/\b(calme|silence|silent|triste|sad)\b/.test(source)) mood = 'quiet'
  else if (/\b(espoir|hope)\b/.test(source)) mood = 'hopeful'
  return { light, mood, confidence: light || mood ? 'medium' : 'low' }
}

function splitBlocks(text) {
  const paragraphs = String(text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(item => item.trim()).filter(Boolean)
  const blocks = []
  paragraphs.forEach(paragraph => {
    const parts = paragraph.split(JUMP)
    if (parts.length === 1) { blocks.push(paragraph); return }
    parts.forEach(part => { if (part && part.trim()) blocks.push(part.trim()) })
  })
  return blocks
}

function namesIn(text, characters) {
  return characters.filter(character => tokens(text).some(token => foldName(token) === foldName(character.name)))
}

function placeIn(text, places) {
  const folded = foldName(text)
  const hit = label => new RegExp(`(?:^|[^\\p{L}])${foldName(label)}(?=[^\\p{L}]|$)`, 'u').test(folded)
  return places.find(place => hit(place.name) || PLACES.find(item => (item.fr === place.name || item.en === place.name) && item.keys.some(key => hit(key))))
}

/** True when every proper name in the sentence is a public figure, brand, or trademark. */
function riskNamesOnly(sentence, flagged) {
  if (!flagged || flagged.size === 0) return false
  let sawFlagged = false
  for (const token of tokens(sentence)) {
    const key = foldName(token)
    if (!key) continue
    if (flagged.has(key)) { sawFlagged = true; continue }
    if (!/^\p{Lu}/u.test(token)) continue
    if (key.length < 2 || STOP.has(key) || isFunctionWord(token, 'en') || TIME_BLOCK.has(key) || PLACE_KEYS.has(key) || NOT_A_PLACE.has(key) || isNeverPlace(token)) continue
    return false
  }
  return sawFlagged
}

function genderMap(text, characters) {
  const map = new Map()
  const intro = String(text || '').match(/(\p{Lu}[\p{L}'’-]{1,40}),(?:[^.]{0,400}?)\bmeets\s+(\p{Lu}[\p{L}'’-]{1,40})\b/u)
  if (intro && /\bshe\b/i.test(text) && /\bhim\b/i.test(text)) {
    map.set(foldName(intro[1]), 'she')
    map.set(foldName(intro[2]), 'he')
    return map
  }
  if (intro && /\bhe\b/i.test(text) && /\bher\b/i.test(text)) {
    map.set(foldName(intro[1]), 'he')
    map.set(foldName(intro[2]), 'she')
    return map
  }
  if (characters.length === 1) {
    const key = foldName(characters[0].name)
    if (/\bshe\b|\bher\b/i.test(text)) map.set(key, 'she')
    else if (/\bhe\b|\bhim\b|\bhis\b/i.test(text)) map.set(key, 'he')
  }
  return map
}

function whoFromPronoun(sentence, characters, genders, language) {
  const subject = String(sentence || '').match(/^\s*(she|he)\b/i)
  if (!subject) return ''
  const want = subject[1].toLowerCase()
  const people = characters.filter(character => genders.get(foldName(character.name)) === want)
  if (people.length !== 1) return ''
  const object = sentence.match(/\b(him|her)\b/i)
  if (!object) return people[0].name
  const other = object[1].toLowerCase() === 'him' ? 'he' : 'she'
  const objects = characters.filter(character => genders.get(foldName(character.name)) === other && foldName(character.name) !== foldName(people[0].name))
  if (objects.length !== 1) return people[0].name
  return `${people[0].name}${language === 'fr' ? ' et ' : ' and '}${objects[0].name}`
}

function isMeetIntro(sentence) {
  if (!/\bmeets\b/i.test(sentence)) return false
  if ((sentence.match(/,/g) || []).length < 2) return false
  const stripped = sentence.replace(/\bmeets\b/gi, '')
  if (hasVerb(stripped)) return false
  const names = (sentence.match(/\p{Lu}[\p{L}'’-]+/gu) || []).filter(token => !STOP.has(foldName(token)) && !NAME_STOP.has(foldName(token)))
  return names.length >= 2
}

function placeRecords(places) {
  return places.map(place => {
    const known = PLACES.find(item => item.fr === place.name || item.en === place.name)
    const keys = new Set([place.name])
    if (known) known.keys.forEach(key => keys.add(key))
    tokens(place.name).forEach(token => keys.add(token))
    return { name: place.name, keys: [...keys] }
  })
}

function detectScenes(text, characters, places, language, flagged, options = {}) {
  const warnings = []
  const genders = genderMap(text, characters)
  const narrative = splitNarrative(text, {
    language,
    places: placeRecords(places),
    characters,
    verbs: [...VERBS],
    splitScenes: options.splitScenes !== false,
    skip: sentence => isMeetIntro(sentence)
  })
  const scenes = narrative.shots.map((shot, index) => {
    const foundNames = namesIn(shot.what, characters)
    const pronounWho = whoFromPronoun(shot.what, characters, genders, language)
    const who = foundNames.length ? shot.who : (pronounWho || shot.who)
    const flaggedOnly = riskNamesOnly(shot.what, flagged)
    let confidence = 'high'
    if (!foundNames.length) confidence = 'medium'
    if (!shot.where && !flaggedOnly) {
      confidence = 'low'
      warnings.push({ code: 'missing_place', message: `No place found for scene ${index + 1}.`, target: 'scenes', index, options: places.map(place => place.name) })
    }
    if (!who && !flaggedOnly) {
      confidence = 'low'
      warnings.push({ code: 'missing_character', message: `No character found for scene ${index + 1}.`, target: 'scenes', index, options: characters.map(character => character.name) })
    }
    return {
      number: index + 1,
      who: who || '',
      where: shot.where || '',
      what: shot.what,
      duration: 3,
      confidence,
      light: shot.light || '',
      timeLabel: shot.timeLabel || '',
      sceneId: shot.sceneId,
      sceneCut: shot.sceneCut === true,
      cutCue: shot.cutCue || '',
      cutReason: shot.cutReason || '',
      cutUncertain: shot.cutUncertain === true,
      cutKind: shot.cutKind || ''
    }
  })
  return { scenes, warnings, cuts: narrative.cuts, light: narrative.light, firstLight: narrative.firstLight || narrative.light }
}

function overall(parts) {
  const values = parts.filter(Boolean)
  if (values.includes('low')) return 'low'
  if (values.includes('medium')) return 'medium'
  return values.length ? 'high' : 'low'
}

export function detectProse(input, options = {}) {
  const text = String(input || '').replace(/\r\n/g, '\n').trim()
  const language = languageOf(text)
  if (language !== 'en' && language !== 'fr') return detectLocalized(text, language, options)
  const flagged = flaggedNameKeys(text)
  const foundPlaces = detectPlaces(text, language)
  const foundCharacters = detectCharacters(text, foundPlaces.places, language)
  const ambience = detectAmbience(text)
  const foundScenes = detectScenes(text, foundCharacters.characters, foundPlaces.places, language, flagged, options)
  const warnings = [...foundCharacters.warnings, ...foundPlaces.warnings, ...foundScenes.warnings]
  if (foundCharacters.skippedFlagged || foundPlaces.skippedFlagged) {
    warnings.push({ code: 'risk_note', tone: 'note', message: 'Public figures, brands, and trademarks in this text are covered by the risk warnings.' })
  }
  const scenario = {
    characters: foundCharacters.characters.map(({ name, look, outfit }) => ({ name, look, outfit })),
    places: foundPlaces.places.map(({ name, description }) => ({ name, description })),
    light: foundScenes.firstLight || ambience.light,
    mood: ambience.mood,
    scenes: foundScenes.scenes.map(({ number, who, where, what, duration, light }) => ({ number, who, where, what, duration, ...(light ? { light } : {}) }))
  }
  const canonical = scenarioToFields(scenario)
  const budget = scenarioBudget([canonical.characters, canonical.places, canonical.scenes].join('\n'), foundScenes.scenes.length * 3)
  return {
    input: 'prose',
    language,
    confidence: overall([
      ...foundCharacters.characters.map(item => item.confidence),
      ...foundPlaces.places.map(item => item.confidence),
      ...foundScenes.scenes.map(item => item.confidence),
      ambience.confidence
    ]),
    warnings,
    characters: foundCharacters.characters,
    places: foundPlaces.places,
    light: foundScenes.firstLight || ambience.light,
    mood: ambience.mood,
    scenes: foundScenes.scenes,
    cuts: options.splitScenes === false ? [] : (foundScenes.cuts || []),
    scenario,
    premise: scenarioPremise(scenario),
    budget
  }
}

export function applyDetection(fields = {}, detected, locks = {}) {
  const next = scenarioToFields(detected?.scenario || detected || {})
  return {
    characters: locks.characters ? fields.characters : next.characters,
    places: locks.places ? fields.places : next.places,
    scenes: locks.scenes ? fields.scenes : next.scenes,
    light: locks.light ? fields.light : (detected?.light || next.light || ''),
    mood: locks.mood ? fields.mood : (detected?.mood || next.mood || '')
  }
}

export function applyWarningChoice(fields, warning, choice) {
  const next = { ...fields }
  if (!warning || !choice) return next
  if (warning.code === 'name_variant') {
    const forms = warning.options || []
    const replace = value => forms.reduce((line, form) => String(line || '').split(form).join(choice), value)
    next.characters = replace(next.characters)
    next.scenes = replace(next.scenes)
    return next
  }
  if ((warning.code === 'missing_place' || warning.code === 'missing_character') && warning.index != null) {
    const lines = String(next.scenes || '').split('\n')
    const line = lines[warning.index]
    if (!line) return next
    const parts = line.split('—').map(part => part.trim())
    if (parts.length >= 4) {
      if (warning.code === 'missing_place') parts[2] = choice
      if (warning.code === 'missing_character') parts[1] = choice
      lines[warning.index] = parts.join(' — ')
      next.scenes = lines.join('\n')
    }
    return next
  }
  if (warning.code === 'uncertain_place') return next
  return next
}
