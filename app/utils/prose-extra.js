/** Rule-based prose detection for Portuguese. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { cueLight, findPlaceCue, inNamedVenue, isFunctionWord, isNumberWord, isQuotedOrRemembered, isVenueType, lightAfterCue, mentionMovesScene, namedVenues } from './scene-split.js'
import { isNonPlaceNoun, libraryHits, locativeHeads } from './place-lexicon.js'
import { isNeverPlace } from './scene-split.js'

const LEX = {
  pt: {
    stop: ['a', 'o', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'e', 'que', 'com', 'por', 'para', 'se', 'seu', 'sua', 'ele', 'ela', 'eles', 'elas', 'ao', 'aos', 'pelo', 'pela'],
    verbs: ['entrega', 'entregar', 'lê', 'le', 'ler', 'afasta', 'afasta-se', 'observa', 'observar', 'abre', 'fecha', 'caminha', 'corre', 'entra', 'sai', 'sorri', 'dá', 'da', 'vê', 've', 'espera', 'pega', 'pousa', 'volta'],
    places: [
      ['cais', 'Cais', 'um cais'],
      ['café', 'Café', 'um café'],
      ['cafe', 'Café', 'um café'],
      ['rua', 'Rua', 'uma rua'],
      ['praia', 'Praia', 'uma praia'],
      ['floresta', 'Floresta', 'uma floresta'],
      ['casa', 'Casa', 'uma casa'],
      ['parque', 'Parque', 'um parque'],
      ['estação', 'Estação', 'uma estação'],
      ['estacao', 'Estação', 'uma estação'],
      ['cozinha', 'Cozinha', 'uma cozinha'],
      ['ponte', 'Ponte', 'uma ponte']
    ],
    look: /(?:cerca de\s+\d{1,3}\s+anos|\d{1,3}\s+anos|\d{1,3}|nos seus\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?|pescador|pescadora|cabelo\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2}|barba\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?|olhos\s+[\p{L}'’-]+|óculos(?:\s+[\p{L}'’-]+)?)/giu,
    outfit: /(?:casaco(?:\s+de\s+lã)?\s+[\p{L}'’-]+|vestido\s+[\p{L}'’-]+|avental\s+[\p{L}'’-]+|camisa\s+[\p{L}'’-]+|jaqueta\s+[\p{L}'’-]+|blusa\s+[\p{L}'’-]+|saia\s+[\p{L}'’-]+|(?:um|uma)\s+(?:apito|lanterna|chave|carta|bússola|bussola|martelo|câmara|camera))/giu,
    feminine: ['ela'],
    masculine: ['ele'],
    meet: /\b(encontra|conhece)\b/i,
    light: [[/\b(amanhecer|aurora)\b/i, 'dawn'], [/\b(crepúsculo|anoitecer|entardecer)\b/i, 'dusk'], [/\b(noite|meia-noite)\b/i, 'night'], [/\b(dia|manhã|tarde)\b/i, 'day']],
    mood: [[/\b(sorri|rir|riso)\b/i, 'playful'], [/\b(medo|ansioso)\b/i, 'uneasy'], [/\b(calmo|silêncio|triste)\b/i, 'quiet']]
  }
}

function tokens(text) {
  return String(text || '').match(/[\p{L}][\p{L}'’-]+/gu) || []
}

function sentences(text) {
  return String(text || '').split(/(?<=[.!?。！？])\s*/).map(item => item.trim()).filter(Boolean)
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

function harvest(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const re = new RegExp(pattern.source, flags)
  const found = []
  for (const match of String(text || '').matchAll(re)) found.push(cleanText(match[0]))
  return unique(found)
}

function nameOf(token) {
  return token
}

function findPlaces(text, lex, language) {
  const folded = foldName(text)
  const places = []
  lex.places.forEach(([key, name, description]) => {
    if (!new RegExp(`(?:^|[^\\p{L}])${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded)) return
    if (places.some(place => foldName(place.name) === foldName(name))) return
    places.push({ name, description, confidence: 'high' })
  })
  namedVenues(text, language).forEach(venue => {
    if (places.some(place => foldName(place.name) === foldName(venue.name))) return
    places.push({ name: venue.name, description: venue.description, confidence: 'high' })
  })
  libraryHits(text, language).forEach(hit => {
    const right = foldName(hit.name)
    if (places.some(place => foldName(place.name) === right)) return
    if (places.some(place => {
      const left = foldName(place.name)
      return left && (right.startsWith(`${left} `) || right.endsWith(` ${left}`))
    })) return
    places.push({ name: hit.name, description: hit.name, confidence: hit.tag === 's' ? 'high' : hit.tag === 'unlisted' ? 'low' : 'medium', ...(hit.tag === 'unlisted' ? { unlisted: true } : {}) })
  })
  return places
}

function findCharacters(text, lex, places, language) {
  const reserved = new Set(places.flatMap(place => tokens(place.name).map(foldName)))
  lex.places.forEach(place => reserved.add(foldName(place[0])))
  const stop = new Set(lex.stop)
  const counts = new Map()
  const starts = new Set(sentences(text).map(sentence => foldName(tokens(sentence)[0] || '')))
  const words = [...String(text).matchAll(/[\p{L}][\p{L}'’-]+/gu)]
  for (let index = 0; index < words.length; index += 1) {
    const token = nameOf(words[index][0])
    if (!/^\p{Lu}/u.test(token)) continue
    if (isQuotedOrRemembered(text, words[index].index, language) || isFunctionWord(token, language) || isNumberWord(token, language) || isVenueType(token, language) || inNamedVenue(text, words[index].index, language)) continue
    const parts = [token]
    let cursor = index
    while (parts.length < 3 && cursor + 1 < words.length) {
      const gap = text.slice(words[cursor].index + words[cursor][0].length, words[cursor + 1].index)
      const next = words[cursor + 1][0]
      if (!/^\s+$/u.test(gap) || !/^\p{Lu}/u.test(next) || isFunctionWord(next, language) || isNumberWord(next, language)) break
      parts.push(next)
      cursor += 1
    }
    const name = parts.join(' ')
    const key = foldName(name)
    const introduced = new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])\\s*,\\s*(?:\\d|Anfang)`, 'iu').test(text)
    if (key.length < 2 || stop.has(key) || (reserved.has(key) && !introduced)) continue
    if (harvest(name, lex.outfit).length || harvest(name, lex.look).length) continue
    const entry = counts.get(key) || { forms: new Map(), count: 0, mid: 0 }
    entry.count += 1
    if (!starts.has(key)) entry.mid += 1
    entry.forms.set(name, (entry.forms.get(name) || 0) + 1)
    counts.set(key, entry)
    index = cursor
  }
  const characters = []
  const warnings = []
  for (const [key, entry] of counts) {
    const name = [...entry.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const window = traitWindow(text, name, [...counts.values()].map(item => [...item.forms.keys()][0]))
    const look = harvest(window, lex.look)
    const outfit = harvest(window, lex.outfit)
    const keep = entry.count >= 2 || look.length || outfit.length
    if (!keep) continue
    let confidence = 'high'
    if (!look.length || !outfit.length) confidence = 'low'
    else if (entry.count < 2) confidence = 'medium'
    if (!look.length) warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
    if (!outfit.length) warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    characters.push({ name, look: look.join(', '), outfit: outfit.join(', '), confidence })
  }
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const name = characters[index].name
    if (characters.some(item => item.name !== name && item.name.split(/\s+/).includes(name))) characters.splice(index, 1)
  }
  if (!characters.length) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  return { characters, warnings }
}

function traitWindow(text, name, names) {
  const boundary = label => new RegExp(`(?<![\\p{L}])${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
  const match = boundary(name).exec(text)
  if (!match) return ''
  const after = match.index + match[0].length
  let nextAt = Math.min(text.length, after + 180)
  names.forEach(other => {
    if (foldName(other) === foldName(name)) return
    const found = boundary(other).exec(text.slice(after))
    if (found) nextAt = Math.min(nextAt, after + found.index)
  })
  return text.slice(match.index, nextAt)
}

function findAmbience(text, lex) {
  let light = ''
  let mood = ''
  for (const [pattern, value] of lex.light) if (!light && pattern.test(text)) light = value
  for (const [pattern, value] of lex.mood) if (!mood && pattern.test(text)) mood = value
  return { light, mood, confidence: light || mood ? 'medium' : 'low' }
}

function nameInText(text, name) {
  const needle = foldName(name)
  if (!needle) return false
  if (tokens(text).some(token => foldName(token.replace(/^d'/i, '')) === needle)) return true
  return new RegExp(`(?<![\\p{L}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(foldName(text))
}

function whoFromPronoun(sentence, center) {
  const first = foldName(tokens(sentence)[0] || '')
  if (!/^(?:she|he|sie|er|ela|ele|lei|lui|ella)$/u.test(first)) return { who: '', flag: 'who_missing' }
  if (!center) return { who: '', flag: 'who_unresolved' }
  return { who: center, flag: 'who_pronoun' }
}

function findScenes(text, lex, characters, places, language) {
  const warnings = []
  const scenes = []
  let center = ''
  let lastWhere = ''
  let light = ''
  sentences(text).forEach(sentence => {
    if (/^[\p{Lu}][\p{L}'’-]+/u.test(sentence) && /(?:\d+\s*(?:Jahre|anni|anos|years)|cerca de\s+\d+|Anfang\s+\d+|poco più)/iu.test(sentence) && !/(?:^|[^\p{L}])(?:in|im|am|auf|bei|ins|zum|zur|dans|au|aux|nel|nella|nello|alla|al|sul|no|na|em|dentro|betritt|betrat|entra|entro|arriva|chega)\b/iu.test(sentence)) return
    const action = cleanText(sentence).replace(/[.!?。！？]+$/, '')
    const foundNames = characters.filter(character => nameInText(action, character.name))
    let who = ''
    let whoFlag = ''
    if (foundNames.length === 1) {
      who = foundNames[0].name
      center = who
    } else if (foundNames.length > 1) {
      who = foundNames.slice(0, 2).map(item => item.name).join(' and ')
      center = ''
    } else {
      const pronoun = whoFromPronoun(action, center)
      who = pronoun.who
      whoFlag = pronoun.flag
    }
    const records = places.map(place => ({
      name: place.name,
      keys: lex.places.filter(([, name]) => name === place.name).map(([key]) => key).concat(place.name),
      unlisted: place.unlisted === true
    }))
    const headed = locativeHeads(action, language).find(item => item.moves !== false && mentionMovesScene(action, item.index, language))
    const cue = headed
      ? { name: headed.name, key: headed.lemma, uncertain: false, unlisted: headed.tag === 'unlisted' }
      : findPlaceCue(action, language, records)
    const owned = cue && characters.some(item => foldName(item.name) === foldName(cue.name) || item.name.split(/\s+/).some(part => foldName(part) === foldName(cue.name)))
    const flags = []
    if (whoFlag) flags.push({ field: 'who', code: whoFlag })
    let where = lastWhere
    let whereFlag = where ? 'place_carried' : 'place_missing'
    if (cue?.name && !cue.uncertain && !owned) {
      where = cue.name
      whereFlag = cue.unlisted ? 'place_unlisted' : ''
    }
    if (whereFlag) flags.push({ field: 'where', code: whereFlag })
    if (where) lastWhere = where
    const nextLight = lightAfterCue(sentence, language, light)
    if (nextLight !== light) light = nextLight
    else if (light && !cueLight(sentence, language)) flags.push({ field: 'light', code: 'light_carried' })
    let confidence = foundNames.length && cue ? 'high' : 'medium'
    if (!where) {
      confidence = 'low'
      warnings.push({ code: 'missing_place', message: `No place found for scene ${scenes.length + 1}.`, target: 'scenes', index: scenes.length, options: places.map(place => place.name) })
    }
    if (!who) {
      confidence = 'low'
      warnings.push({ code: 'missing_character', message: `No character found for scene ${scenes.length + 1}.`, target: 'scenes', index: scenes.length, options: characters.map(character => character.name) })
    }
    scenes.push({ number: scenes.length + 1, who: who || '', where: where || '', what: action, source: action, flags, duration: 3, confidence, ...(light ? { light } : {}) })
  })
  return { scenes, warnings }
}

function overall(parts) {
  const values = parts.filter(Boolean)
  if (values.includes('low')) return 'low'
  if (values.includes('medium')) return 'medium'
  return values.length ? 'high' : 'low'
}

function unnamedPlace(language) {
  const table = {
    pt: ['O lugar', 'um lugar que o texto não nomeia'],
    it: ['Il luogo', 'un luogo che il testo non nomina'],
    ja: ['場所', '文が名を挙げない場所'],
  }
  const pair = table[language] || ['The setting', 'a place the text does not name']
  return { name: pair[0], description: pair[1], confidence: 'low', uncertain: true }
}

function pack(text, language, found) {
  const firstLight = found.scenes.scenes.find(scene => scene.light)?.light || ''
  if (firstLight) found.ambience.light = firstLight
  const warnings = [...found.characters.warnings, ...found.places.warnings || [], ...found.scenes.warnings]
  if (!found.places.length && found.characters.characters?.length && found.scenes.scenes?.length) {
    found.places.push(unnamedPlace(language))
    warnings.push({ code: 'uncertain_place', message: `No place name found. Using ${found.places.at(-1).name}.`, target: 'places', name: found.places.at(-1).name, uncertain: true })
  }
  const scenario = {
    characters: found.characters.characters.map(({ name, look, outfit }) => ({ name, look, outfit })),
    places: found.places.map(({ name, description, uncertain }) => ({ name, description, ...(uncertain ? { uncertain: true } : {}) })),
    light: found.ambience.light,
    mood: found.ambience.mood,
    scenes: found.scenes.scenes.map(({ number, who, where, what, duration, light, source, flags }) => ({ number, who, where, what, duration, ...(light ? { light } : {}), ...(source ? { source } : {}), ...(flags?.length ? { flags } : {}) }))
  }
  const canonical = scenarioToFields(scenario)
  const budget = scenarioBudget([canonical.characters, canonical.places, canonical.scenes].join('\n'), found.scenes.scenes.length * 3)
  const reliable = scenario.characters.length >= 2
    && scenario.characters.every(item => item.look && item.outfit)
    && scenario.places.length >= 2
    && scenario.scenes.length >= 4
  if (!reliable) warnings.push({ code: 'detection_uncertain', message: 'Automatic reading of this language is uncertain. Check the names, places, and actions.', target: 'idea' })
  return {
    input: 'prose',
    language,
    reliable,
    confidence: reliable ? overall([
      ...found.characters.characters.map(item => item.confidence),
      ...found.places.map(item => item.confidence),
      ...found.scenes.scenes.map(item => item.confidence),
      found.ambience.light || found.ambience.mood ? found.ambience.confidence : ''
    ]) : 'low',
    warnings,
    characters: found.characters.characters,
    places: found.places,
    light: found.ambience.light,
    mood: found.ambience.mood,
    scenes: found.scenes.scenes,
    scenario,
    premise: scenarioPremise(scenario),
    budget
  }
}

function detectSpaced(text, language) {
  const lex = LEX[language]
  if (!lex) {
    return pack(text, language, {
      characters: { characters: [], warnings: [{ code: 'detection_uncertain', message: 'Automatic reading of this language is uncertain. Check the names, places, and actions.', target: 'idea' }] },
      places: [],
      scenes: { scenes: [], warnings: [] },
      ambience: { light: '', mood: '', confidence: 'low' }
    })
  }
  const places = findPlaces(text, lex, language)
  const characters = findCharacters(text, lex, places, language)
  const nameTokens = new Set(characters.characters.flatMap(item => [foldName(item.name), ...String(item.name).split(/\s+/).map(foldName)]))
  const keptPlaces = places.filter(place => !nameTokens.has(foldName(place.name)))
  const ambience = findAmbience(text, lex)
  const scenes = findScenes(text, lex, characters.characters, keptPlaces, language)
  return pack(text, language, { characters, places: keptPlaces, scenes, ambience })
}

export function detectLocalized(text, language) {
  return detectSpaced(text, language)
}
