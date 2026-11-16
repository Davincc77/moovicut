/** Deterministic prose detection. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { flaggedNameKeys } from './shot-risk.js'
import { splitActionText } from './action-split.js'
import { detectLocalized } from './prose-extra.js'
import { inNamedVenue, inSpans, isCueStopword, isFunctionWord, isNeverPlace, isNumberWord, isQuotedOrRemembered, isVenueType, mentionMovesScene, namedVenues, placeMentionIsReal, quoteSpans, splitNarrative } from './scene-split.js'
import { libraryHits, locativeHeads, placeLexiconHas, placeTag } from './place-lexicon.js'

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

const TIME_BLOCK = new Set(['matin', 'morning', 'soir', 'evening', 'nuit', 'night', 'jour', 'day', 'aube', 'dawn', 'dusk', 'soleil', 'sun', 'pluie', 'rain', 'tard', 'lendemain', 'petit', 'late', 'inside', 'outside', 'suddenly', 'finally', 'soon', 'meanwhile', 'tonight', 'yesterday', 'tomorrow', 'across', 'behind', 'above', 'below', 'under', 'near', 'around', 'during', 'upon', 'within', 'along', 'toward', 'towards', 'soudain', 'ensuite', 'dedans', 'dehors', 'hier', 'demain', 'alors', 'enfin', 'pendant', 'derriere', 'dessus', 'dessous', 'dentro', 'fora', 'ontem', 'amanha', 'entao', 'depois', 'plotzlich', 'drinnen', 'draussen', 'gestern', 'heute', 'spater', 'wahrend', 'improvvisamente', 'infine', 'stasera', 'bannen', 'baussen', 'geschter', 'muer', 'noon', 'afternoon', 'midnight', 'sundown', 'sunrise', 'sunset', 'nightfall', 'pomeriggio', 'mattina', 'mattino', 'serata', 'tramonto', 'mezzogiorno', 'coucher', 'midi', 'morgens', 'mittags', 'nachmittags', 'vormittags', 'abends', 'nachts', 'meio', 'fim', 'manha', 'tarde'])
const CALENDAR_WORD = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'janvier', 'fevrier', 'mars', 'avril', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre', 'januar', 'februar', 'marz', 'juni', 'juli', 'oktober', 'dezember', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre', 'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'])
const NOT_A_PERSON = new Set(['together', 'early', 'late', 'suddenly', 'finally', 'meanwhile', 'soon', 'inside', 'outside', 'later', 'yesterday', 'tomorrow', 'tonight', 'across', 'behind', 'above', 'below', 'under', 'near', 'today', 'once', 'still', 'already', 'sawdust', 'steam', 'water', 'smoke', 'dust', 'fire', 'rain', 'snow', 'wind', 'mud', 'ash', 'oil', 'flour', 'sand', 'fog', 'mist', 'frost', 'flame', 'flames', 'flamingo', 'flamingos', 'seagull', 'seagulls', 'pigeon', 'pigeons', 'sparrow', 'sparrows', 'horse', 'horses', 'dog', 'dogs', 'cat', 'cats', 'bird', 'birds', 'fish', 'gull', 'gulls', 'fox', 'foxes', 'wolf', 'wolves', 'sheep', 'goat', 'goats', 'cow', 'cows', 't-shirt', 'shirt', 'apron', 'jacket', 'dress', 'hat', 'cap', 'boots', 'scarf', 'sweater', 'saint', 'sainte', 'ao', 'morgens', 'mittags', 'nachmittags', 'vormittags', 'abends', 'nachts', 'pomeriggio', 'tramonto', 'mezzogiorno', 'coucher', 'nephew', 'niece', 'neffe', 'nichte', 'enkel', 'enkelin', 'bruder', 'schwester', 'sohn', 'tochter', 'onkel', 'tante', 'vetter', 'cousin', 'schwager', 'brother', 'sister', 'uncle', 'aunt', 'grandson', 'granddaughter', 'nipote', 'neto', 'sobrinho', 'sobrinha', 'neveu'])
const JUMP = /\b(plus tard|le lendemain|au lendemain|le matin suivant|the next morning|next morning|the next day|later)\b/i
const VERBS = new Set(['entre', 'sort', 'verse', 'renverse', 'rit', 'rire', 'marche', 'court', 'revient', 'ouvre', 'ferme', 'regarde', 'sourit', 'prend', 'donne', 'boit', 'parle', 'dit', 'va', 'vient', 'arrive', 'part', 'tourne', 'tend', 'attrape', 'pose', 'voit', 'pleure', 'crie', 'attend', 'sert', 'quitte', 'traverse', 'monte', 'descend', 'pousse', 'tombe', 'lance', 'vole', 'porte', 'opens', 'open', 'pours', 'pour', 'laughs', 'laugh', 'walks', 'walk', 'returns', 'return', 'rides', 'ride', 'stops', 'stop', 'enters', 'enter', 'leaves', 'leave', 'sits', 'sit', 'stands', 'stand', 'looks', 'look', 'turns', 'turn', 'smiles', 'smile', 'spills', 'spill', 'runs', 'run', 'flies', 'fly', 'hits', 'hit', 'watches', 'watch', 'finds', 'find', 'follows', 'follow', 'crosses', 'cross', 'drinks', 'drink', 'waits', 'wait', 'closes', 'close', 'unlocks', 'unlock', 'meets', 'meet', 'boards', 'board', 'knocks', 'knock', 'hands', 'hand', 'gives', 'give', 'opens', 'reads', 'read'])
const NOT_A_PLACE = new Set(['window', 'door', 'table', 'glass', 'cup', 'bottle', 'hand', 'hands', 'umbrella', 'pastry', 'apron', 'hair', 'face', 'eye', 'eyes'])
const ROLE_WORDS = /\b(baker|boulanger|boulangère|keeper|gardien|neighbour|neighbor|courier|detective|astronaut|painter|explorer)\b/iu

const EN_MARK = /\b(the|and|she|he|with|on|in|at|her|his|is)\b/gi
const PT_MARK = /\b(ela|ele|eles|elas|uma|não|nao|com|seu|sua|num|numa|pelo|pela|está|esta|encontra|entrega|dele|dela|cais|lê|le|tem|anos|entra|na|ao|à|do|da|dos|das)\b/gi

function markCount(text, pattern) {
  pattern.lastIndex = 0
  return (String(text).match(pattern) || []).length
}

function languageScores(text) {
  const pt = markCount(text, PT_MARK)
  const en = markCount(text, EN_MARK)
  if (pt >= 2 && pt > en) return { language: 'pt', score: pt, second: en }
  return { language: 'en', score: en, second: pt }
}

function languageOf(text) {
  return languageScores(text).language
}

export function detectTextLanguage(text) {
  const found = languageScores(String(text || ''))
  let confidence = 'low'
  if (found.score >= 4 && found.score > found.second) confidence = 'high'
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
const TRAIT_STOP = /\b(?:meets|sees|finds|wears|opens|walks|runs|enters|leaves|pours|hands|gives|sits|stands|laughs|reads|turns|crosses|follows|carries|holds|watches)\b/i

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
  const boundary = label => new RegExp(`(?<![\\p{L}])${escapeName(label)}(?![\\p{L}])`, 'giu')
  let best = ''
  for (const match of String(text || '').matchAll(boundary(name))) {
    const after = text.slice(match.index + match[0].length)
    if (!/^\s*,/.test(after)) continue
    let nextAt = after.length
    names.forEach(other => {
      if (foldName(other) === foldName(name)) return
      const found = new RegExp(`(?<![\\p{L}])${escapeName(other)}(?![\\p{L}])`, 'iu').exec(after)
      if (found) nextAt = Math.min(nextAt, found.index)
    })
    const slice = cutTraits(after.slice(0, nextAt).replace(/^\s*,\s*/, ''))
    if (slice.length > best.length) best = slice
  }
  return best
}

function cutTraits(slice) {
  const sentence = String(slice || '').split(/[.!?。！？]/)[0]
  const clause = sentence.split(/\b(?:\band\b\s+(?:his|her|their|the|a|an)\b|\bwho\b|\bwhich\b|\bwhen\b|\bwhile\b|\bbut\b|\bthen\b)\b/i)[0]
  const verb = clause.search(/\b(?:spend|spends|spent|watch|watches|walk|walks|meet|meets|open|opens|pour|pours|wait|waits|sit|sits|stand|stands|read|reads|turn|turns|lift|lifts|check|checks|give|gives|hand|hands|say|says|go|goes|come|comes|see|sees|find|finds|leave|leaves|enter|enters|run|runs|wears?|wore|porte|portent)\b/i)
  return cleanText(verb >= 0 ? clause.slice(0, verb) : clause)
}

const AGE_PHRASE = /\b(?:in\s+(?:his|her|their)\s+)?(?:early|mid|late)\s+(?:twenties|thirties|forties|fifties|sixties|seventies|\d{1,2}s)\b|\b(?:early|mid|late)\s+\d{1,2}s\b|\b\d{1,2}s\b|\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s*-\s*[a-z]+|\s+years\s+old)?\b|\b(?:la\s+)?(?:vingtaine|trentaine|quarantaine|cinquantaine|soixantaine)\b|\bdébut\s+de\s+la\s+\p{L}+\b|\b\d{1,3}\s+ans\b|\bnos\s+seus\s+(?:vinte|trinta|quarenta|cinquenta|sessenta)\b|\b(?:cerca\s+de\s+)?\d{1,3}\s+anos\b|\bsulla\s+cinquantina\b|\b(?:poco\s+più\s+di\s+)?\d{1,3}\s+anni\b|五十代(?:前半|後半)?|四十代(?:前半|後半)?|三十代(?:前半|後半)?|二十代(?:前半|後半)?|五十出头|四十出头|三十出头|五十多岁|四十多岁|三十多岁/iu
const ROLE_PHRASE = /\b(?:fisherman|fisherwoman|fishers?|baker|keeper|farmer|sailor|teacher|doctor|nurse|chef|waiter|waitress|driver|painter|carpenter|shepherd|hunter|merchant|soldier|guard|monk|priest|student|artist|cook|captain|lighthouse\s+keeper|p[eê]cheur|p[eê]cheuse|boulanger|boulangère|gardien|fermier|fermière|marin|professeur|m[eé]decin|infirmier|infirmi[eè]re|cuisinier|cuisini[eè]re|serveur|serveuse|peintre|charpentier|berger|chasseur|marchand|soldat|moine|pr[eê]tre|[eé]tudiant|[eé]tudiante|pescador|pescadora|padeiro|padeira|guarda|agricultor|marinheiro|professor|professora|m[eé]dico|enfermeiro|cozinheiro|cozinheira|pescatore|pescatrice|fornaio|fornaia|guardiano|contadino|contadina|marinaio|professore|professoressa|medico|infermiere|cuoco|cuoca)\b|漁師|渔夫|渔民|面包师|看守|农夫/iu
const IDENTITY_NOUN = /\b(?:face|faces|visage|rosto|viso|beard|barbe|barba|scar|cicatrice|wrinkles?|weathered|burin[eé]|marcado|segnato|build|stature|skin|peau|pele|pelle)\b/iu

function isIdentityBit(text) {
  return AGE_PHRASE.test(text) || ROLE_PHRASE.test(text)
}

function isTraitBit(bit) {
  const clean = cleanText(bit).replace(/^(?:and|with|a|an|the|un|une)\s+/i, '')
  if (!clean || clean.length > 80 || TRAIT_STOP.test(clean)) return false
  if (isIdentityBit(clean)) return true
  const head = foldName(clean.split(/\s+/)[0])
  if (!head || CALENDAR_WORD.has(head) || NOT_A_PERSON.has(head) || CALENDAR_WORD.has(foldName(clean))) return false
  if (/^(?:his|her|their|neighbour|neighbor)\b/i.test(clean)) return false
  if (GARMENT_WORD.test(clean) || CARRIED_ITEM.test(clean) || LOOK_WORD.test(clean)) return true
  if (/^\d{1,3}$/.test(clean) || /^(?:early|mid|late)\s+\d{1,2}s$/i.test(clean) || /^\d{1,2}s$/i.test(clean)) return true
  if (/^(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-[a-z]+)?$/i.test(clean)) return true
  if (/^(?:[\p{L}'’-]+\s+){0,5}(?:beard|locs|braid|braids|bun|curls|fade|afro|crop|hair|eyes|glasses|stubble|scar|freckles|moustache|mustache)$/iu.test(clean)) return true
  if (/^(?:a\s+)?pair\s+of\s+[\p{L}'’-]+$/iu.test(clean)) return true
  if (IDENTITY_NOUN.test(clean) && clean.split(/\s+/).length <= 6) return true
  return false
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
    const bit = cleanText(part)
    if (found.looks.length || found.outfits.length || (bit && !TRAIT_STOP.test(bit))) parts += 1
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
  const lead = text.slice(Math.max(0, match.index - 16), match.index)
  const leadingAge = lead.match(/\b(?:old|young|little|poor)\s+$/iu)
  const start = leadingAge ? match.index - leadingAge[0].length : match.index
  const bounded = cutTraits(text.slice(start, nextAt))
  return bounded || text.slice(start, Math.min(text.length, after + 48)).split(/[.!?。！？]/)[0]
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
    if (look && isTraitBit(look)) looks.push(look)
    const wornOutfit = cleanText(String(outfit || '').split(/\s+\b(?:in|inside|dans|sur|à|au|aux|on|at)\b\s+/i)[0])
    if (wornOutfit) outfits.push(wornOutfit)
    return { looks, outfits }
  }
  clause.split(',').slice(1).forEach(part => {
    const bit = cleanText(part)
    if (!isTraitBit(bit)) return
    if (OUTFIT_WORD.test(bit) || GARMENT_WORD.test(bit)) outfits.push(bit)
    else looks.push(bit)
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

const STREET_WORD = new Set(['rue', 'street', 'road', 'avenue', 'lane', 'boulevard', 'way', 'via', 'strasse', 'straße', 'strada', 'rua', 'calle', 'gasse'])
const GARMENT_WORD = /\b(?:raincoats?|coats?|jackets?|aprons?|caps?|hats?|scarves?|scarf|dresses?|shirts?|boots?|peacoats?|sweaters?|cloaks?|robes?|hoodies?|hakama|vests?|uniforms?|shawls?)\b/i
const CARRIED_ITEM = /\b(?:cord|chain|strap|string|ribbon|neck|wrist|belt|shoulder|locket|compass|watch|pendant|tongs|hammer|brush|lantern|whistle|key|keys|camera|letter|map|cup|mug|basket|notebook|pen|knife|sword|staff|cane|umbrella|book|bag|purse|wallet|flower|rose|tray|plate|bottle|torch|flashlight|flute|bell|compass)\b/i

function isNameNoise(token, language) {
  const key = foldName(token)
  return !key || key.length < 2 || STOP.has(key) || TIME_BLOCK.has(key) || CALENDAR_WORD.has(key) || NOT_A_PERSON.has(key) || STREET_WORD.has(key) || PLACE_KEYS.has(key) || NOT_A_PLACE.has(key) || isFunctionWord(token, language) || isNumberWord(token, language) || isNeverPlace(token) || isVenueType(token, language) || (/-/.test(String(token)) && GARMENT_WORD.test(token))
}

function properNames(text, language) {
  const source = String(text || '')
  const matches = [...source.matchAll(/\p{Lu}[\p{L}'’-]*/gu)]
  const names = []
  let index = 0
  while (index < matches.length) {
    const first = matches[index]
    const parts = [first[0]]
    let end = first.index + first[0].length
    let next = index + 1
    while (next < matches.length && parts.length < 3) {
      const gap = source.slice(end, matches[next].index)
      if (!/^\s+$/.test(gap)) break
      parts.push(matches[next][0])
      end = matches[next].index + matches[next][0].length
      next += 1
    }
    const placeWord = Boolean(placeTag(language, parts[0])) || PLACE_KEYS.has(foldName(parts[0]))
    const introduced = placeWord && introducedPerson(source, parts[0])
    if ((introduced || !isNameNoise(parts[0], language)) && !STREET_WORD.has(foldName(parts[0])) && !/^(?:l|d|j|n|qu)['’]/i.test(parts[0])) {
      const usable = []
      for (const part of parts) {
        if (/^(?:l|d|j|n|qu)['’]/i.test(part)) break
        if (!introduced && isNameNoise(part, language)) {
          if (!usable.length) continue
          break
        }
        usable.push(part.replace(/['’]s$/i, ''))
      }
      if (usable.length) names.push({ name: usable.join(' '), index: first.index })
    }
    index = next
  }
  return names
}

function sentenceStartAt(text, index) {
  const before = String(text || '').slice(0, index)
  return !before.trim() || /[.!?。！？]\s*$/.test(before)
}

function uncoveredClauses(text, name, names, look, outfit) {
  const slice = textAfterName(text, name, names)
  if (!slice) return
  slice.split(',').forEach(part => {
    const raw = cleanText(part)
    const bit = raw.replace(/^(?:and|with|a|an|the)\s+/i, '')
    if (!isTraitBit(bit)) return
    if (/^(?:on|in|at|inside|aboard)\s+(?:a|an|the)\b/i.test(raw) && !CARRIED_ITEM.test(raw)) return
    const have = foldName([...look, ...outfit].join(' '))
    const words = foldName(bit).split(/\s+/).filter(word => word.length > 2)
    if (words.length && words.every(word => have.includes(word))) return
    if (GARMENT_WORD.test(bit)) absorbTrait(outfit, bit)
    else absorbTrait(look, bit)
  })
}

function rememberPerson(characters, name, looks, outfits) {
  const cleanName = cleanText(name)
  if (!cleanName || isNameNoise(cleanName.split(/\s+/)[0], 'en')) return
  let person = characters.find(item => foldName(item.name) === foldName(cleanName))
  if (!person) {
    person = { name: cleanName, look: '', outfit: '', confidence: 'medium' }
    characters.push(person)
  }
  const look = person.look ? person.look.split(/,\s*/) : []
  const outfit = person.outfit ? person.outfit.split(/,\s*/) : []
  looks.forEach(item => absorbTrait(look, item))
  outfits.forEach(item => absorbTrait(outfit, item))
  person.look = look.filter(Boolean).join(', ')
  person.outfit = outfit.filter(Boolean).join(', ')
  if (person.look || person.outfit) person.confidence = person.confidence === 'low' ? 'medium' : person.confidence
}

function introductions(text, characters, language) {
  let lastSubject = ''
  sentencesOf(text).forEach(sentence => {
    const mentioned = properNames(sentence, language).map(item => item.name).filter(name => characters.some(person => {
      if (foldName(person.name) === foldName(name)) return true
      const bits = person.name.split(/\s+/)
      return bits.length > 1 && bits.some(bit => foldName(bit) === foldName(name))
    }))
    if (mentioned.length) lastSubject = mentioned[mentioned.length - 1]
    if (/\b(?:walks?|runs?|enters?|leaves?|opens?|pours?|reads?|turns?|lifts?|waits?|checks?)\b/i.test(sentence)) return
    const named = sentence.match(/(\p{Lu}[\p{L}'’-]{1,40}(?:\s+\p{Lu}[\p{L}'’-]{1,40}){0,2})\s+is\s+([^.]*)/u)
    if (named) {
      if (/^(?:saint|sainte|st)\b/i.test(named[1])) return
      const name = named[1].split(/\s+/).filter(part => !isNameNoise(part, language)).join(' ')
      const looks = []
      const outfits = []
      cutTraits(named[2]).split(/\s*,\s*|\s+\band\b\s+/i).forEach(part => {
        const bit = cleanText(part).replace(/^(?:with|a|an|the)\s+/i, '')
        if (!isTraitBit(bit) && !/^(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)/i.test(bit)) return
        if (GARMENT_WORD.test(bit)) outfits.push(bit)
        else looks.push(bit)
      })
      rememberPerson(characters, name, looks, outfits)
      if (name) lastSubject = name
    }
    const worn = sentence.match(/^(?:she|he|they|elle|il)\s+(?:has|have|had|a)\s+(.+?)(?:\s+and\s+(?:wears|wore|porte)\s+(.+))?$/iu)
    const owner = characters.find(person => foldName(person.name) === foldName(lastSubject))
      || characters.find(person => person.name.split(/\s+/).some(bit => foldName(bit) === foldName(lastSubject)))
    if (worn && owner) {
      const detail = cutTraits(worn[1])
      rememberPerson(characters, owner.name, detail ? [cleanText(detail)] : [], worn[2] ? [cleanText(cutTraits(worn[2])).replace(/^(?:a|an|the|un|une)\s+/i, '')] : [])
    }
  })
}

function escapeName(name) {
  return String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function introducedPerson(text, name) {
  const label = escapeName(name)
  const listed = text.match(new RegExp(`(?<![\\p{L}])${label}(?![\\p{L}])\\s*,\\s*([^.]{0,180})`, 'iu'))
  if (listed && listed[1].split(',').some(part => isTraitBit(part))) return true
  if (new RegExp(`(?<![\\p{L}])${label}(?![\\p{L}])\\s*,\\s*(?:\\d{1,3}\\b|\\d{1,2}s\\b|(?:early|mid|late)\\s+\\d{1,2}s\\b|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\\b)`, 'iu').test(text)) return true
  if (new RegExp(`(?<![\\p{L}])${label}(?![\\p{L}])\\s+is\\s+(?:a|an|the|\\d|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\\b`, 'iu').test(text)) return true
  if (new RegExp(`\\b(?:old|young|little)\\s+${label}\\b`, 'iu').test(text)) return true
  if (new RegExp(`\\b(?:her|his|their)\\s+(?:[\\p{L}'’-]+\\s+){0,2}(?:nephew|niece|brother|sister|cousin|son|daughter|mother|father|uncle|aunt|neighbour|neighbor|friend|husband|wife)\\s+${label}\\b`, 'iu').test(text)) return true
  return false
}

function humanSubject(text, name) {
  const label = escapeName(name)
  return new RegExp(`(?<![\\p{L}])${label}(?![\\p{L}])\\s+(?:is|was|are|has|had|walks?|runs?|enters?|leaves?|opens?|pours?|sits?|stands?|reads?|turns?|waits?|checks?|lifts?|holds?|follows?|gives?|hands?|meets?|smiles?|laughs?|says?|watches?|carries?|wears?|works?|paints?|writes?|calls?|asks?|nods?|waves?|knocks?|returns?|boards?)\\b`, 'iu').test(text)
}

function keepPerson(text, name, count, mid = 0) {
  const parts = name.split(/\s+/)
  // Weekdays and the closed noise list (Early, Water, Sawdust) are not names.
  // Ordinary dictionary words such as Hope or Will are not in that list: a verb or an appositive keeps them.
  if (parts.some(part => CALENDAR_WORD.has(foldName(part)) || NOT_A_PERSON.has(foldName(part)))) return false
  if (parts.length === 1 && new RegExp(`\\b(?:in|at|on|into|to|dans|sur|im|am|beim|zum|zur|ins|em|nel|nella|der|die|das|dem|den)\\s+${escapeName(name)}\\b`, 'iu').test(text) && !introducedPerson(text, name) && !humanSubject(text, name)) return false
  const positive = introducedPerson(text, name) || humanSubject(text, name) || mid >= 1
  if (positive) return true
  if (parts.length === 1 && placeLexiconHas(parts[0])) return false
  if (new RegExp(`(?<![\\p{L}])${escapeName(name)}(?![\\p{L}])[^.:\\n]{0,90}:\\s*(?:\\d|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)`, 'iu').test(text)) return true
  return count >= 2
}

function mergeAliases(characters) {
  const full = characters.filter(person => person.name.split(/\s+/).length >= 2)
  const drop = new Set()
  characters.forEach(person => {
    const parts = person.name.split(/\s+/)
    if (parts.length !== 1) return
    const key = foldName(person.name)
    const matches = full.filter(other => {
      const bits = other.name.split(/\s+/)
      return foldName(bits[0]) === key || foldName(bits.at(-1)) === key
    })
    if (matches.length !== 1) return
    const target = matches[0]
    const looks = target.look ? target.look.split(/,\s*/) : []
    const outfits = target.outfit ? target.outfit.split(/,\s*/) : []
    String(person.look || '').split(/,\s*/).forEach(item => absorbTrait(looks, item))
    String(person.outfit || '').split(/,\s*/).forEach(item => absorbTrait(outfits, item))
    target.look = looks.filter(Boolean).join(', ')
    target.outfit = outfits.filter(Boolean).join(', ')
    if ((target.look || target.outfit) && target.confidence === 'low') target.confidence = 'medium'
    drop.add(person)
  })
  return characters.filter(person => !drop.has(person))
}

function detectCharacters(text, places = [], language = 'en') {
  const flagged = flaggedNameKeys(text)
  const reserved = placeTokens(places)
  const counts = new Map()
  let skippedFlagged = false
  for (const found of properNames(text, language)) {
    if (isQuotedOrRemembered(text, found.index, language)) continue
    if (inNamedVenue(text, found.index, language)) continue
    const parts = found.name.split(/\s+/)
    if (parts.some(part => flagged.has(foldName(part)))) { skippedFlagged = true; continue }
    if (parts.some(part => reserved.has(foldName(part)))) continue
    const key = foldName(found.name)
    const entry = counts.get(key) || { forms: new Map(), count: 0, mid: 0 }
    entry.count += 1
    if (!sentenceStartAt(text, found.index)) entry.mid += 1
    entry.forms.set(found.name, (entry.forms.get(found.name) || 0) + 1)
    counts.set(key, entry)
  }
  const warnings = []
  const characters = []
  const rows = [...counts.entries()].map(([key, entry]) => {
    const forms = [...entry.forms.entries()].sort((a, b) => b[1] - a[1] || Number(/[^\u0000-\u007f]/.test(b[0])) - Number(/[^\u0000-\u007f]/.test(a[0])))
    return { key, entry, forms, name: forms[0][0] }
  })
  const kept = new Set(rows.filter(row => keepPerson(text, row.name, row.entry.count, row.entry.mid)).map(row => row.key))
  rows.forEach(row => {
    if (kept.has(row.key) || row.name.includes(' ')) return
    const owners = rows.filter(other => other.name.split(/\s+/).length >= 2 && kept.has(other.key) && other.name.split(/\s+/).some(part => foldName(part) === foldName(row.name)))
    if (owners.length === 1) kept.add(row.key)
  })
  const candidateNames = rows.filter(row => kept.has(row.key)).map(row => row.name)
  for (const { key, entry, forms, name } of rows) {
    if (!kept.has(key)) continue
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
    uncoveredClauses(text, name, candidateNames, look, outfit)
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
  introductions(text, characters, language)
  characters.forEach(person => {
    const label = person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const colon = String(text).match(new RegExp(`(?<![\\p{L}])${label}(?![\\p{L}])[^.:\\n]{0,90}:\\s*([^.]*)`, 'iu'))
    if (!colon) return
    const looks = []
    const outfits = []
    cutTraits(colon[1]).split(/,\s*|\s+\band\b\s+/i).forEach(part => {
      const bit = cleanText(part).replace(/^(?:a|an|the|with)\s+/i, '')
      if (!bit || TRAIT_STOP.test(bit) || bit.split(/\s+/).length > 6) return
      if (GARMENT_WORD.test(bit) || CARRIED_ITEM.test(bit)) outfits.push(bit)
      else looks.push(bit)
    })
    rememberPerson(characters, person.name, looks, outfits)
  })
  characters.forEach(person => {
    const looks = []
    const outfits = []
    const trimLead = value => {
      let bit = cleanText(value).replace(/[.,;]+$/g, '')
      while (/^(?:with|and|a|an|the)\s+/i.test(bit)) bit = bit.replace(/^(?:with|and|a|an|the)\s+/i, '')
      return bit
    }
    const absorbOutfit = value => absorbTrait(outfits, trimLead(value))
    String(person.outfit || '').split(/,\s*|\s+\band\b\s+/i).forEach(part => {
      const bit = trimLead(part)
      if (!bit) return
      if (GARMENT_WORD.test(bit) || CARRIED_ITEM.test(bit)) absorbOutfit(bit)
      else absorbTrait(looks, bit)
    })
    String(person.look || '').split(/,\s*/).forEach(part => {
      part.split(/\s+\band\b\s+/i).forEach(piece => {
        const bit = trimLead(piece)
        if (!bit || TRAIT_STOP.test(bit)) return
        if (GARMENT_WORD.test(bit)) absorbOutfit(bit)
        else absorbTrait(looks, bit)
      })
    })
    person.look = looks.join(', ')
    person.outfit = outfits.join(', ')
  })
  const people = mergeAliases(characters)
  if (!people.length && !skippedFlagged) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  return { characters: people, warnings, skippedFlagged }
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
  const existing = places.find(place => foldName(place.name) === foldName(clean))
  if (existing) {
    if (trusted) existing.trusted = true
    return
  }
  places.push({ name: clean, description, confidence, trusted })
}

function locativePhrases(source, language) {
  const found = []
  const pattern = /\b(?:in|at|on|inside|aboard|within|dans|sur|im|auf|nel|nella)\s+(?:the|a|an|le|la|les|l['’]|der|die|das|dem|den|il|lo|un|une)\s+([^.,;:!?]+)/giu
  for (const match of String(source || '').matchAll(pattern)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    const raw = cleanText(match[1]).split(/\s+/).filter(Boolean)
    const words = []
    for (let index = 0; index < raw.length && words.length < 4; index += 1) {
      const word = raw[index]
      const key = foldName(word)
      if (!key) continue
      if (words.length && /^\p{Lu}/u.test(word)) break
      const compound = [1, 2, 3, 4].some(size => placeLexiconHas([...words, ...raw.slice(index, index + size)].map(foldName).join(' ')))
      if (!compound && (STOP.has(key) || TIME_BLOCK.has(key) || CALENDAR_WORD.has(key) || NOT_A_PERSON.has(key))) break
      if (!compound && /^(?:and|but|while|when|with|where|who|that|his|her|their|she|he|then|by|near|under|beside)$/i.test(word)) break
      if (!compound && (VERBS.has(key) || TRAIT_STOP.test(word))) break
      words.push(word)
    }
    if (!words.length) continue
    const head = foldName(words.at(-1))
    const objectHead = new Set(['drawer', 'drawers', 'tiroir', 'tiroirs', 'window', 'windows', 'door', 'doors', 'table', 'cup', 'glass', 'list', 'page', 'notebook', 'carnet', 'carnets', 'pocket', 'bag', 'book', 'books', 'paper', 'chair', 'floor', 'wall', 'shelf', 'shelves', 'counter', 'desk', 'hand', 'hands'])
    objectHead.add('bench')
    objectHead.add('banc')
    objectHead.add('bancs')
    objectHead.add('chaise')
    objectHead.add('stool')
    objectHead.add('sofa')
    objectHead.add('couch')
    if (!head || head.length < 3 || STOP.has(head) || TIME_BLOCK.has(head) || isNeverPlace(head) || isNeverPlace(words.join(' ')) || objectHead.has(head)) continue
    if (['morning', 'evening', 'night', 'end', 'left', 'right', 'way', 'dark', 'light', 'distance', 'front', 'back', 'side', 'time', 'moment', 'meantime', 'same', 'other', 'another', 'next', 'meme', 'autre', 'cut', 'pixie', 'hair', 'eyebrow', 'scar', 'sweater', 'pocket', 'sleeve', 'collar', 'line', 'bottom', 'top', 'edge', 'middle', 'corner', 'nail', 'pipe', 'screw', 'bolt', 'rope'].includes(head)) continue
    if (PLACE_KEYS.has(head)) continue
    const tag = placeTag(language, words.join(' ')) || placeTag(language, head)
    if (tag === 'a:object' || tag === 'a:material' || tag === 'a:adjective' || tag === 'a:garment' || tag === 'a:determiner') continue
    if (!tag && !placeLexiconHas(head) && !placeLexiconHas(words.join(' '))) continue
    const phrase = words.join(' ')
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    found.push({ name, phrase, index: match.index })
  }
  return found
}

function detectPlaces(text, language, people = new Set()) {
  const flagged = flaggedNameKeys(text)
  const places = []
  const warnings = []
  let skippedFlagged = false
  const namedFlag = value => tokens(value).some(token => flagged.has(foldName(token)))
  const source = String(text || '')
  for (const match of source.matchAll(/\b(village|town|city|hamlet|bourg)\s+of\s+(\p{Lu}[\p{L}'’-]*)/gu)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    if (namedFlag(match[2])) { skippedFlagged = true; continue }
    pushPlace(places, match[2], language === 'fr' ? `un ${match[1]}` : `a ${match[1].toLowerCase()}`, 'high', true)
  }
  for (const match of source.matchAll(/\b(Rue|Street|Road|Avenue|Lane|Boulevard|Via|Rua|Strasse|Straße|Strada)\s+(\p{Lu}[\p{L}'’-]*)/gu)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    if (namedFlag(match[2])) { skippedFlagged = true; continue }
    pushPlace(places, `${match[1]} ${match[2]}`, language === 'fr' ? 'une rue' : 'a street', 'high', true)
  }
  for (const match of source.matchAll(/\b((?:\p{Lu}[\p{L}'’-]*)(?:\s+\p{Lu}[\p{L}'’-]*){0,2})\s+(Street|Road|Avenue|Lane|Boulevard|Way|Rue)\b/gu)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    if (namedFlag(match[1]) || isNameNoise(match[1], language)) { if (namedFlag(match[1])) skippedFlagged = true; continue }
    pushPlace(places, `${match[1]} ${match[2]}`, language === 'fr' ? 'une rue' : 'a street', 'high', true)
  }
  for (const match of source.matchAll(/\b((?:village|town|market|city)\s+square)\b/giu)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    const name = match[1].replace(/^\p{Ll}/u, char => char.toUpperCase())
    pushPlace(places, name, language === 'fr' ? 'une place' : 'a square', 'high', true)
  }
  for (const match of source.matchAll(/\b(?:in|at|through)\s+(\p{Lu}[\p{L}'’-]*)/gu)) {
    const name = match[1]
    if (flagged.has(foldName(name))) { skippedFlagged = true; continue }
    if (isQuotedOrRemembered(source, match.index, language)) continue
    const after = source.slice(match.index + match[0].length)
    if (/['’]s\b/i.test(name) || /^['’]s\b/i.test(after)) continue
    if (STOP.has(foldName(name)) || isFunctionWord(name, language) || TIME_BLOCK.has(foldName(name)) || PLACE_KEYS.has(foldName(name)) || isNeverPlace(name) || people.has(foldName(name))) continue
    pushPlace(places, name, name, 'medium', true)
  }
  for (const match of source.matchAll(/\b(?:on|in|at|along)\s+(?:a|an|the)\s+((?:[\p{L}'’-]+\s+){0,3}(?:quay|quayside|pier|dock|wharf|alley|rooftop|courtyard))\b/giu)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    const phrase = cleanText(match[1])
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    const head = foldName(phrase.split(/\s+/).at(-1))
    const modifiers = phrase.split(/\s+/).slice(0, -1)
    if (PLACE_KEYS.has(head) && modifiers.every(word => /^(?:même|meme|same|other|next|autre|ce|cet)$/i.test(word))) continue
    if (places.some(place => foldName(place.name) === foldName(name) || foldName(place.name) === head)) continue
    pushPlace(places, name, `a ${phrase}`, 'high', true)
  }
  for (const phrase of ['loading dock', 'restoration lab', 'ferry deck', 'courier depot', 'quai de chargement', 'laboratoire de restauration', 'pont du ferry', 'cais de carga', 'laderampe', 'fährdeck', 'banchina di carico', '積み込み場', '装卸台', 'vineyard', 'vignoble', 'vinhedo', 'weinberg', 'vigna', 'ぶどう畑', '葡萄园', 'laboratory', 'laboratoire', 'laboratório', 'laboratorio', 'depot', 'entrepôt', 'depósito', 'deposito']) {
    if (!new RegExp(`(?<![\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(source)) continue
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    if (places.some(place => foldName(place.name) === foldName(name))) continue
    pushPlace(places, name, placeDescription(source, phrase, language, `a ${phrase}`) || name, 'high', true)
  }
  for (const match of source.matchAll(/\b(?:in|at|on|inside|aboard|dans|sur|au|aux|im|auf|nel|nella|an|am)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|l['’])?((?:[\p{L}'’-]+\s+){0,2}(?:dock|lab|laboratory|deck|vineyard|depot|warehouse|hangar|clinic|platform|pier|laboratoire|vignoble|entrepôt|entrepot|cais|laboratorio|banchina|vigna|deposito|weinberg|quai))\b/giu)) {
    if (isQuotedOrRemembered(source, match.index, language)) continue
    const phrase = cleanText(match[1])
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    if (!name || places.some(place => foldName(place.name) === foldName(name))) continue
    const described = placeDescription(source, phrase, language)
    pushPlace(places, name, described || name, 'high', true)
  }
  locativePhrases(source, language).forEach(item => {
    if (people.has(foldName(item.name)) || item.name.split(/\s+/).every(word => people.has(foldName(word)))) return
    if (isQuotedOrRemembered(source, item.index, language)) return
    const described = item.phrase.split(/\s+/).length > 1 ? `a ${item.phrase}` : (placeDescription(source, item.phrase, language, '') || item.name)
    pushPlace(places, item.name, described, 'high', true)
  })
  const folded = foldName(source)
  const covered = new Set(places.flatMap(place => tokens(place.name).map(foldName)))
  PLACES.forEach(place => {
    const hit = place.keys.find(key => new RegExp(`(?:^|[^\\p{L}])${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded))
    if (!hit || people.has(foldName(hit))) return
    if (covered.has(foldName(hit)) && places.some(item => foldName(item.name).includes(foldName(hit)) && foldName(item.name) !== foldName(hit))) return
    const preceded = place.keys.some(key => new RegExp(`(?:au|aux|dans|sur|chez|du|de|at|in|on|to|through)\\s+(?:la\\s+|le\\s+|l'|the\\s+)?(?:[\\p{L}'’-]+\\s+){0,2}${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded))
    const label = language === 'fr' ? place.fr : place.en
    const canned = language === 'fr' ? place.frDesc : place.enDesc
    const described = placeDescription(source, hit, language, canned)
    pushPlace(places, label, described || label, preceded ? 'high' : 'medium')
  })
  const unknown = [...source.matchAll(/\b(?:at the|in the|through the|to the|au|dans la|dans le|sur la|sur le)\s+([\p{Ll}'’-]+(?:\s+[\p{Ll}'’-]+){0,2})/gu)]
  unknown.forEach(match => {
    if (isQuotedOrRemembered(source, match.index, language)) return
    const phrase = cleanText(match[1]).split(/\s+/).filter((word, index, all) => index === all.length - 1 || !/^(?:meme|même|autre|petit|petite|vieux|vieille|grand|grande|old|same|little|small)$/iu.test(word)).join(' ')
    if (namedFlag(phrase)) { skippedFlagged = true; return }
    const key = foldName(phrase.split(/\s+/).at(-1))
    if (!key || STOP.has(key) || TIME_BLOCK.has(key) || !PLACE_KEYS.has(key) || NOT_A_PLACE.has(key) || isNeverPlace(phrase) || isNeverPlace(key) || /\b(?:village|town|city|of)\b/i.test(phrase) || places.some(place => foldName(place.name) === key || foldName(place.name).endsWith(key))) return
    if (!placeMentionIsReal(source, key, language)) return
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    pushPlace(places, name, name, 'low')
    warnings.push({ code: 'uncertain_place', message: `Confirm this place: ${name}.`, target: 'places', options: [name], name })
  })
  const quote = quoteSpans(source)
  const venues = namedVenues(source, language)
  venues.forEach(venue => {
    if (venue.spans.every(([start]) => inSpans(start, quote))) return
    pushPlace(places, venue.name, venue.description, 'high', true)
  })
  const hits = libraryHits(source, language).filter(hit => {
    if (people.has(foldName(hit.lemma)) || hit.lemma.split(/\s+/).some(word => people.has(foldName(word)))) return false
    if (isQuotedOrRemembered(source, hit.index, language)) return false
    return true
  })
  const locativeSentences = new Set()
  hits.filter(hit => hit.locative).forEach(hit => {
    const start = source.lastIndexOf('.', Math.max(0, hit.index - 1))
    locativeSentences.add(start)
  })
  hits.forEach(hit => {
    if (!hit.locative) {
      const start = source.lastIndexOf('.', Math.max(0, hit.index - 1))
      if (locativeSentences.has(start)) return
    }
    const described = placeDescription(source, hit.lemma, language, '')
    pushPlace(places, hit.name, described || hit.name, hit.tag === 's' ? 'high' : 'medium', true)
    if (hit.tag === 'unlisted') {
      const saved = places.find(place => foldName(place.name) === foldName(hit.name))
      if (saved) saved.unlisted = true
    }
  })
  let visible = places.filter(place => {
    if (venues.some(venue => foldName(venue.name).includes(foldName(place.name)) && foldName(venue.name) !== foldName(place.name))) return false
    if (place.trusted) return true
    const known = PLACES.find(item => item.fr === place.name || item.en === place.name)
    const keys = known ? known.keys : [place.name]
    return keys.some(key => placeMentionIsReal(source, key, language))
  })
  if (!visible.length) {
    const generic = genericPlace(language)
    visible = [{ ...generic, confidence: 'low', trusted: true }]
    if (!skippedFlagged) warnings.push({ code: 'uncertain_place', message: `No place name found. Using ${generic.name}.`, target: 'places', name: generic.name, uncertain: true })
  }
  return { places: visible, warnings, skippedFlagged }
}

const DESC_SKIP = new Set(['the', 'a', 'an', 'in', 'at', 'on', 'inside', 'her', 'his', 'their', 'and', 'with', 'of', 'to', 'from', 'by', 'for', 'into', 'through', 'aboard', 'within', 'le', 'la', 'les', 'un', 'une', 'dans', 'sur', 'au', 'this', 'that', 'its'])
const PREPOSITION = new Set(['in', 'at', 'on', 'inside', 'into', 'through', 'from', 'to', 'for', 'with', 'by', 'of', 'dans', 'sur', 'au', 'aux', 'im', 'auf', 'nel', 'nella'])

function placeDescription(source, key, language, fallback = '') {
  const escaped = String(key || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(source || '').match(new RegExp(`((?:[\\p{L}'’-]+\\s+){1,4})${escaped}(?![\\p{L}])`, 'iu'))
  if (match) {
    const raw = cleanText(match[1]).split(/\s+/).filter(Boolean)
    const words = []
    for (let index = raw.length - 1; index >= 0; index -= 1) {
      const word = raw[index]
      const token = foldName(word)
      if (!token || PREPOSITION.has(token)) break
      if (token.length < 3 || DESC_SKIP.has(token) || STOP.has(token) || TIME_BLOCK.has(token) || VERBS.has(token) || CALENDAR_WORD.has(token) || PLACE_KEYS.has(token)) {
        if (words.length) break
        continue
      }
      if (/^\p{Lu}/u.test(word) || /['’]/.test(word)) break
      words.unshift(word)
    }
    const tail = String(source).slice((match.index || 0) + match[0].length).match(/^\s+((?:by|with|beside|near|under)\s+the\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2})/iu)
    const extra = tail ? tail[1] : ''
    if (words.length) return `a ${words.join(' ')} ${key}${extra ? ` ${extra}` : ''}`
    if (extra) return `${key} ${extra}`
  }
  const bare = foldName(fallback).replace(/^(?:a|an|the|un|une|le|la|les|der|die|das)\s+/, '')
  if (fallback && bare && bare !== foldName(key) && !/named in the text|nommé dans le texte|lieu cité|place named/i.test(fallback)) return fallback
  return ''
}

function genericPlace(language) {
  const table = {
    fr: ['Le lieu', 'un lieu que le texte ne nomme pas'],
    pt: ['O lugar', 'um lugar que o texto não nomeia'],
    it: ['Il luogo', 'un luogo che il testo non nomina'],
    ja: ['場所', '文が名を挙げない場所']
  }
  const pair = table[language] || ['The setting', 'a place the text does not name']
  return { name: pair[0], description: pair[1], uncertain: true }
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
  const source = String(text || '')
  const hit = label => new RegExp(`(?<![\\p{L}])${escapeName(label)}(?![\\p{L}])`, 'iu').test(source)
  return characters.filter(character => {
    const name = character?.name
    if (!name) return false
    if (hit(name)) return true
    const parts = name.split(/\s+/)
    if (parts.length < 2) return false
    return [parts[0], parts.at(-1)].some(part => {
      const owners = characters.filter(other => other.name.split(/\s+/).some(bit => foldName(bit) === foldName(part)))
      return owners.length === 1 && hit(part)
    })
  })
}

function aliasLabels(characters) {
  const labels = []
  characters.forEach(character => {
    if (!character?.name) return
    labels.push(character.name)
    const parts = character.name.split(/\s+/)
    if (parts.length < 2) return
    ;[parts[0], parts.at(-1)].forEach(part => {
      const owners = characters.filter(other => other.name.split(/\s+/).some(bit => foldName(bit) === foldName(part)))
      if (owners.length === 1) labels.push(part)
    })
  })
  return [...new Set(labels)]
}

function canonicalWho(who, characters) {
  const parts = String(who || '').split(/\s+and\s+|\s+et\s+|\s+und\s+/i).map(part => part.trim()).filter(Boolean)
  const mapped = []
  parts.forEach(part => {
    const exact = characters.find(item => foldName(item.name) === foldName(part))
    const owners = exact ? [exact] : characters.filter(item => {
      const bits = item.name.split(/\s+/)
      return bits.length > 1 && (foldName(bits[0]) === foldName(part) || foldName(bits.at(-1)) === foldName(part))
    })
    const name = owners.length === 1 ? owners[0].name : part
    if (!mapped.some(item => foldName(item) === foldName(name))) mapped.push(name)
  })
  return mapped.join(' and ')
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
    if (known) known.keys.forEach(key => { if (!isCueStopword(key)) keys.add(key) })
    tokens(place.name).forEach(token => { if (!isCueStopword(token)) keys.add(token) })
    return { name: place.name, keys: [...keys], uncertain: place.uncertain === true, unlisted: place.unlisted === true }
  })
}

function detectScenes(text, characters, places, language, flagged, options = {}) {
  const warnings = []
  const genders = genderMap(text, characters)
  const narrative = splitNarrative(text, {
    language,
    places: placeRecords(places),
    characters: aliasLabels(characters).map(name => ({ name })),
    verbs: [...VERBS],
    lexicon: PLACES.map(item => ({ name: language === 'fr' ? item.fr : item.en, keys: item.keys })),
    splitScenes: options.splitScenes !== false,
    skip: sentence => isMeetIntro(sentence)
  })
  let carriedWhere = ''
  const scenes = narrative.shots.map((shot, index) => {
    const foundNames = namesIn(shot.what, characters)
    const pronounWho = whoFromPronoun(shot.what, characters, genders, language)
    const who = canonicalWho(foundNames.length ? foundNames.map(item => item.name).join(' and ') : (pronounWho || shot.who), characters)
    const head = locativeHeads(shot.what, language).find(item => item.moves !== false && mentionMovesScene(shot.what, item.index, language))
    const genericWhere = /^(?:Le lieu|The setting|O lugar|Il luogo|場所|场景)$/u.test(shot.where || '')
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
      where: (() => {
        const venue = namedVenues(shot.what, language).find(item => item.name.split(/\s+/).length > 1 && item.spans?.some(([start]) => !isQuotedOrRemembered(shot.what, start, language)))
        const current = carriedWhere || shot.where || ''
        let where = venue?.name || current
        if (!head && !venue) where = shot.cutReason ? (shot.where || carriedWhere) : (carriedWhere || shot.where || '')
        if (head && !venue) {
          const left = foldName(current)
          const right = foldName(head.name)
          if (!left || left === right) where = head.name
          else if (left.endsWith(` ${right}`) || right.endsWith(` ${left}`)) where = left.length >= right.length ? current : head.name
          else where = head.name
        }
        if (where) carriedWhere = where
        return where
      })(),
      what: shot.what,
      source: shot.source || shot.what,
      flags: Array.isArray(shot.flags) ? shot.flags : [],
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
  if (language !== 'en') return detectLocalized(text, language, options)
  const flagged = flaggedNameKeys(text)
  const roughCast = detectCharacters(text, [], language)
  const personKeys = new Set(roughCast.characters.flatMap(person => [foldName(person.name), ...person.name.split(/\s+/).map(foldName)]))
  const foundPlaces = detectPlaces(text, language, personKeys)
  const foundCharacters = detectCharacters(text, foundPlaces.places, language)
  const ambience = detectAmbience(text)
  const foundScenes = detectScenes(text, foundCharacters.characters, foundPlaces.places, language, flagged, options)
  foundScenes.scenes.forEach(scene => {
    if (!scene.where) return
    const richer = placeDescription(text, scene.where, language, '') || (scene.where.split(/\s+/).length > 1 ? `a ${scene.where.toLowerCase()}` : '')
    const existing = foundPlaces.places.find(place => foldName(place.name) === foldName(scene.where))
    if (existing) {
      if (richer && foldName(existing.description) === foldName(existing.name)) existing.description = richer
      return
    }
    foundPlaces.places.push({ name: scene.where, description: richer || scene.where, unlisted: true, confidence: 'low', trusted: true })
  })
  if (foundPlaces.places.some(place => place.unlisted || (place.confidence === 'high' || place.confidence === 'medium'))) {
    foundPlaces.places = foundPlaces.places.filter(place => !place.uncertain)
  }
  const openingShotLight = foundScenes.scenes[0]?.light || ''
  const warnings = [...foundCharacters.warnings, ...foundPlaces.warnings, ...foundScenes.warnings]
  if (foundCharacters.skippedFlagged || foundPlaces.skippedFlagged) {
    warnings.push({ code: 'risk_note', tone: 'note', message: 'Public figures, brands, and trademarks in this text are covered by the risk warnings.' })
  }
  const scenario = {
    characters: foundCharacters.characters.map(({ name, look, outfit }) => ({ name, look, outfit })),
    places: foundPlaces.places.map(({ name, description, uncertain }) => ({ name, description, ...(uncertain ? { uncertain: true } : {}) })),
    light: openingShotLight,
    mood: ambience.mood,
    scenes: foundScenes.scenes.map(({ number, who, where, what, duration, light, source, flags }) => ({ number, who, where, what, duration, ...(light ? { light } : {}), ...(source ? { source } : {}), ...(flags?.length ? { flags } : {}) }))
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
    light: openingShotLight,
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
