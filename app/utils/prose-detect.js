/** Deterministic prose detection for FR and EN. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'

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
  { keys: ['bar'], fr: 'Bar', en: 'Bar', frDesc: 'un bar', enDesc: 'a bar' }
]

const TIME_BLOCK = new Set(['matin', 'morning', 'soir', 'evening', 'nuit', 'night', 'jour', 'day', 'aube', 'dawn', 'dusk', 'soleil', 'sun', 'pluie', 'rain', 'tard', 'lendemain', 'petit'])
const JUMP = /\b(plus tard|le lendemain|au lendemain|le matin suivant|the next morning|next morning|the next day|later)\b/i
const VERBS = new Set(['entre', 'sort', 'verse', 'renverse', 'rit', 'rire', 'marche', 'court', 'revient', 'ouvre', 'ferme', 'regarde', 'sourit', 'prend', 'donne', 'boit', 'parle', 'dit', 'va', 'vient', 'arrive', 'part', 'tourne', 'tend', 'attrape', 'pose', 'voit', 'pleure', 'crie', 'attend', 'sert', 'quitte', 'traverse', 'monte', 'descend', 'pousse', 'tombe', 'lance', 'vole', 'opens', 'open', 'pours', 'pour', 'laughs', 'laugh', 'walks', 'walk', 'returns', 'return', 'rides', 'ride', 'stops', 'stop', 'enters', 'enter', 'leaves', 'leave', 'sits', 'sit', 'stands', 'stand', 'looks', 'look', 'turns', 'turn', 'smiles', 'smile', 'spills', 'spill', 'runs', 'run', 'flies', 'fly', 'hits', 'hit', 'watches', 'watch', 'finds', 'find', 'follows', 'follow', 'crosses', 'cross', 'drinks', 'drink', 'waits', 'wait', 'closes', 'close', 'unlocks', 'unlock'])

function languageOf(text) {
  const fr = (text.match(/\b(le|la|les|un|une|des|dans|elle|il|avec|sur|au|aux|et|est|son|sa|une)\b/gi) || []).length
  const en = (text.match(/\b(the|and|she|he|with|on|in|at|her|his|is|a)\b/gi) || []).length
  return fr > en ? 'fr' : 'en'
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

function detectCharacters(text) {
  const starts = sentenceStarts(text)
  const counts = new Map()
  tokens(text).forEach(token => {
    if (!/^\p{Lu}/u.test(token)) return
    const key = foldName(token)
    if (key.length < 2 || STOP.has(key) || PLACE_KEYS.has(key) || TIME_BLOCK.has(key)) return
    const entry = counts.get(key) || { forms: new Map(), count: 0, mid: 0 }
    entry.count += 1
    if (!starts.has(key)) entry.mid += 1
    entry.forms.set(token, (entry.forms.get(token) || 0) + 1)
    counts.set(key, entry)
  })
  const warnings = []
  const characters = []
  for (const [key, entry] of counts) {
    const mentioned = sentencesOf(text).filter(sentence => tokens(sentence).some(token => foldName(token) === key)).join(' ')
    const look = unique([
      matchOne(mentioned, /cheveux\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /(?:curly|wavy|straight|long|short|red|brown|black|blonde|blond|roux|rousse)\s+(?:red\s+|brown\s+|black\s+)?hair/iu),
      matchOne(mentioned, /yeux\s+[\p{L}'’-]+/iu),
      matchOne(mentioned, /(?:blue|green|brown|red|amber)\s+eyes/iu),
      matchOne(mentioned, /lunettes(?:\s+rondes)?/iu),
      matchOne(mentioned, /(?:round\s+)?glasses/iu),
      matchOne(mentioned, /jeune/iu),
      matchOne(mentioned, /young(?:\s+(?:woman|man|girl|boy))?/iu)
    ])
    const outfit = unique([
      matchOne(mentioned, /tablier(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /(?:green|red|blue|grey|gray|black|white|vert|verte|rouge|gris|grise)\s+(?:apron|tablier)/iu),
      matchOne(mentioned, /apron/iu),
      matchOne(mentioned, /casquette(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /(?:grey|gray|red|black|grise|gris)\s+(?:cap|casquette)/iu),
      matchOne(mentioned, /manteau(?:\s+[\p{L}'’-]+)?/iu),
      matchOne(mentioned, /jacket/iu)
    ])
    const keep = entry.count >= 2 || entry.mid >= 1 || look.length > 0 || outfit.length > 0
    if (!keep) continue
    const forms = [...entry.forms.entries()].sort((a, b) => b[1] - a[1] || Number(/[^\u0000-\u007f]/.test(b[0])) - Number(/[^\u0000-\u007f]/.test(a[0])))
    const name = forms[0][0]
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
  if (!characters.length) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  return { characters, warnings }
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

function detectPlaces(text, language) {
  const places = []
  const warnings = []
  const folded = foldName(text)
  PLACES.forEach(place => {
    if (!place.keys.some(key => new RegExp(`(?:^|[^\\p{L}])${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded))) return
    const preceded = place.keys.some(key => new RegExp(`(?:au|aux|dans|sur|chez|du|de|at|in|on|to)\\s+(?:la\\s+|le\\s+|l'|the\\s+)?${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded))
    places.push({
      name: language === 'fr' ? place.fr : place.en,
      description: language === 'fr' ? place.frDesc : place.enDesc,
      confidence: preceded ? 'high' : 'medium'
    })
  })
  const unknown = [...String(text).matchAll(/\b(?:at the|in the|on the|to the|au|dans la|dans le|sur la|sur le)\s+([A-Za-zÀ-ÿ][\p{L}'’-]+(?:\s+[\p{L}'’-]+)?)/giu)]
  unknown.forEach(match => {
    const phrase = cleanText(match[1])
    const key = foldName(phrase.split(/\s+/).at(-1))
    if (!key || STOP.has(key) || TIME_BLOCK.has(key) || PLACE_KEYS.has(key) || places.some(place => foldName(place.name) === key)) return
    const name = phrase.replace(/^\p{Ll}/u, char => char.toUpperCase())
    places.push({ name, description: language === 'fr' ? 'un lieu cité dans le texte' : 'a place named in the text', confidence: 'low' })
    warnings.push({ code: 'uncertain_place', message: `Confirm this place: ${name}.`, target: 'places', options: [name], name })
  })
  return { places, warnings }
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

function clausesOf(sentence) {
  const rough = sentence.split(/\s*(?:,|;|\bpuis\b|\bthen\b|\band then\b)\s*/i).flatMap(part => {
    const sides = part.split(/\s+\b(?:et|and)\b\s+/i).map(item => item.trim()).filter(Boolean)
    if (sides.length >= 2 && sides.every(hasVerb)) return sides
    return [part.trim()]
  }).filter(Boolean)
  const verbal = rough.filter(hasVerb)
  return verbal
}

function namesIn(text, characters) {
  return characters.filter(character => tokens(text).some(token => foldName(token) === foldName(character.name)))
}

function placeIn(text, places) {
  const folded = foldName(text)
  return places.find(place => new RegExp(`(?:^|\\s)${foldName(place.name)}(?:\\s|$)`).test(folded) || PLACES.find(item => (item.fr === place.name || item.en === place.name) && item.keys.some(key => new RegExp(`(?:^|\\s)${foldName(key)}(?:\\s|$)`).test(folded))))
}

function detectScenes(text, characters, places, language) {
  const warnings = []
  const scenes = []
  let lastWho = characters[0]?.name || ''
  let lastWhere = places[0]?.name || ''
  splitBlocks(text).forEach(block => {
    sentencesOf(block).forEach(sentence => {
      const actions = clausesOf(sentence)
      if (!actions.length) return
      actions.forEach(action => {
        const foundNames = namesIn(`${sentence} ${action}`, characters)
        const who = foundNames.length ? foundNames.slice(0, 2).map(item => item.name).join(language === 'fr' ? ' et ' : ' and ') : lastWho
        if (who) lastWho = who.split(/\s+(?:et|and)\s+/)[0]
        const foundPlace = placeIn(`${sentence} ${action}`, places)
        const where = foundPlace?.name || lastWhere
        if (where) lastWhere = where
        const index = scenes.length
        let confidence = 'high'
        if (!foundNames.length || !foundPlace) confidence = 'medium'
        if (!where) {
          confidence = 'low'
          warnings.push({ code: 'missing_place', message: `No place found for scene ${index + 1}.`, target: 'scenes', index, options: places.map(place => place.name) })
        }
        if (!who) {
          confidence = 'low'
          warnings.push({ code: 'missing_character', message: `No character found for scene ${index + 1}.`, target: 'scenes', index, options: characters.map(character => character.name) })
        }
        scenes.push({ number: index + 1, who: who || '', where: where || '', what: cleanText(action).replace(/[.!?]+$/, ''), duration: 3, confidence })
      })
    })
  })
  return { scenes, warnings }
}

function overall(parts) {
  const values = parts.filter(Boolean)
  if (values.includes('low')) return 'low'
  if (values.includes('medium')) return 'medium'
  return values.length ? 'high' : 'low'
}

export function detectProse(input) {
  const text = String(input || '').replace(/\r\n/g, '\n').trim()
  const language = languageOf(text)
  const foundCharacters = detectCharacters(text)
  const foundPlaces = detectPlaces(text, language)
  const ambience = detectAmbience(text)
  const foundScenes = detectScenes(text, foundCharacters.characters, foundPlaces.places, language)
  const warnings = [...foundCharacters.warnings, ...foundPlaces.warnings, ...foundScenes.warnings]
  const scenario = {
    characters: foundCharacters.characters.map(({ name, look, outfit }) => ({ name, look, outfit })),
    places: foundPlaces.places.map(({ name, description }) => ({ name, description })),
    light: ambience.light,
    mood: ambience.mood,
    scenes: foundScenes.scenes.map(({ number, who, where, what, duration }) => ({ number, who, where, what, duration }))
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
    light: ambience.light,
    mood: ambience.mood,
    scenes: foundScenes.scenes,
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
