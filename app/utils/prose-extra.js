/** Rule-based prose detection for Portuguese. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { cueLight, findPlaceCue, inNamedVenue, isDescriptionSentence, isFunctionWord, isNumberWord, isQuotedOrRemembered, isVenueType, lightAfterCue, mentionMovesScene, namedVenues, subjectPlace } from './scene-split.js'
import { isNonPlaceNoun, isRejectedPlace, libraryHits, locativeHeads, movementPlace, tidyPlaceLemma } from './place-lexicon.js'

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
    light: [[/\b(amanhecer|aurora)\b/iu, 'dawn'], [/\b(noite|meia-noite|madrugada|luar|anoitecer|entardecer|crepúsculo|crepusculo)\b/iu, 'night'], [/\b(dia|manhã|tarde)\b/iu, 'day']],
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
    const names = [...counts.values()].flatMap(item => [...item.forms.keys()])
    const window = traitWindow(text, name, names)
    const traits = traitsFromWindow(window)
    const look = traits.looks
    const outfit = traits.outfits
    const keep = entry.count >= 2 || look.length || outfit.length
    if (!keep) continue
    let confidence = 'high'
    if (!look.length || !outfit.length) confidence = 'low'
    else if (entry.count < 2) confidence = 'medium'
    if (!look.length) warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
    if (!outfit.length) warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    characters.push({ name, look: look.join(', '), outfit: outfit.join(', '), confidence })
  }
  characters.forEach(person => {
    const found = identityTraits(text, person.name)
    const usable = bit => bit && !new RegExp(`^${person.name}\\b`, 'iu').test(bit) && !/\b(?:veste|vestem|carrega|carregam|wears?|carries|holds?)\b/iu.test(bit)
    const looks = String(person.look || '').split(/,\s*/).filter(usable)
    const outfits = String(person.outfit || '').split(/,\s*/).filter(usable)
    const messy = value => /^(?:de|do|da)\s/iu.test(value) || /\b(?:e|and)\s+(?:uma|um|a|an)\b/iu.test(value) || foldName(value) === foldName(person.name)
    const merge = (list, item) => {
      if (!item || foldName(item) === foldName(person.name) || TRAIT_VERB.test(item)) return
      const index = list.findIndex(bit => foldName(bit).includes(foldName(item)) || foldName(item).includes(foldName(bit)))
      if (index < 0) list.push(item)
      else if (messy(list[index]) || (item.length > list[index].length && foldName(item).includes(foldName(list[index])))) list[index] = item
    }
    found.looks.forEach(item => merge(looks, item))
    found.outfits.forEach(item => merge(outfits, item))
    person.look = looks.filter(bit => bit && foldName(bit) !== foldName(person.name)).join(', ')
    person.outfit = outfits.filter(bit => bit && foldName(bit) !== foldName(person.name)).join(', ')
    if (person.look || person.outfit) person.confidence = person.confidence === 'low' ? 'medium' : person.confidence
  })
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const name = characters[index].name
    if (characters.some(item => item.name !== name && item.name.split(/\s+/).includes(name))) characters.splice(index, 1)
  }
  if (!characters.length) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  return { characters, warnings }
}

function traitWindow(text, name, names) {
  const boundary = label => new RegExp(`(?<![\\p{L}])${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
  let best = ''
  for (const match of String(text || '').matchAll(boundary(name))) {
    const after = match.index + match[0].length
    let nextAt = text.length
    names.forEach(other => {
      if (foldName(other) === foldName(name)) return
      const found = boundary(other).exec(text.slice(after))
      if (found) nextAt = Math.min(nextAt, after + found.index)
    })
    const sentenceEnd = text.slice(match.index, nextAt).search(/[.!?。！？]/)
    let end = sentenceEnd >= 0 ? match.index + sentenceEnd : nextAt
    const following = text.slice(end).match(/^\s*[.!?。！？]\s+((?:Ela|Ele|Ela|Ele)\b[^.]*)/u)
    if (following && /(?:tem|veste|usa|traz|cabelo|casaco|anos|barba|olhos)\b/iu.test(following[1])) end += following[0].length
    const slice = text.slice(match.index, Math.min(end, nextAt))
    if (traitsFromWindow(slice).looks.length + traitsFromWindow(slice).outfits.length > traitsFromWindow(best).looks.length + traitsFromWindow(best).outfits.length) best = slice
  }
  return best
}

const PT_AGE = /^(?:cerca de\s+)?\d{1,3}(?:\s+anos)?$|^(?:nos seus\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?)|(?:vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)(?:\s+e\s+[\p{L}'’-]+)?(?:\s+anos)?$/iu
const PT_ROLE = /(?<![\p{L}])(pescadora|pescador|padeira|padeiro|professora|professor|cozinheira|cozinheiro|enfermeira|enfermeiro|agricultora|agricultor|marinheira|marinheiro|guarda|aprendiz|arquivista|aluna|aluno|estudante|pintora|pintor)(?![\p{L}])/iu
const PT_LOOK = /(?<![\p{L}])(cabelo|cabelos|barba|bigode|olhos|rosto|pele|coque|caracóis|caracois|tranças|trancas|franja|madeixas|binóculos|binoculos|óculos|oculos)(?![\p{L}])/iu
const PT_WEAR = /(?<![\p{L}])(casaco|avental|vestido|camisa|jaqueta|blusa|saia|calças|calcas|chapéu|chapeu|botas|lenço|lenco|xaile|uniforme|jardineira|jardineiras|luvas|luva|camisola|colete|macacão|macacao|pulôver|pullover|fato-macaco)(?![\p{L}])/iu
const PT_PROP = /(?<![\p{L}])((?:um|uma)\s+(?:apito|lanterna|chave|carta|bússola|bussola|martelo|câmara|camera|leque|flauta|pincel|caderno|mochila)|binóculos(?:\s+ao\s+pescoço)?|binoculos(?:\s+ao\s+pescoco)?|lanterna|apito|câmara|camera|leque|flauta|pincel|caderno|mochila|violino|giz)(?![\p{L}])/iu
const PT_DANGLING = /(?:\s+(?:de|do|da|dos|das|em|no|na|nos|nas|num|numa|com|por|para|ao|à|aos|às|pelo|pela|preso|presa|um|uma|o|a))+$/iu
const PT_FEMININE = new Map([
  ['pescador', 'pescadora'],
  ['padeiro', 'padeira'],
  ['professor', 'professora'],
  ['cozinheiro', 'cozinheira'],
  ['enfermeiro', 'enfermeira'],
  ['agricultor', 'agricultora'],
  ['marinheiro', 'marinheira']
])

function tidyPortuguese(value) {
  let bit = cleanText(value).replace(/^(?:é|e)\s+/iu, '')
  bit = bit.replace(/^(?:uma|um|o|a)\s+/iu, '')
  if (PT_DANGLING.test(bit)) bit = bit.replace(PT_DANGLING, '')
  return cleanText(bit)
}

function roleForm(role, window) {
  const feminine = PT_FEMININE.get(foldName(role))
  if (!feminine) return role
  if (new RegExp(`(?<![\\p{L}])${feminine}(?![\\p{L}])`, 'iu').test(window)) return feminine
  if (/(?<![\p{L}])ela(?![\p{L}])/iu.test(window)) return feminine
  return role
}

function traitsFromWindow(window) {
  const looks = []
  const outfits = []
  const source = String(window || '')
  source.split(/[,;]/).forEach(part => {
    const raw = cleanText(part)
    if (!raw || /(?<![\p{L}])(?:encontra|entra|abre|espera|caminha|corre|sai|pega|lê|le|diz|entrega|observa|acende)(?![\p{L}])/iu.test(raw)) return
    const bit = tidyPortuguese(raw)
    if (!bit) return
    if (PT_AGE.test(bit) || PT_AGE.test(raw)) {
      const age = bit.match(/\d{1,3}\s+anos|\d{1,3}|nos seus\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?|(?:vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)(?:\s+e\s+[\p{L}'’-]+)?(?:\s+anos)?/iu)
      if (age) looks.push(cleanText(age[0]))
    }
    const role = raw.match(PT_ROLE)
    if (role) looks.push(roleForm(role[1], source))
    if (PT_LOOK.test(bit)) looks.push(bit)
    if (PT_WEAR.test(bit)) outfits.push(bit)
    else if (PT_PROP.test(bit) || PT_PROP.test(raw)) outfits.push(bit)
  })
  return { looks: unique(looks), outfits: unique(outfits) }
}

const AGE_BIT = /(?:\b(?:cerca de|com|de|tem|têm|has|is|aged)\s+)?(?:\b(?:early|mid|late)\s+)?(?:\d{1,3}\s+(?:anos|years old|years)|\b(?:doze|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s*-\s*[\p{L}]+|\s+e\s+[\p{L}]+)?(?:\s+(?:anos|years old|years))?|\b\d{1,2}s\b)/giu
const HAIR_BIT = /(?<![\p{L}])(?:(?:short|long|curly|wavy|straight|auburn|copper|brown|black|blonde|blond|gray|grey|salt|frozen|white|silver|red|dark|fine|thin|castanh[oa]s?|grisalh[oa]|pret[oa]|ruiv[oa]|loir[oa]s?)\s+){1,3}(?:hair|braids?|beard|cabelo|caracóis|caracois|tranças|trancas|barba|coque|bun|curls|locs|franja|madeixas)|(?<![\p{L}])(?:tranças|trancas|cabelo|caracóis|caracois|barba|braids?|coque|curls|franja|madeixas)\s+[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2}/giu
const GARMENT_BIT = /(?<![\p{L}])(?:[\p{L}'’-]+\s+){0,3}(?:cardigan|waistcoat|jumper|pullover|overalls|dungarees|gloves|colete|vestido|casaco|jaqueta|blusa|saia|calças|calcas|camisa|apron|coat|jacket|dress|shirt|sweater|peacoat|cloak|robe|uniform|skirt|blouse|trousers|pants|hat|cap|scarf|avental|jardineira|luvas|camisola|macacão|macacao)(?:\s+(?:de|do|da|of|[\p{L}'’-]+)){0,3}/giu
const ITEM_BIT = /(?<![\p{L}])(?:uma|um|a|an)(?![\p{L}])\s+((?:[\p{L}'’-]+\s+){0,2}(?:mochila|backpack|rucksack|locket|whistle|apito|key|chave|compass|bússola|bussola|lanterna|câmara|camera|leque|fan|binóculos|binoculos|punch|radio|flauta|flute|pincel|brush|caderno|notebook|violino)(?:\s+(?:de|do|da|of)\s+[\p{L}'’-]+|\s+[\p{L}'’-]+){0,2})/giu
const BARE_ITEM = /(?<![\p{L}])((?:[\p{L}'’-]+\s+){0,2}(?:flauta|flute|pincel|brush|caderno|notebook|mochila|backpack|lanterna|apito|whistle|bússola|bussola|leque|fan|violino|giz|binóculos|binoculos)(?:\s+(?:de|do|da|of)\s+[\p{L}'’-]+|\s+[\p{L}'’-]+){0,2})(?![\p{L}])/giu
const ROLE_BIT = /(?:^|[^\p{L}])(?:é|e|is)\s+(?:um|uma|a|an|the|o|a)?\s*(aprendiz|arquivista|archivist|apprentice|pescadora|pescador|aluna|aluno|estudante|student|guarda|padeira|padeiro|professora|professor)/giu
const BARE_ROLE = /(?<![\p{L}])(aprendiz|arquivista|archivist|apprentice|aluna|aluno|estudante|student)(?![\p{L}])/giu
const TRAIT_VERB = /(?<![\p{L}])(?:fecha|abre|espera|pinta|pousa|rega|acena|corre|caminha|levanta|larga|apanha|pega|lifts?|sets?|puts?|opens?|closes?|waits?|walks?|waves?|sits?|reads?|checks?|holds?|carries|carrega|veste|calls?|chama|nada)(?![\p{L}])/iu
const WEAR_LEAD = /(?:veste|vestem|usa|usam|wears?|wore)\s+(?:um|uma|uns|umas|a|an|the|o|de\s+)?([^.,;]+)/giu
const CARRY_LEAD = /(?:carrega|carregam|leva|levam|traz|carries|carrying|holds?|holding)\s+(?:um|uma|a|an|the|o)?\s*([^.,;]+)/giu

function tidyAttribute(value) {
  let bit = cleanText(value).replace(/[.,;]+$/g, '')
  bit = bit.replace(/^(?:in|at|on|inside|into|em|no|na|nos|nas|dans|sur|ao|à)\s+/iu, '')
  bit = bit.replace(/^(?:wears?|wore|veste|vestem|usa|usam|carrega|carregam|leva|levam|traz|carries|carrying|holds?|holding|has|have|tem|têm)\s+/iu, '')
  let previous = ''
  while (bit !== previous) {
    previous = bit
    bit = bit.replace(/^(?:é|e|is|de|do|da|um|uma|uns|umas|a|an|the|o|os|as)\s+/iu, '')
  }
  bit = bit.split(/\s+(?<![\p{L}])(?:e|and)(?![\p{L}])\s+/iu)[0]
  bit = bit.split(/\s+(?<![\p{L}])(?:in|at|on|inside|into|onto|down|up|to|toward|towards|em|no|na|nos|nas|dans|sur|ao|à|até|ate|para)(?![\p{L}])\s+/iu)[0]
  const words = []
  for (const word of bit.split(/\s+/).filter(Boolean)) {
    if (words.length && (/^\p{Lu}/u.test(word) || /^(?:veste|vestem|wears?|wore|waits?|espera|abre|opens?|carrega|carregam|carries|holds?|holding|walks?|sits?)$/iu.test(word))) break
    words.push(word)
  }
  bit = words.join(' ')
  bit = bit.replace(/(?:\s+(?:de|do|da|dos|das|em|no|na|com|with|por|para|ao|à|pelo|pela|and|e))+$/iu, '')
  return cleanText(bit)
}

function pushUnique(list, value) {
  const bit = tidyAttribute(value)
  if (!bit || bit.length > 80 || bit.split(/\s+/).length > 8) return
  if (TRAIT_VERB.test(bit)) return
  const key = foldName(bit)
  const index = list.findIndex(item => {
    const have = foldName(item)
    return have === key || have.includes(key) || key.includes(have)
  })
  if (index >= 0) {
    const have = list[index]
    const verbier = TRAIT_VERB.test(bit) && !TRAIT_VERB.test(have)
    if (!verbier && bit.length > have.length && foldName(bit).includes(foldName(have))) list[index] = bit
    return
  }
  list.push(bit)
}

function identityWindow(text, name) {
  const source = String(text || '')
  const boundary = new RegExp(`(?<![\\p{L}])${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
  const chunks = []
  for (const match of source.matchAll(boundary)) {
    let slice = source.slice(match.index, Math.min(source.length, match.index + 220))
    const rest = slice.slice(match[0].length)
    const cut = rest.search(/\bmeets\s+\p{Lu}|\.\s+\p{Lu}/u)
    if (cut >= 0) slice = slice.slice(0, match[0].length + cut)
    chunks.push(slice)
  }
  return chunks.join(' ')
}

/** Age, hair, outfit, carried item, and role stated for this person. Both site languages. */
export function identityTraits(text, name) {
  const looks = []
  const outfits = []
  const source = identityWindow(text, name)
  if (!source) return { looks, outfits }
  for (const match of source.matchAll(new RegExp(AGE_BIT.source, 'giu'))) pushUnique(looks, match[0])
  for (const match of source.matchAll(new RegExp(HAIR_BIT.source, 'giu'))) pushUnique(looks, match[0])
  for (const match of source.matchAll(new RegExp(ROLE_BIT.source, 'giu'))) pushUnique(looks, match[1])
  for (const match of source.matchAll(new RegExp(BARE_ROLE.source, 'giu'))) pushUnique(looks, match[1])
  for (const match of source.matchAll(new RegExp(GARMENT_BIT.source, 'giu'))) pushUnique(outfits, match[0])
  for (const match of source.matchAll(new RegExp(ITEM_BIT.source, 'giu'))) pushUnique(outfits, match[1] || match[0])
  for (const match of source.matchAll(new RegExp(BARE_ITEM.source, 'giu'))) pushUnique(outfits, match[1] || match[0])
  for (const match of source.matchAll(new RegExp(WEAR_LEAD.source, 'giu'))) {
    String(match[1] || '').split(/\s+\b(?:e|and)\b\s+/i).forEach(part => {
      if (GARMENT_BIT.test(part) || /(?:vestido|casaco|coat|dress|cardigan|waistcoat|avental|apron|jaqueta|camisa)/iu.test(part)) pushUnique(outfits, part)
      GARMENT_BIT.lastIndex = 0
    })
  }
  for (const match of source.matchAll(new RegExp(CARRY_LEAD.source, 'giu'))) pushUnique(outfits, match[1])
  return { looks, outfits }
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
    const described = isDescriptionSentence(sentence) || (/^[\p{Lu}][\p{L}'’-]+/u.test(sentence) && /(?:\d+\s*(?:Jahre|anni|anos|years)|cerca de\s+\d+|Anfang\s+\d+|poco più)/iu.test(sentence) && !/(?:^|[^\p{L}])(?:in|im|am|auf|bei|ins|zum|zur|dans|au|aux|nel|nella|nello|alla|al|sul|no|na|em|dentro|betritt|betrat|entra|entro|arriva|chega|espera|abre|lê|le)\b/iu.test(sentence))
    if (described) {
      const headed = locativeHeads(sentence, language).find(item => item.moves !== false && !isNonPlaceNoun(item.lemma) && !isRejectedPlace(item.lemma) && mentionMovesScene(sentence, item.index, language))
      const subject = subjectPlace(sentence, language, places)
      const records = places.map(place => ({
        name: place.name,
        keys: lex.places.filter(([, name]) => name === place.name).map(([key]) => key).concat(place.name),
        unlisted: place.unlisted === true
      }))
      const cue = headed
        ? { name: tidyPlaceLemma(headed.name), uncertain: false }
        : findPlaceCue(sentence, language, records)
      const named = cue?.name && !cue.uncertain && !isRejectedPlace(cue.name) ? tidyPlaceLemma(cue.name) : ''
      if (named) lastWhere = named
      else if (subject && cueLight(sentence, language)) lastWhere = subject
      const nextLight = lightAfterCue(sentence, language, light)
      if (nextLight) light = nextLight
      return
    }
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
    const headed = locativeHeads(action, language).find(item => item.moves !== false && !isNonPlaceNoun(item.lemma) && !isRejectedPlace(item.lemma) && mentionMovesScene(action, item.index, language))
    const cue = headed
      ? { name: tidyPlaceLemma(headed.name), key: tidyPlaceLemma(headed.lemma), uncertain: false, unlisted: headed.tag === 'unlisted' }
      : findPlaceCue(action, language, records)
    const owned = cue && characters.some(item => foldName(item.name) === foldName(cue.name) || item.name.split(/\s+/).some(part => foldName(part) === foldName(cue.name)))
    const flags = []
    if (whoFlag) flags.push({ field: 'who', code: whoFlag })
    let where = lastWhere
    let whereFlag = where ? 'place_carried' : 'place_missing'
    const cued = cue?.name ? tidyPlaceLemma(cue.name) : ''
    if (cued && !cue.uncertain && !owned && !isNonPlaceNoun(cued) && !isRejectedPlace(cued)) {
      where = cued
      whereFlag = cue.unlisted ? 'place_unlisted' : ''
    }
    if (foldName(where) === foldName(lastWhere)) {
      const moved = movementPlace(action, language)
      const at = moved ? action.toLowerCase().indexOf(moved.toLowerCase()) : -1
      const subject = subjectPlace(action, language, places)
      const reached = moved && !isRejectedPlace(moved) && (at < 0 || mentionMovesScene(action, at, language)) ? moved : ''
      const named = reached || (subject && !isRejectedPlace(subject) ? subject : '')
      if (named && foldName(named) !== foldName(where)) {
        where = named
        whereFlag = ''
      }
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
