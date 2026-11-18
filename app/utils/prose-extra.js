/** Rule-based prose detection for Portuguese. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { cueLight, findPlaceCue, inNamedVenue, interactionPossessive, isDescriptionSentence, isFunctionWord, isNumberWord, isQuotedOrRemembered, isVenueType, isWardrobeSentence, lightAfterCue, mentionMovesScene, namedVenues, opensParagraph, sentenceHasTimeCue, subjectPlace, trailingActionClause } from './scene-split.js'
import { aircraftPlace, enteredPlace, finishCarriedPlace, inspectedPlace, isNonPlaceNoun, isRejectedPlace, libraryHits, locativeHeads, movementPlace, possessivePlace, preferPlaceHead, settingName, tidyPlaceLemma } from './place-lexicon.js'

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
  const masked = String(text || '').replace(/(^|[\s])((?:Dr|Mr|Mrs|Ms|Prof|St|Sr|Sra|Dra))\./gu, '$1$2∯')
  return masked.split(/(?<=[.!?。！？])\s*/).map(item => item.replace(/∯/g, '.').trim()).filter(Boolean)
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
    if (!right || places.some(place => foldName(place.name) === right)) return
    const shorter = places.find(place => {
      const left = foldName(place.name)
      return left && (right.startsWith(`${left} `) || right.endsWith(` ${left}`))
    })
    if (shorter) {
      shorter.name = hit.name
      if (!shorter.description || foldName(shorter.description) === foldName(shorter.name)) shorter.description = hit.name
      return
    }
    if (places.some(place => {
      const left = foldName(place.name)
      return left.startsWith(`${right} `) || left.endsWith(` ${right}`)
    })) return
    places.push({ name: hit.name, description: hit.name, confidence: hit.tag === 's' ? 'high' : hit.tag === 'unlisted' ? 'low' : 'medium', ...(hit.tag === 'unlisted' ? { unlisted: true } : {}) })
  })
  const props = wornPropKeys(text)
  return places.filter(place => !isLookPropPlace(place.name, props))
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
    if (/^(?:dr|mr|mrs|ms|prof|sr|sra|dra|st|x-ray|xray)$/i.test(foldName(token))) continue
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
    const titled = /^(?:dona|dom|senhor|senhora|sr|sra)\b/iu.test(name)
    const keep = entry.count >= 2 || look.length || outfit.length || titled
    if (!keep) continue
    let confidence = 'high'
    if (!look.length || !outfit.length) confidence = 'low'
    else if (entry.count < 2) confidence = 'medium'
    if (!look.length) warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
    if (!outfit.length) warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    characters.push({ name, look: look.join(', '), outfit: outfit.join(', '), confidence })
  }
  characters.forEach(person => {
    const found = identityTraits(text, person.name, characters.map(item => item.name))
    const usable = bit => {
      const clean = keptTrait(bit)
      return clean && !new RegExp(`^${person.name}\\b`, 'iu').test(clean) && !TRAIT_VERB.test(clean) && !ACTION_CLAUSE.test(clean)
    }
    const looks = String(person.look || '').split(/,\s*/).filter(usable)
    const outfits = String(person.outfit || '').split(/,\s*/).filter(bit => keptTrait(bit))
    const messy = value => /^(?:de|do|da)\s/iu.test(value) || /\b(?:e|and)\s+(?:uma|um|a|an)\b/iu.test(value) || foldName(value) === foldName(person.name)
    const merge = (list, item, field) => {
      const clean = keptTrait(item, field)
      if (!clean || foldName(clean) === foldName(person.name) || TRAIT_VERB.test(clean)) return
      item = clean
      const index = list.findIndex(bit => foldName(bit).includes(foldName(item)) || foldName(item).includes(foldName(bit)))
      if (index < 0) list.push(item)
      else if (messy(list[index]) || (item.length > list[index].length && foldName(item).includes(foldName(list[index])))) list[index] = item
    }
    found.looks.forEach(item => merge(looks, item, ''))
    found.outfits.forEach(item => merge(outfits, item, ''))
    person.look = looks.filter(bit => bit && foldName(bit) !== foldName(person.name)).join(', ')
    person.outfit = outfits.filter(bit => bit && foldName(bit) !== foldName(person.name)).join(', ')
    if (person.look || person.outfit) person.confidence = person.confidence === 'low' ? 'medium' : person.confidence
  })
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const name = characters[index].name
    if (characters.some(item => item.name !== name && item.name.split(/\s+/).includes(name))) characters.splice(index, 1)
  }
  if (!characters.length) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  return { characters, warnings: dropResolvedLookWarnings(characters, warnings) }
}

function nameIsPossessive(text, index) {
  return /(?<![\p{L}])(?:de|do|da|dos|das|of)\s+$/iu.test(String(text || '').slice(Math.max(0, index - 16), index))
}

function traitWindow(text, name, names) {
  const boundary = label => new RegExp(`(?<![\\p{L}])${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
  let best = ''
  for (const match of String(text || '').matchAll(boundary(name))) {
    if (nameIsPossessive(text, match.index)) continue
    const after = match.index + match[0].length
    let nextAt = text.length
    names.forEach(other => {
      if (foldName(other) === foldName(name)) return
      const found = boundary(other).exec(text.slice(after))
      if (!found || nameIsPossessive(text, after + found.index)) return
      nextAt = Math.min(nextAt, after + found.index)
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

const PT_UNIT = 'um|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove'
const PT_TEEN = 'dez|onze|doze|treze|catorze|quatorze|quinze|dezasseis|dezesseis|dezassete|dezessete|dezoito|dezanove|dezenove'
const PT_TEN = 'vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa'
const PT_AGE = new RegExp(`^(?:cerca de\\s+)?(?:tem\\s+|têm\\s+)?(?:\\d{1,3}|${PT_TEEN}|${PT_TEN}(?:\\s+e\\s+(?:${PT_UNIT}))?)(?:\\s+anos)?$|^(?:nos seus\\s+[\\p{L}'’-]+(?:\\s+[\\p{L}'’-]+)?)`, 'iu')
const PT_ROLE = /(?<![\p{L}])(pescadora|pescador|padeira|padeiro|professora|professor|cozinheira|cozinheiro|enfermeira|enfermeiro|agricultora|agricultor|marinheira|marinheiro|guarda|aprendiz|arquivista|aluna|aluno|estudante|pintora|pintor)(?![\p{L}])/iu
const PT_LOOK = /(?<![\p{L}])(cabelo|cabelos|barba|bigode|olhos|rosto|pele|coque|caracóis|caracois|tranças|trancas|franja|madeixas|binóculos|binoculos|óculos|oculos|careca|calvo|calva|bald|rastas|dreadlocks|dreads)(?![\p{L}])/iu
const PT_WEAR = /(?<![\p{L}])(impermeável|impermeavel|gabardina|capa|casaco|avental|vestido|camiseta|camisetas|camisa|t-shirt|jaqueta|blusa|saia|calças|calcas|chapéu|chapeu|boné|bonés|botas|lenço|lenco|xaile|uniforme|jardineira|jardineiras|luvas|luva|camisola|colete|macacão|macacao|pulôver|pullover|fato-macaco|fato|farda|tailleur|batina|bata|batas|pérolas|perolas)(?![\p{L}])/iu
const PT_PROP = /(?<![\p{L}])((?:um|uma|uns|umas)\s+(?:apito|lanterna|chave|carta|bússola|bussola|martelo|câmara|camera|leque|flauta|pincel|caderno|cadernos|mochila|prancha|facão|facao|machado|microfone|estetoscópio|estetoscopio|anel|conchas|concha|terço|terco|colar|colares)|binóculos(?:\s+ao\s+pescoço)?|binoculos(?:\s+ao\s+pescoco)?|lanterna|apito|câmara|camera|leque|flauta|pincel|caderno|cadernos|mochila|violino|giz|prancha|facão|facao|conchas|concha|microfone|terço|terco|colar|colares)(?![\p{L}])/iu
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
  bit = bit.replace(/^(?:de|do|da|dos|das|of)\s+/iu, '')
  bit = bit.replace(/^(?:uma|um|uns|umas|o|a)\s+/iu, '')
  bit = bit.replace(/(?:\s+(?:um|uma|uns|umas))+$/iu, '')
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
  source.split(/[,;]/).flatMap(part => {
    const raw = cleanText(part)
    const pieces = raw.split(/\s+\b(?:e|and)\b\s+/iu).map(piece => piece.trim()).filter(Boolean)
    if (pieces.length === 2 && /^(?:vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/iu.test(pieces[0]) && /^(?:um|dois|duas|três|tres|one|two|three)\b/iu.test(pieces[1])) return [raw]
    return pieces.length ? pieces : [raw]
  }).forEach(part => {
    const raw = cleanText(part)
    if (!raw || /(?<![\p{L}])(?:encontra|entra|abre|espera|caminha|corre|sai|pega|lê|le|diz|entrega|observa|acende)(?![\p{L}])/iu.test(raw)) return
    const bit = tidyPortuguese(raw)
    if (!bit || ACTION_CLAUSE.test(raw) || ACTION_CLAUSE.test(bit)) return
    const aged = PT_AGE.test(bit) || PT_AGE.test(raw)
    if (aged) {
      const age = bit.match(PT_AGE) || raw.match(PT_AGE)
      if (age) looks.push(cleanText(age[0]).replace(/^(?:tem|têm)\s+/iu, ''))
    }
    const role = raw.match(PT_ROLE)
    if (role) looks.push(roleForm(role[1], source))
    const looked = PT_LOOK.test(bit)
    if (looked) looks.push(tidyAttribute(bit, 'hair'))
    const garmentHits = [...bit.matchAll(new RegExp(GARMENT_BIT.source, 'giu'))]
    garmentHits.forEach(match => {
      const piece = String(match[0] || '').split(/\s+\b(?:e|and)\b\s+/iu).pop()
      const clean = keptTrait(piece, 'outfit')
      if (clean) outfits.push(clean)
    })
    for (const match of `${bit} ${raw}`.matchAll(new RegExp(ITEM_BIT.source, 'giu'))) {
      const clean = keptTrait(match[1] || match[0], 'items')
      if (clean) outfits.push(clean)
    }
    if (!garmentHits.length && (PT_PROP.test(bit) || PT_PROP.test(raw))) outfits.push(tidyAttribute(bit))
    else if (!aged && !role && !looked && bit.split(/\s+/).length <= 5 && !/^(?:no|na|em|ao|à)\b/iu.test(bit) && !ACTION_CLAUSE.test(bit) && !verbPhrase(bit) && !/^\p{Lu}/u.test(bit)) {
      const clean = keptTrait(bit, 'outfit')
      if (clean) outfits.push(clean)
    }
  })
  return { looks: unique(looks), outfits: unique(outfits) }
}

const EN_UNIT = 'one|two|three|four|five|six|seven|eight|nine'
const EN_TEN = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety'
const AGE_DECADE = 'twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties'
const AGE_WORD = `${PT_UNIT}|${PT_TEEN}|${PT_TEN}|doze|${EN_TEN}|twelve|${EN_UNIT}`
const AGE_BIT = new RegExp(`(?<![\\p{L}])(?:(?:in\\s+(?:his|her|their)\\s+)?)(?:(?:early|mid|late|nos\\s+seus)\\s+)?(?:(?:${EN_TEN})(?:-(?:${EN_UNIT}))?[ -]year-old|(?:${AGE_DECADE})|(?:\\d{1,3}\\s+(?:anos|years old|years))|(?:${PT_TEN})(?:\\s+e\\s+(?:${PT_UNIT}))?(?:\\s+anos)?|(?:${PT_TEEN}|doze)(?:\\s+anos)?|(?:${EN_TEN})(?:-(?:${EN_UNIT}))?(?!-year)(?:\\s+(?:years old|years))?|\\d{1,2}s\\b)`, 'giu')
const YEAR_OLD = new RegExp(`(?<![\\p{L}])((?:\\d{1,3}|(?:${EN_TEN})(?:-(?:${EN_UNIT}))?)[ -]year-old)(?![\\p{L}])`, 'giu')
const STATED_AGE = new RegExp(`(?<![\\p{L}])(?:is|tem|têm|aged)\\s+(\\d{1,3}|${PT_TEEN}|${PT_TEN}(?:\\s+e\\s+(?:${PT_UNIT}))?)(?!\\d)(?!\\s*s\\b)`, 'giu')
const LISTED_AGE = /,\s*(\d{1,3})(?!\d)(?!\s*(?:anos|years|s\b|h\b|am\b|pm\b))/giu
const HAIR_STYLE = 'até\\s+(?:os|as|à|a|o)\\s+[\\p{L}\'’-]+|em\\s+(?:tranças|trancas|caracóis|caracois|coque|franja)|dos\\s+lados|da\\s+frente|nas\\s+costas|compridas|curtas|rapado(?:\\s+dos\\s+lados)?'
const HAIR_BIT = new RegExp(`(?<![\\p{L}])(?:slicked-back\\s+)?(?:(?:short|long|curly|wavy|straight|auburn|copper|brown|black|blonde|blond|gray|grey|salt|frozen|white|silver|red|dark|fine|thin|castanh[oa]s?|grisalh[oa]|pret[oa]|ruiv[oa]|loir[oa]s?)\\s+){1,3}(?:hair|braids?|beard|cabelo|caracóis|caracois|tranças|trancas|barba|coque|bun|curls|locs|rastas|dreadlocks|dreads|franja|madeixas|sideburns)(?:\\s+(?:${HAIR_STYLE}))?|(?<![\\p{L}])(?:tranças|trancas|cabelo|caracóis|caracois|barba|braids?|beard|coque|curls|franja|madeixas|sideburns|rastas|dreadlocks|dreads)(?:\\s+[\\p{L}'’-]+(?:\\s+(?:${HAIR_STYLE}|[\\p{L}'’-]+)){0,4})?`, 'giu')
const MARK_BIT = /(?<![\p{L}])((?:red|white|round|rubber)\s+nose|(?:nariz)(?:\s+vermelho|\s+de\s+palhaço|\s+de\s+palhaco)?)(?![\p{L}])/giu
const GARMENT_WORD = 't-shirt|tee-shirt|sweatshirt|raincoat|peacoat|overcoat|waistcoat|cardigan|blazer|anorak|parka|hoodie|jumper|pullover|overalls|dungarees|impermeável|impermeavel|gabardina|casaco|jaqueta|camisola|camiseta|camisetas|colete|vestido|camisa|blusa|saia|calças|calcas|avental|jardineira|macacão|macacao|farda|fato-macaco|fato|capa|cape|cloak|robe|uniform|apron|coat|jacket|dress|shirt|sweater|skirt|blouse|trousers|pants|scarf|gloves|luvas|goggles|óculos|oculos|hat|cap|boné|bonés|boots|botas|suit|cachecol|cachecóis|cachecois|chapéu|chapeu|lenço|lenco|xaile|xale|shawl|tailleur|batina|bata|batas|pérolas|perolas|pearls'
const GARMENT_BIT = new RegExp(`(?<![\\p{L}])((?:[\\p{L}'’-]+\\s+){0,3}(?:${GARMENT_WORD}))(?![\\p{L}])(?:\\s+(?!e\\b|and\\b|com\\b|with\\b|e\\b)(?:de|do|da|dos|das|of|[\\p{L}'’-]+)){0,3}`, 'giu')
const ITEM_WORD = 'mochila|backpack|rucksack|locket|whistle|apito|key|chave|compass|bússola|bussola|lanterna|câmara|camera|leque|fan|binóculos|binoculos|punch|radio|flauta|flute|pincel|brush|caderno|cadernos|notebook|violino|axe|machado|picareta|cane|bengala|goggles|facão|facao|machete|prancha|surfboard|conchas|concha|shells|shell|microphone|microfone|stethoscope|estetoscópio|estetoscopio|anel|ring|rings|nariz|nose|lápis|lapis|pencil|pencils|argola|argolas|brinco|brincos|earring|earrings|cachimbo|cachimbos|pipe|pipes|colar|colares|necklace|necklaces|terço|terco|rosary|rosaries'
const ITEM_TAIL = '(?:\\s+(?:de|do|da|of)\\s+[\\p{L}\'’-]+|\\s+(?!e\\b|and\\b|um\\b|uma\\b|com\\b|with\\b|back\\b|to\\b|para\\b|for\\b|up\\b|down\\b|off\\b|a\\b|the\\b|his\\b|her\\b|their\\b|under\\b|over\\b|beneath\\b|behind\\b|from\\b|in\\b|at\\b|on\\b|into\\b|onto\\b)[\\p{L}\'’-]+)'
const ITEM_PREFIX = '(?:(?!e\\b|and\\b|com\\b|with\\b|ou\\b|or\\b|shows?\\b|holds?\\b|holding\\b|segura\\b|seguram\\b|mostra\\b|mostram\\b|the\\b|an\\b|a\\b|o\\b|os\\b|as\\b|um\\b|uma\\b)[\\p{L}\'’-]+\\s+){0,2}'
const ITEM_BIT = new RegExp(`(?<![\\p{L}])(?:uma|um|uns|umas|an|a)(?![\\p{L}])\\s+(${ITEM_PREFIX}(?:${ITEM_WORD})(?![\\p{L}])${ITEM_TAIL}{0,2})`, 'giu')
const BARE_ITEM = new RegExp(`(?<![\\p{L}])(${ITEM_PREFIX}(?:${ITEM_WORD})(?![\\p{L}])${ITEM_TAIL}{0,2})`, 'giu')
const BALD_BIT = /(?<![\p{L}])(careca|calvo|calva|bald)(?![\p{L}])/giu
const ROLE_BIT = /(?:^|[^\p{L}])(?:é|e|is)\s+(?:um|uma|a|an|the|o|a)?\s*(aprendiz|arquivista|archivist|apprentice|pescadora|pescador|aluna|aluno|estudante|student|guarda|padeira|padeiro|professora|professor)/giu
const BARE_ROLE = /(?<![\p{L}])(aprendiz|arquivista|archivist|apprentice|aluna|aluno|estudante|student)(?![\p{L}])/giu
const TRAIT_VERB = /(?<![\p{L}])(?:fecha|abre|espera|pinta|pousa|rega|acena|corre|caminha|levanta|larga|apanha|pega|lifts?|sets?|puts?|opens?|closes?|waits?|walks?|waves?|sits?|reads?|checks?|holds?|carries|carrega|veste|calls?|chama|nada|lava|lavam|yawns?|boceja|tira|tiram|despe|pulls?|takes?)(?![\p{L}])/iu
const ACTION_CLAUSE = /(?<![\p{L}])(?:lava|lavam|washes|wash|yawns?|yawned|boceja|bocejam|apanha|apanham|practises?|practices?|ensaia|encena|tira|tiram|despe|despem|takes?\s+off|puts?\s+on|pulls?|puxa|puxam|walks?|runs?|sits?|stands?|smiles?|waves?|writes?|pushes?|finds?|find|blows?|blow|searches|search)(?![\p{L}])/iu
const WEAR_LEAD = /(?<![\p{L}])(?:pulls?\s+on|puts?\s+on|zips(?:\s+into)?|veste|vestem|usa|usam|calça|calca|wears?|wore)(?![\p{L}])\s+(?:uma|um|uns|umas|an|a|the|her|his|o|a|de\s+)?([^.,;]+)/giu
const CARRY_LEAD = /(?<![\p{L}])(?:carrega|carregam|leva|levam|traz|segura|seguram|keeps?|holds?|holding|carries|carrying)(?![\p{L}])\s+(?:uma|um|uns|umas|an|a|the|her|his|o|a|seu|sua)?\s*([^.,;]+)/giu
const ACTION_HOLD = /(?:both hands|duas mãos|duas maos|ambas as mãos|ambas as maos)/iu
const VERB_WORD = /(?<![\p{L}])(?:encer\w*|testa|testam|cai(?:r|ndo|ram)?|caem|entrega\w*|assin\w*|surf(?:a|am|ou|ando|aram|ava|avam|ar|ei|em|e)\b|rings|irons|drops|laces|lace|wraps|wrapped|wrapping|lights|lit|crawls|crawled|crawling|toca|tocam|acende|acendem|senta|abre|abrem|fecha|fecham|lava|lavam|walks|walked|runs|picks|picked|returns|returned|devolve|devolvem|gives|hands|wears|wore|holds|carries|carrega|carregam|veste|vestem|usa|usam|pulls|puts|takes|opens|closes|waits|sits|stands|smiles|waves|writes|pushes|nods|checks|loses|lose|hangs|hang|will|perde|perdem|deixam|deixa|mostra|mostram|shows|show|segura|seguram|traz|trazem|finds|find|blows|blow|searches|search)(?![\p{L}])/iu
const WEAR_CUE = /(?<![\p{L}])(?:wears?|wore|veste|vestem|usa|usam|puts?\s+on|carrega|carregam|carries|carrying|holds?|holding)(?![\p{L}])/iu
const SALVAGE_NOUN = new RegExp(`(?<![\\p{L}])(${ITEM_WORD}|bell|sino|cesto|cestos|basket|baskets|lantern)(?![\\p{L}])`, 'giu')

function verbPhrase(text) {
  return VERB_WORD.test(String(text || ''))
}

function garmentText(value) {
  return new RegExp(`(?:${GARMENT_WORD}|tailleur|pérolas|perolas|pearls|goggles)`, 'iu').test(value)
}

/** A sheet or lock clause. Verb phrases are dropped. A phrase with no verb is kept as written. */
export function keptTrait(value, field = '') {
  const raw = cleanText(String(value || '').split(/\n/)[0]).replace(/[.,;]+$/g, '')
  if (!raw || /^(?:to|para|for)\s+/iu.test(raw) || /\b(?:to|para)\s+\p{Lu}/u.test(raw)) return ''
  if (/(?:de\s+fato|in\s+fact)/iu.test(raw) && !WEAR_CUE.test(raw)) return ''
  if (!verbPhrase(raw)) {
    const posed = raw.replace(/^(?:um|uma|uns|umas)\s+/iu, '').replace(/\s+(?:down|up|off|baixo)$/iu, '').replace(/\s+(?:com|with)\s+(?:uma\s+|um\s+|a\s+|an\s+|the\s+)?(?:só\s+|so\s+)?(?:mão|mãos|maos|hand|hands)$/iu, '').replace(/\s+(?:com|with)\s+(?:uma|um|a|an|the)$/iu, '')
    const bit = posed || raw
    if (field === 'outfit' && !garmentText(bit)) return ''
    if (field === 'items' && /^(?:onda|wave|mão|mao|hand|hands)$/iu.test(bit)) return ''
    return bit
  }
  if (!WEAR_CUE.test(raw) && !/(?:pulls?|puxa|puxam)/iu.test(raw)) {
    const noun = itemNoun(tidyAttribute(raw))
    if (noun && !verbPhrase(noun) && new RegExp(`(?:${ITEM_WORD})`, 'iu').test(noun)) {
      if (field === 'outfit' && !garmentText(noun)) return ''
      return noun
    }
    if (garmentText(raw) && !/^(?:[\p{Lu}][\p{L}'’-]+\s+)?(?:wears?|wore|veste|vestem|usa|usam|puts?|takes?|tira|tiram|despe|despem|surfa|surfam|surfou)\b/iu.test(raw)) {
      const worn = tidyAttribute(raw)
      if (worn && garmentText(worn) && !verbPhrase(worn) && !/\b(?:e|and)\b/iu.test(worn)) return worn
    }
    return ''
  }
  let bit = tidyAttribute(raw).replace(/\s+(?:com|with)\s+.+$/iu, '').replace(/\s+(?:down|up|off|baixo)$/iu, '')
  if (!bit || verbPhrase(bit)) return ''
  if (field === 'outfit' && !garmentText(bit)) return ''
  return bit
}

function salvagedNouns(text) {
  const found = []
  const source = String(text || '')
  for (const match of source.matchAll(new RegExp(SALVAGE_NOUN.source, 'giu'))) {
    if (/^(?:rings?)$/iu.test(match[1])) continue
    let clause = source.slice(Math.max(0, match.index - 48), match.index + match[0].length)
    const breakAt = Math.max(clause.lastIndexOf('.'), clause.lastIndexOf('!'), clause.lastIndexOf('?'))
    if (breakAt >= 0) clause = clause.slice(breakAt + 1)
    if (!verbPhrase(clause) || WEAR_CUE.test(clause) || /(?:de\s+fato|in\s+fact)/iu.test(clause)) continue
    const noun = tidyAttribute(match[1])
    if (noun && !verbPhrase(noun)) found.push(noun)
  }
  return unique(found)
}
const COLOR_LEAD = /^(?:black|brown|blonde|blond|red|ginger|auburn|silver|white|grey|gray|blue|green|pink|purple|navy|charcoal|oatmeal|rust|gold|amber|ash|olive|plum|russet|saffron|indigo|wool|linen|velvet|silk|leather|yellow|copper|preto|preta|pretos|pretas|azul|verde|vermelho|vermelha|amarelo|amarela|cinzento|cinzenta|castanho|castanha|grisalho|grisalha|lã|la|couro|linho|veludo|curto|curta|comprido|comprida|liso|lisa)$/iu

function tidyAttribute(value, kind = '') {
  let bit = cleanText(value).replace(/[.,;]+$/g, '')
  bit = bit.replace(/^(?:in|at|on|inside|into|beside|near|by|em|no|na|nos|nas|dans|sur|ao|à)\s+/iu, '')
  let previous = ''
  while (bit !== previous) {
    previous = bit
    bit = bit.replace(/^(?:off|out|away|without|wears?|wore|wearing|pulls?(?:\s+on)?|puts?(?:\s+on)?|takes?(?:\s+off)?|removes?|veste|vestem|usa|usam|calça|calca|carrega|carregam|leva|levam|traz|trazem|segura|seguram|keeps?|holds?|holding|carries|carrying|has|have|tem|têm|tira|tiram|despe|despem|puxa|puxam|é|e|is|de|do|da|uma|um|uns|umas|an|a|the|o|os|as|his|her|their|seu|sua|suas|seus|and|with|com|over|down|up|mostra|mostram|shows?|cair|perde|perdem|loses?|lose|hangs?|hang|deixa|deixam)\s+/iu, '')
    if (/^\p{Lu}[\p{L}'’-]+$/u.test(bit.split(/\s+/)[0] || '') && !COLOR_LEAD.test(bit.split(/\s+/)[0] || '')) {
      bit = bit.replace(/^\p{Lu}[\p{L}'’-]+\s+/u, '')
    }
  }
  if (kind !== 'hair' && kind !== 'age') {
    bit = bit.split(/\s+(?<![\p{L}])(?:in|at|on|inside|into|onto|beside|near|by|down|up|to|toward|towards|under|over|beneath|behind|from|em|no|na|nos|nas|dans|sur|ao|à|para)(?![\p{L}])\s+/iu)[0]
  }
  const words = []
  for (const word of bit.split(/\s+/).filter(Boolean)) {
    if (words.length && (/^\p{Lu}/u.test(word) && !COLOR_LEAD.test(word) || /^(?:veste|vestem|wears?|wore|waits?|espera|abre|opens?|carrega|carregam|carries|holds?|holding|walks?|sits?|tira|pulls?|takes?|lava|yawns?)$/iu.test(word))) break
    words.push(word)
  }
  bit = words.join(' ')
  if (kind !== 'hair') bit = bit.replace(/(?:\s+(?:de|do|da|dos|das|em|no|na|com|with|por|para|ao|à|pelo|pela|and|e|até|ate|um|uma|a|to|back))+$/iu, '')
  else bit = bit.replace(/(?:\s+(?:de|do|da|em|com|até|ate|para|um|uma|e|and))+$/iu, '')
  return cleanText(bit)
}

function traitKey(value) {
  return ` ${foldName(value).replace(/-/g, ' ')} `
}

function sameTrait(left, right) {
  const a = traitKey(left)
  const b = traitKey(right)
  return a === b || a.includes(b) || b.includes(a)
}

function pushUnique(list, value, kind = '') {
  const bit = tidyAttribute(value, kind)
  if (!bit || bit.length > 80 || bit.split(/\s+/).length > 10) return
  if (TRAIT_VERB.test(bit) || ACTION_CLAUSE.test(bit)) return
  if (/^(?:off|tira|veste|pulls|takes|lava|yawns)\b/iu.test(bit)) return
  const index = list.findIndex(item => sameTrait(item, bit))
  if (index >= 0) {
    const have = list[index]
    if (bit.length > have.length && traitKey(bit).includes(traitKey(have).trim())) list[index] = bit
    return
  }
  list.push(bit)
}

function escapeIdentity(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function identityWindow(text, name, names = []) {
  const source = String(text || '')
  const own = new RegExp(`(?<![\\p{L}])${escapeIdentity(name)}(?![\\p{L}])`, 'iu')
  const others = (names || []).filter(other => {
    const key = foldName(other)
    return key && key !== foldName(name) && key.length >= 2 && !foldName(name).split(/\s+/).includes(key)
  })
  let subject = ''
  const chunks = []
  for (const sentence of sentences(source)) {
    const selfAt = sentence.search(own)
    let otherAt = -1
    for (const other of others) {
      const found = sentence.search(new RegExp(`(?<![\\p{L}])${escapeIdentity(other)}(?![\\p{L}])`, 'iu'))
      if (found >= 0 && nameIsPossessive(sentence, found)) continue
      if (found >= 0 && (otherAt < 0 || found < otherAt)) otherAt = found
    }
    const pronoun = /^(?:she|he|they|ela|ele|eles|elas)\b/iu.test(sentence.trim())
    const selfOwned = selfAt >= 0 && nameIsPossessive(sentence, selfAt)
    if (selfOwned && subject === name) subject = 'other'
    else if (!selfOwned && selfAt >= 0 && (otherAt < 0 || selfAt <= otherAt)) subject = name
    else if (otherAt >= 0 && (selfAt < 0 || otherAt < selfAt)) subject = 'other'
    if (subject !== name) continue
    if (!pronoun && selfAt < 0) continue
    let slice = sentence
    if (otherAt >= 0 && (selfAt < 0 || otherAt > selfAt)) slice = sentence.slice(0, otherAt)
    const lead = slice.match(/^\s*((?:\d{1,3}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?)[ -]year-old)\s+/iu)
    chunks.push(lead ? slice : slice)
  }
  return chunks.join(' ')
}

function splitJoined(value) {
  return String(value || '').split(/\s+\b(?:e|and)\b\s+/i).map(part => part.trim()).filter(Boolean)
}

/** Age, hair, outfit, carried item, and role stated for this person. Both site languages. */
export function identityTraits(text, name, names = []) {
  const looks = []
  const outfits = []
  const ages = []
  const items = []
  const objects = []
  const source = identityWindow(text, name, names)
  if (!source) return { looks, outfits, ages, items, objects }
  const addAge = value => { pushUnique(ages, value, 'age'); pushUnique(looks, value, 'age') }
  const addItem = value => {
    if (ACTION_HOLD.test(value)) return
    const clean = keptTrait(value, 'items')
    if (!clean || ACTION_CLAUSE.test(clean) || verbPhrase(clean)) return
    pushUnique(items, clean)
    pushUnique(outfits, clean)
  }
  const addOutfit = value => {
    const clean = keptTrait(value, 'outfit')
    if (!clean || verbPhrase(clean)) return
    pushUnique(outfits, clean)
  }
  const clauseAt = index => {
    const start = Math.max(source.lastIndexOf('.', index), source.lastIndexOf('!', index), source.lastIndexOf('?', index))
    const nextStop = ['.', '!', '?'].map(mark => source.indexOf(mark, index)).filter(at => at >= 0)
    const end = nextStop.length ? Math.min(...nextStop) : source.length
    return source.slice(start + 1, end)
  }
  const keepWorn = index => {
    const clause = clauseAt(index)
    if (/(?:tira|tiram|despe|despem|takes?\s+off|removes?)\b/iu.test(clause) && !/(?:veste|vestem|wears?|wore|puts?\s+on)\b/iu.test(clause)) return 'skip'
    if (/(?:pulls?|puxa|puxam)\b/iu.test(clause)) return 'keep'
    if (ACTION_CLAUSE.test(clause) && !/(?:wears?|wore|veste|vestem|usa|usam|carrega|carregam|leva|levam|traz|carries|carrying|holds?|has|have|tem|têm|takes?\s+off|puts?\s+on|tira|tiram|despe)\b/iu.test(clause)) return 'skip'
    return 'keep'
  }
  for (const match of source.matchAll(new RegExp(YEAR_OLD.source, 'giu'))) addAge(match[1])
  for (const match of source.matchAll(new RegExp(AGE_BIT.source, 'giu'))) addAge(match[0])
  for (const match of source.matchAll(new RegExp(STATED_AGE.source, 'giu'))) addAge(match[1])
  for (const match of source.matchAll(new RegExp(LISTED_AGE.source, 'giu'))) addAge(match[1])
  for (const match of source.matchAll(new RegExp(HAIR_BIT.source, 'giu'))) pushUnique(looks, match[0], 'hair')
  for (const match of source.matchAll(new RegExp(BALD_BIT.source, 'giu'))) pushUnique(looks, match[1] || match[0])
  for (const match of source.matchAll(new RegExp(MARK_BIT.source, 'giu'))) pushUnique(looks, match[1] || match[0])
  for (const match of source.matchAll(new RegExp(ROLE_BIT.source, 'giu'))) pushUnique(looks, match[1])
  for (const match of source.matchAll(new RegExp(BARE_ROLE.source, 'giu'))) pushUnique(looks, match[1])
  for (const match of source.matchAll(new RegExp(GARMENT_BIT.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    const before = source.slice(Math.max(0, match.index - 4), match.index)
    if (/(?:de\s+|in\s+)$/iu.test(before) && /fato/iu.test(match[0])) continue
    addOutfit(String(match[0] || '').split(/\s+\b(?:e|and)\b\s+/iu).pop())
  }
  for (const match of source.matchAll(new RegExp(ITEM_BIT.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    addItem(itemNoun(match[1] || match[0]))
  }
  for (const match of source.matchAll(new RegExp(BARE_ITEM.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    addItem(itemNoun(match[1] || match[0]))
  }
  for (const match of source.matchAll(new RegExp(WEAR_LEAD.source, 'giu'))) {
    if (keepWorn(match.index) === 'change' || keepWorn(match.index) === 'skip') continue
    splitJoined(match[1]).forEach(part => {
      if (/(?:carrega|carregam|carries|carrying|holds?|grips?|segura)/iu.test(part)) return
      addOutfit(part)
    })
  }
  for (const match of source.matchAll(new RegExp(CARRY_LEAD.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    splitJoined(match[1]).forEach(part => addItem(itemNoun(part)))
  }
  salvagedNouns(source).forEach(noun => {
    if (sheetWord(outfits, noun) || sheetWord(items, noun)) return
    pushUnique(objects, noun)
  })
  return { looks, outfits, ages, items, objects }
}

function itemNoun(value) {
  return String(value || '')
    .replace(/^(?:mostra|mostram|shows?|segura|seguram|traz|trazem|loses?|lose|hangs?|hang|perde|perdem|deixa|deixam|cair|drops?|picks?|holds?|holding|carries|carrying)\s+/iu, '')
    .replace(/^(?:os|as|uns|umas|uma|um|the|an|a|his|her|their|o)\s+/iu, '')
}

function sheetWord(list, value) {
  const key = foldName(value)
  return list.some(item => foldName(item).includes(key))
}

/** Garments and carried items named in this clause. Nothing is added that the text does not say. */
export function namedWornAndCarried(text) {
  const source = String(text || '')
  const garments = []
  const items = []
  for (const match of source.matchAll(new RegExp(GARMENT_BIT.source, 'giu'))) pushUnique(garments, match[0])
  for (const match of source.matchAll(new RegExp(ITEM_BIT.source, 'giu'))) pushUnique(items, match[1] || match[0])
  for (const match of source.matchAll(new RegExp(BARE_ITEM.source, 'giu'))) pushUnique(items, match[1] || match[0])
  const worn = garments.filter(item => !items.some(bit => sameTrait(bit, item)))
  return { garments: worn, items }
}

const PROP_HEAD = new RegExp(`^(?:${ITEM_WORD}|${GARMENT_WORD})$`, 'iu')

/** Garments and carried items named in the text. A place candidate must not be one of these. */
export function wornPropKeys(text) {
  const worn = namedWornAndCarried(text)
  const keys = new Set()
  for (const item of [...worn.garments, ...worn.items]) {
    const clean = foldName(keptTrait(item) || item)
    if (!clean) continue
    keys.add(clean)
    const head = clean.split(/\s+/).filter(Boolean).at(-1) || ''
    if (PROP_HEAD.test(head)) keys.add(foldName(head))
  }
  return keys
}

/** True when this place name is a garment or prop taken from a character look. */
export function isLookPropPlace(name, keys) {
  const key = foldName(name)
  if (!key || !keys?.size) return false
  if (keys.has(key)) return true
  const bits = key.split(/\s+/).filter(Boolean)
  return bits.length === 1 && keys.has(bits[0])
}

/** Drop missing_look once the sheet or the story has filled a description, including a merged alias. */
export function dropResolvedLookWarnings(characters, warnings) {
  const people = characters || []
  return (warnings || []).filter(item => {
    if (item?.code !== 'missing_look' || !item.name) return true
    const exact = people.find(person => foldName(person.name) === foldName(item.name))
    if (exact) return !cleanText(exact.look)
    const owners = people.filter(person => cleanText(person.look) && String(person.name || '').split(/\s+/).some(part => foldName(part) === foldName(item.name) && foldName(item.name).length >= 3))
    return owners.length !== 1
  })
}

function sheetBlob(entry) {
  return foldName([entry?.look, entry?.l, entry?.outfit, entry?.o, entry?.age, entry?.years, entry?.items, entry?.props, entry?.carried, entry?.marks, entry?.hair, entry?.role].map(value => cleanText(value)).filter(Boolean).join(' '))
}

function sheetCovers(blob, value) {
  const key = foldName(value)
  if (!key || key.length < 2) return true
  if (blob.includes(key)) return true
  const words = key.split(/\s+/).filter(word => word.length > 2)
  if (words.length > 0 && words.every(word => blob.includes(word))) return true
  const head = words.at(-1) || ''
  return head.length >= 4 && blob.includes(head)
}

/** Age, garments, and carried items the story names that a character sheet left out. */
export function characterSheetGaps(characters, storyText) {
  const list = Array.isArray(characters) ? characters : []
  const names = list.map(entry => cleanText(entry?.name || entry?.n)).filter(Boolean)
  const gaps = []
  list.forEach((entry, index) => {
    const name = cleanText(entry?.name || entry?.n)
    if (!name || !(cleanText(entry?.look || entry?.l) || cleanText(entry?.outfit || entry?.o))) return
    const blob = sheetBlob(entry)
    const found = identityTraits(storyText, name, names)
    const note = (field, values) => {
      for (const value of values) {
        const clean = cleanText(value)
        if (!clean || sheetCovers(blob, clean)) continue
        gaps.push({ index, name, field, value: clean })
      }
    }
    const garment = value => keptTrait(value, 'outfit')
    const worn = found.outfits.filter(item => garment(item) && !found.items.some(bit => foldName(bit) === foldName(item)))
    note('age', found.ages)
    note('outfit', worn.map(garment).filter(Boolean))
    note('items', [...found.items, ...(found.objects || [])].map(item => keptTrait(item, 'items')).filter(Boolean))
  })
  return gaps
}

function findAmbience(text, lex) {
  let light = ''
  let mood = ''
  for (const [pattern, value] of lex.light) if (!light && pattern.test(text)) light = value
  for (const [pattern, value] of lex.mood) if (!mood && pattern.test(text)) mood = value
  return { light, mood, confidence: light || mood ? 'medium' : 'low' }
}

function possessiveAt(text, index) {
  const before = String(text || '').slice(Math.max(0, index - 32), index)
  if (interactionPossessive(before)) return false
  return /(?<![\p{L}])(?:de|do|da|dos|das|of)\s+$/iu.test(before)
}

function nameInText(text, name) {
  const label = cleanText(name)
  if (!label) return false
  const source = String(text || '')
  const re = new RegExp(`(?<![\\p{L}])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
  for (const match of source.matchAll(re)) {
    if (!possessiveAt(source, match.index)) return true
  }
  return false
}

/** A later first name or last name is the full-name character when only one person owns it. */
function castInText(text, characters) {
  return (characters || []).filter(person => {
    if (!person?.name) return false
    if (nameInText(text, person.name)) return true
    const parts = String(person.name).split(/\s+/).filter(part => foldName(part).length >= 3)
    return parts.some(part => {
      const owners = characters.filter(other => String(other.name || '').split(/\s+/).some(bit => foldName(bit) === foldName(part)))
      return owners.length === 1 && nameInText(text, part)
    })
  })
}

function whoFromPronoun(sentence, center) {
  const first = foldName(tokens(sentence)[0] || '')
  if (!/^(?:she|he|sie|er|ela|ele|lei|lui|ella)$/u.test(first)) return { who: '', flag: 'who_missing' }
  if (!center) return { who: '', flag: 'who_unresolved' }
  return { who: center, flag: 'who_pronoun' }
}

const KINSHIP_ROLES = Object.freeze([
  { id: 'granddaughter', re: 'granddaughter|neta', gender: 'f', inverse: { m: 'grandfather', f: 'grandmother' } },
  { id: 'grandson', re: 'grandson|neto', gender: 'm', inverse: { m: 'grandfather', f: 'grandmother' } },
  { id: 'grandmother', re: 'grandmother|grandma|avó|avo', gender: 'f', inverse: { m: 'grandson', f: 'granddaughter' } },
  { id: 'grandfather', re: 'grandfather|grandpa|avô', gender: 'm', inverse: { m: 'grandson', f: 'granddaughter' } },
  { id: 'daughter', re: 'daughter|filha', gender: 'f', inverse: { m: 'father', f: 'mother' } },
  { id: 'son', re: 'son|filho', gender: 'm', inverse: { m: 'father', f: 'mother' } },
  { id: 'mother', re: 'mother|mãe|mae', gender: 'f', inverse: { m: 'son', f: 'daughter' } },
  { id: 'father', re: 'father|pai', gender: 'm', inverse: { m: 'son', f: 'daughter' } },
  { id: 'sister', re: 'sister|irmã|irma', gender: 'f', inverse: { m: 'brother', f: 'sister' } },
  { id: 'brother', re: 'brother|irmão|irmao', gender: 'm', inverse: { m: 'brother', f: 'sister' } },
  { id: 'husband', re: 'husband|marido|esposo', gender: 'm', inverse: { m: 'husband', f: 'wife' } },
  { id: 'wife', re: 'wife|esposa|mulher', gender: 'f', inverse: { m: 'husband', f: 'wife' } }
])

const ROLE_PATTERN = KINSHIP_ROLES.map(role => role.re).join('|')
const ROLE_WORD = new RegExp(`^(?:${ROLE_PATTERN})$`, 'iu')
const KIN_DET = 'their|his|her|seus|suas|seu|sua|the|umas|uma|uns|dum|duma|num|numa|pelos|pelas|pelo|pela|dos|das|nos|nas|aos|um|ao|do|da|no|na|os|as|an|o|à|às|a'

function escapeReg(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function roleByWord(word) {
  return KINSHIP_ROLES.find(role => new RegExp(`^(?:${role.re})$`, 'iu').test(word)) || null
}

function roleGender(roleId) {
  return KINSHIP_ROLES.find(role => role.id === roleId)?.gender || ''
}

function assumedLanguage(text, language) {
  if (language === 'pt' || language === 'en') return language
  if (/(?<![\p{L}])(?:é|não|nao|uma|dele|dela|cabelo|anos|você|voce)(?![\p{L}])/iu.test(text)) return 'pt'
  return 'en'
}

function nameLabels(person) {
  const name = cleanText(person?.name)
  if (!name) return []
  const labels = [name]
  name.split(/\s+/).forEach(part => {
    if (foldName(part).length >= 3) labels.push(part)
  })
  return labels
}

function resolveCast(label, characters) {
  const clean = cleanText(label)
  if (!clean) return null
  const exact = (characters || []).filter(person => foldName(person?.name) === foldName(clean))
  if (exact.length === 1) return exact[0]
  const bits = clean.split(/\s+/).filter(Boolean)
  if (bits.length !== 1) return null
  const key = foldName(bits[0])
  if (key.length < 3) return null
  const owners = (characters || []).filter(person => String(person?.name || '').split(/\s+/).some(part => foldName(part) === key))
  return owners.length === 1 ? owners[0] : null
}

function castHits(sentence, characters) {
  const hits = []
  for (const person of characters || []) {
    for (const label of nameLabels(person)) {
      const re = new RegExp(`(?<![\\p{L}])${escapeReg(label)}(?![\\p{L}])`, 'giu')
      for (const match of String(sentence || '').matchAll(re)) hits.push({ person, index: match.index, length: label.length })
    }
  }
  return hits
}

function lastCastBefore(sentence, index, characters) {
  const hits = castHits(sentence, characters).filter(hit => hit.index < index)
  if (!hits.length) return null
  hits.sort((a, b) => b.index - a.index || b.length - a.length)
  const best = hits[0]
  const end = best.index + best.length
  const covering = hits.filter(hit => hit.index <= best.index && hit.index + hit.length >= end)
  covering.sort((a, b) => b.length - a.length || a.index - b.index)
  return covering[0]?.person || best.person
}

function readCast(text, index, characters) {
  const slice = String(text || '').slice(index)
  const match = slice.match(/^(\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*){0,2})/u)
  if (!match) return null
  const words = match[1].split(/\s+/)
  for (let size = words.length; size >= 1; size -= 1) {
    const person = resolveCast(words.slice(0, size).join(' '), characters)
    if (person) return person
  }
  return null
}

function textGender(person, text, characters) {
  if (!person?.name) return ''
  let male = 0
  let female = 0
  for (const sentence of sentences(text)) {
    const hits = castHits(sentence, [person])
    if (!hits.length) continue
    const start = Math.min(...hits.map(hit => hit.index))
    const ownEnd = Math.max(...hits.map(hit => hit.index + hit.length))
    const later = castHits(sentence, characters).filter(hit => hit.index >= ownEnd && foldName(hit.person.name) !== foldName(person.name))
    const end = later.length ? Math.min(...later.map(hit => hit.index)) : sentence.length
    const window = sentence.slice(start, end)
    if (/(?<![\p{L}])é\s+uma(?![\p{L}])/iu.test(window)) female += 2
    if (/(?<![\p{L}])é\s+um(?![\p{L}])/iu.test(window)) male += 2
    if (/\bis\s+an?\s+(?:[\p{L}\d'’-]+\s+){0,8}(?:fisherwoman|woman|girl|mother|wife)\b/iu.test(window)) female += 2
    if (/\bis\s+an?\s+(?:[\p{L}\d'’-]+\s+){0,8}(?:fisherman|man|boy|father|husband)\b/iu.test(window)) male += 2
    if (/(?<![\p{L}])(?:pescadora|fisherwoman|mulher)(?![\p{L}])/iu.test(window)) female += 2
    else if (/(?<![\p{L}])(?:pescador|homem|fisherman)(?![\p{L}])/iu.test(window)) male += 2
    if (/(?<![\p{L}])(?:barba|beard)(?![\p{L}])/iu.test(window)) male += 2
  }
  if (male > female) return 'm'
  if (female > male) return 'f'
  return ''
}

function genderOf(person, text, characters, relations, forced) {
  const key = foldName(person?.name)
  if (!key) return ''
  if (forced?.get(key)) return forced.get(key)
  const held = (relations || []).find(item => foldName(item.holder) === key && roleGender(item.role))
  if (held) return roleGender(held.role)
  return textGender(person, text, characters)
}

function inverseRole(roleId, gender) {
  const role = KINSHIP_ROLES.find(item => item.id === roleId)
  if (!role || (gender !== 'm' && gender !== 'f')) return ''
  return role.inverse[gender] || ''
}

function linkPair(relations, holder, role, other, text, characters, forced) {
  if (!holder?.name || !role) return
  if (other && foldName(holder.name) === foldName(other.name)) return
  const ofName = other?.name || ''
  const key = `${foldName(holder.name)}|${role}|${foldName(ofName)}`
  if (!relations.some(item => item.key === key)) relations.push({ key, holder: holder.name, role, of: ofName })
  if (!other) return
  const back = inverseRole(role, genderOf(other, text, characters, relations, forced))
  if (!back) return
  const backKey = `${foldName(other.name)}|${back}|${foldName(holder.name)}`
  if (relations.some(item => item.key === backKey)) return
  relations.push({ key: backKey, holder: other.name, role: back, of: holder.name })
}

function introAnchor(previous, want, text, characters, relations, forced) {
  if (!previous) return null
  if (want !== 'm' && want !== 'f') return previous
  const known = textGender(previous, text, characters) || roleGender((relations.find(item => foldName(item.holder) === foldName(previous.name)) || {}).role)
  if (want === 'm' && known === 'f') return null
  if (want === 'f' && known === 'm') return null
  if (!known) forced.set(foldName(previous.name), want)
  return previous
}

function definiteIntroArticle(article, language) {
  const word = foldName(article)
  if (['his', 'her', 'their', 'seu', 'sua', 'seus', 'suas', 'the', 'o', 'os', 'as'].includes(word)) return true
  return word === 'a' && language === 'pt'
}

function skipWife(role, article, language) {
  if (!role || (role.id !== 'wife' && role.id !== 'husband')) return false
  if (role.id === 'husband') return false
  const word = foldName(article || '')
  if (word === 'uma' || word === 'um' || word === 'an') return true
  return word === 'a' && language !== 'pt'
}

/** Introductions such as "A filha, Marta" and "Rui é o pai de Marta", stored in both directions. */
function kinshipRelations(text, characters, language) {
  const relations = []
  const forced = new Map()
  const cast = (characters || []).filter(person => person?.name)
  let previous = null
  const wantOf = pronoun => {
    const word = foldName(pronoun)
    if (word === 'his' || word === 'dele') return 'm'
    if (word === 'her' || word === 'dela') return 'f'
    return ''
  }
  const copula = new RegExp(`(?<![\\p{L}])(?:é|is)\\s+(um|uma|a|o|os|as|the|an|his|her|their|seu|sua)?\\s*(${ROLE_PATTERN})(?![\\p{L}])\\s+(?:de|do|da|dos|das|of)\\s+(?:a\\s+|o\\s+|the\\s+)?`, 'giu')
  const bare = new RegExp(`(?<![\\p{L}])(?:é|is)\\s+(um|uma|a|o|os|as|the|an)?\\s*(${ROLE_PATTERN})(?![\\p{L}])(?!\\s+(?:de|do|da|dos|das|of)\\b)`, 'giu')
  const namedOf = new RegExp(`(?<![\\p{L}])(${ROLE_PATTERN})(?![\\p{L}])\\s+(?:de|do|da|dos|das|of)\\s+(?:a\\s+|o\\s+|the\\s+)?`, 'giu')
  const appositive = new RegExp(`,\\s*(a|o|the)\\s+(${ROLE_PATTERN})(?![\\p{L}])(?!\\s+(?:de|do|da|dos|das|of)\\b)`, 'giu')
  const leading = new RegExp(`(?<![\\p{L}])(his|her|their|seu|sua|seus|suas|the|um|uma|o|os|as|a)\\s+(${ROLE_PATTERN})(?:\\s+(dele|dela|deles|delas))?\\s*,\\s*`, 'giu')
  const owned = new RegExp(`['’]s\\s+(${ROLE_PATTERN})(?![\\p{L}])\\s*,?\\s*`, 'giu')
  for (const sentence of sentences(text)) {
    for (const match of sentence.matchAll(copula)) {
      const role = roleByWord(match[2])
      const holder = lastCastBefore(sentence, match.index, cast)
      const other = readCast(sentence, match.index + match[0].length, cast)
      if (role && holder && other) linkPair(relations, holder, role.id, other, text, cast, forced)
    }
    for (const match of sentence.matchAll(bare)) {
      const role = roleByWord(match[2])
      if (!role || skipWife(role, match[1], language)) continue
      const holder = lastCastBefore(sentence, match.index, cast)
      if (!holder) continue
      const other = previous && foldName(previous.name) !== foldName(holder.name) ? previous : null
      linkPair(relations, holder, role.id, other, text, cast, forced)
    }
    for (const match of sentence.matchAll(namedOf)) {
      if (/(?<![\p{L}])(?:é|is)\s+(?:um|uma|a|o|os|as|the|an|his|her|their|seu|sua)?\s*$/iu.test(sentence.slice(Math.max(0, match.index - 24), match.index))) continue
      const role = roleByWord(match[1])
      const other = readCast(sentence, match.index + match[0].length, cast)
      const after = sentence.slice(match.index + match[0].length)
      const comma = after.match(/^(?:\p{Lu}[\p{L}'’-]*\s+){0,3}\p{Lu}[\p{L}'’-]*\s*,\s*/u)
      const holder = comma ? readCast(sentence, match.index + match[0].length + comma[0].length, cast) : null
      if (role && holder && other) linkPair(relations, holder, role.id, other, text, cast, forced)
    }
    for (const match of sentence.matchAll(appositive)) {
      const role = roleByWord(match[2])
      if (!role || skipWife(role, match[1], language)) continue
      const holder = lastCastBefore(sentence, match.index, cast)
      if (!holder) continue
      const other = previous && foldName(previous.name) !== foldName(holder.name) ? previous : null
      linkPair(relations, holder, role.id, other, text, cast, forced)
    }
    for (const match of sentence.matchAll(leading)) {
      if (!definiteIntroArticle(match[1], language) && !match[3]) continue
      const role = roleByWord(match[2])
      const holder = readCast(sentence, match.index + match[0].length, cast)
      const other = introAnchor(previous, wantOf(match[3] || match[1]), text, cast, relations, forced)
      if (!role || !holder) continue
      if (other) linkPair(relations, holder, role.id, other, text, cast, forced)
    }
    for (const match of sentence.matchAll(owned)) {
      const role = roleByWord(match[1])
      const other = lastCastBefore(sentence, match.index, cast)
      const holder = readCast(sentence, match.index + match[0].length, cast)
      if (role && holder && other) linkPair(relations, holder, role.id, other, text, cast, forced)
    }
    const seen = lastCastBefore(sentence, sentence.length + 1, cast)
    if (seen) previous = seen
  }
  return relations
}

function mentionOwner(det, trailing, language) {
  const word = foldName(trailing || det)
  if (word === 'her' || word === 'dela') return 'f'
  if (word === 'his' || word === 'dele') return 'm'
  if (word === 'their' || word === 'deles' || word === 'delas') return 'group'
  const article = foldName(det)
  if (['um', 'uma', 'uns', 'umas', 'dum', 'duma', 'num', 'numa', 'an'].includes(article)) return 'indefinite'
  if (article === 'a' && language !== 'pt') return 'indefinite'
  return ''
}

function isIntroMention(sentence, roleIndex) {
  const before = sentence.slice(Math.max(0, roleIndex - 48), roleIndex)
  const after = sentence.slice(roleIndex)
  const role = after.match(new RegExp(`^(?:${ROLE_PATTERN})`, 'iu'))
  if (!role) return false
  const rest = after.slice(role[0].length)
  if (/(?<![\p{L}])(?:é|is)\s+(?:um|uma|uns|umas|a|o|os|as|the|an|his|her|their|seu|sua|seus|suas)?\s*$/iu.test(before)) return true
  if (/^\s*(?:de|do|da|dos|das|of)\b/iu.test(rest)) return true
  if (/^\s*,\s*\p{Lu}/u.test(rest)) return true
  return false
}

function kinshipMentions(sentence, language) {
  const mentions = []
  const re = new RegExp(`(?<![\\p{L}])(${KIN_DET})(?:\\s+(seu|sua|seus|suas))?\\s+(${ROLE_PATTERN})(?![\\p{L}])(?:\\s+(dele|dela|deles|delas))?`, 'giu')
  for (const match of String(sentence || '').matchAll(re)) {
    const role = roleByWord(match[3])
    if (!role || !ROLE_WORD.test(match[3])) continue
    const roleIndex = match.index + match[0].length - match[3].length - (match[4] ? match[4].length + 1 : 0)
    const owner = mentionOwner(match[2] || match[1], match[4] || '', language)
    if (owner === 'indefinite') continue
    if (isIntroMention(sentence, roleIndex)) continue
    mentions.push({ role: role.id, owner: match[4] ? mentionOwner(match[4], match[4], language) : (match[2] ? '' : owner) })
  }
  return mentions
}

/** "Os dois" / "both" is the two people present. A cast of two is that pair. */
export function groupSubject(sentence, characters, present = []) {
  const list = (characters || []).filter(person => person?.name)
  if (!list.length) return ''
  if (!/(?<![\p{L}])(?:os dois|as duas|both(?:\s+of\s+them)?|the two(?:\s+of\s+them)?)(?![\p{L}])/iu.test(sentence)) return ''
  const named = []
  const push = person => {
    if (!person?.name || named.some(item => foldName(item) === foldName(person.name))) return
    named.push(person.name)
  }
  if (list.length === 2) {
    list.forEach(push)
    return named.join(' and ')
  }
  for (const name of [...present].reverse()) {
    const person = list.find(item => foldName(item.name) === foldName(name) || item.name.split(/\s+/).some(part => foldName(part) === foldName(name) && foldName(name).length >= 3))
    push(person)
    if (named.length === 2) break
  }
  if (named.length === 2) return named.slice().reverse().join(' and ')
  return ''
}

function relativesOf(relations, role, anchor) {
  const specific = relations.filter(item => item.role === role && anchor?.name && foldName(item.of) === foldName(anchor.name) && foldName(item.holder) !== foldName(anchor.name))
  if (specific.length) return specific
  return relations.filter(item => item.role === role && !item.of && (!anchor?.name || foldName(item.holder) !== foldName(anchor.name)))
}

/** The named parent of a child link, when the stored inverse is missing and the gender does not contradict. */
function parentByChildLink(relations, role, anchor, text, characters) {
  const childRoles = KINSHIP_ROLES.filter(item => item.inverse.m === role || item.inverse.f === role).map(item => item.id)
  if (!childRoles.length || !anchor?.name) return []
  const want = roleGender(role)
  const found = []
  for (const item of relations) {
    if (!childRoles.includes(item.role) || foldName(item.holder) !== foldName(anchor.name) || !item.of) continue
    const other = resolveCast(item.of, characters)
    if (!other) continue
    const gender = genderOf(other, text, characters, relations, null)
    if (want && gender && gender !== want) continue
    if (!found.some(name => foldName(name) === foldName(other.name))) found.push(other.name)
  }
  return found
}

function anchorsFor(mention, named, text, characters, relations) {
  if (!named.length) return []
  const gender = person => genderOf(person, text, characters, relations, null)
  if (mention.owner === 'group') return named
  if (mention.owner === 'f' || mention.owner === 'm') {
    const fits = person => mention.owner === 'f' ? gender(person) !== 'm' : gender(person) !== 'f'
    if (named.length === 1) return named.filter(fits)
    const known = named.filter(person => (mention.owner === 'f' ? gender(person) === 'f' : gender(person) === 'm'))
    return known.length === 1 ? known : []
  }
  return named.length === 1 ? named : []
}

/** A possessive kinship word such as "com o pai" or "with her father" names that relative when exactly one sheeted character matches. */
export function kinshipSubject(sentence, characters, story, language = '') {
  const lang = assumedLanguage(`${story || ''}\n${sentence || ''}`, language)
  const relations = kinshipRelations(story || sentence, characters, lang)
  const named = castInText(sentence, characters)
  const added = []
  for (const mention of kinshipMentions(sentence, lang)) {
    const anchors = anchorsFor(mention, named, story || sentence, characters, relations)
    if (!anchors.length) continue
    const holders = []
    const pushHolder = name => {
      if (!name || holders.some(item => foldName(item) === foldName(name))) return
      holders.push(name)
    }
    anchors.forEach(anchor => {
      relativesOf(relations, mention.role, anchor).forEach(item => pushHolder(item.holder))
    })
    if (!holders.length) {
      anchors.forEach(anchor => {
        parentByChildLink(relations, mention.role, anchor, story || sentence, characters).forEach(pushHolder)
      })
    }
    if (holders.length !== 1) continue
    if (named.some(person => foldName(person.name) === foldName(holders[0]))) continue
    if (!added.some(name => foldName(name) === foldName(holders[0]))) added.push(holders[0])
  }
  return added.join(' and ')
}

export function applyKinship(who, sentence, characters, story, language) {
  let next = who || ''
  String(kinshipSubject(sentence, characters, story, language) || '').split(/\s+\band\b\s+/iu).forEach(name => {
    const clean = cleanText(name)
    if (!clean) return
    const key = foldName(clean).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?<![\\p{L}])${key}(?![\\p{L}])`, 'iu').test(foldName(next))) return
    next = next ? `${next} and ${clean}` : clean
  })
  return next
}

const PT_ROLE_WORD = /^(?:filha|filho|pai|mãe|mae|irmã|irma|irmão|irmao|avó|avo|avô|marido|esposa|mulher|neta|neto)$/iu
const DEFINITE_ROLE = new RegExp(`(?<![\\p{L}])(his|her|their|seu|sua|seus|suas|the|o|os|as|a)\\s+(${ROLE_PATTERN})(?![\\p{L}])(?!\\s+(?:de|do|da|dos|das|of)\\b)`, 'giu')
const OWNED_ROLE = new RegExp(`(?<![\\p{L}])([\\p{L}'’-]+(?:\\s+[\\p{L}'’-]+){0,2})['’]s\\s+(${ROLE_PATTERN})(?![\\p{L}])`, 'giu')
const OF_ROLE = new RegExp(`(?<![\\p{L}])(${ROLE_PATTERN})(?![\\p{L}])\\s+(?:de|do|da|dos|das|of)\\s+(?:a\\s+|o\\s+|the\\s+)?([\\p{L}'’-]+(?:\\s+[\\p{L}'’-]+){0,2})`, 'giu')

function kinshipSheetText(person) {
  return [person?.look, person?.l, person?.outfit, person?.o, person?.role, person?.age, person?.items, person?.props, person?.carried, person?.notes]
    .map(value => cleanText(value))
    .filter(Boolean)
    .join('. ')
}

function roleIsPortuguese(word) {
  return PT_ROLE_WORD.test(word)
}

function definiteSheetRole(article, word) {
  const kind = foldName(article)
  if (['his', 'her', 'their', 'the', 'o', 'os'].includes(kind)) return true
  if ((kind === 'a' || kind === 'as') && roleIsPortuguese(word)) return true
  if ((kind === 'seu' || kind === 'sua' || kind === 'seus' || kind === 'suas') && roleIsPortuguese(word)) return true
  return false
}

function canonicalKinship(holder, word, other) {
  const role = roleByWord(word)
  if (!role || !holder?.name || !other?.name) return ''
  if (foldName(holder.name) === foldName(other.name)) return ''
  if (roleIsPortuguese(word)) {
    const article = role.gender === 'f' ? 'a' : 'o'
    return `${holder.name} é ${article} ${word.toLowerCase()} de ${other.name}.`
  }
  return `${holder.name} is the ${word.toLowerCase()} of ${other.name}.`
}

function sheetRest(blob) {
  const article = new RegExp(`(?<![\\p{L}])(?:his|her|their|seu|sua|seus|suas|the|um|uma|uns|umas|o|os|as|an|a)\\s+(?=(?:${ROLE_PATTERN})(?![\\p{L}]))`, 'giu')
  const stripped = String(blob || '')
    .replace(OWNED_ROLE, ' ')
    .replace(article, ' ')
    .replace(OF_ROLE, ' ')
    .replace(DEFINITE_ROLE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
  return cleanText(stripped)
}

function singleOther(person, characters, want) {
  const rest = (characters || []).filter(item => item?.name && foldName(item.name) !== foldName(person?.name))
  if (!rest.length) return null
  const gender = item => textGender(item, kinshipSheetText(item) ? `${item.name}, ${kinshipSheetText(item)}.` : item.name, characters)
  if (want === 'm' || want === 'f') {
    const known = rest.filter(item => gender(item) === want)
    if (known.length === 1) return known[0]
    const open = rest.filter(item => gender(item) !== (want === 'm' ? 'f' : 'm'))
    return rest.length === 1 && open.length === 1 ? rest[0] : null
  }
  return rest.length === 1 ? rest[0] : null
}

function pronounWant(article) {
  const kind = foldName(article)
  if (kind === 'his') return 'm'
  if (kind === 'her') return 'f'
  return ''
}

/**
 * Kinship that lives only on a character sheet, written as the sentences the prose rules already read.
 * A bare "A filha" names the other person only when the cast has exactly one other character.
 */
export function sheetKinshipLines(characters) {
  const cast = (characters || []).filter(person => person?.name)
  const lines = []
  const seen = new Set()
  const push = line => {
    const clean = cleanText(line)
    const key = foldName(clean)
    if (!key || seen.has(key)) return
    seen.add(key)
    lines.push(clean.endsWith('.') ? clean : `${clean}.`)
  }
  const resetRoles = () => {
    OWNED_ROLE.lastIndex = 0
    OF_ROLE.lastIndex = 0
    DEFINITE_ROLE.lastIndex = 0
  }
  cast.forEach(person => {
    resetRoles()
    const rest = sheetRest(kinshipSheetText(person))
    if (rest) push(`${person.name}, ${rest}.`)
  })
  cast.forEach(person => {
    resetRoles()
    const blob = kinshipSheetText(person)
    if (!blob) return
    const explicit = []
    const addExplicit = (word, label) => {
      const other = resolveCast(label, cast)
      const line = canonicalKinship(person, word, other)
      if (line) explicit.push(line)
    }
    for (const match of blob.matchAll(OWNED_ROLE)) addExplicit(match[2], match[1])
    for (const match of blob.matchAll(OF_ROLE)) addExplicit(match[1], match[2])
    if (explicit.length) {
      explicit.forEach(push)
      return
    }
    const bare = [...blob.matchAll(DEFINITE_ROLE)].filter(match => definiteSheetRole(match[1], match[2]))
    if (bare.length !== 1) return
    const word = bare[0][2]
    const other = singleOther(person, cast, pronounWant(bare[0][1]))
    const line = canonicalKinship(person, word, other)
    if (!line) return
    push(line)
    const want = pronounWant(bare[0][1])
    if (want === 'm') push(`${other.name}. His ${word.toLowerCase()}, ${person.name}.`)
    if (want === 'f') push(`${other.name}. Her ${word.toLowerCase()}, ${person.name}.`)
  })
  return lines.join('\n')
}

function rememberPresent(present, who) {
  String(who || '').split(/\s+\band\b\s+|\s+\be\b\s+/iu).forEach(name => {
    const clean = cleanText(name)
    if (!clean) return
    const at = present.findIndex(item => foldName(item) === foldName(clean))
    if (at >= 0) present.splice(at, 1)
    present.push(clean)
  })
}

function findScenes(text, lex, characters, places, language) {
  const warnings = []
  const scenes = []
  const present = []
  let center = ''
  let lastWhere = ''
  let lastOutside = ''
  let light = ''
  sentences(text).forEach(sentence => {
    const wardrobeLater = scenes.length > 0 && isWardrobeSentence(sentence)
    const storyAct = /(?<![\p{L}])(?:walks?|runs?|enters?|leaves?|opens?|pours?|sits?|stands?|reads?|gives?|hands?|waits?|abre|fecha|entra|sai|caminha|corre|espera|pega|lê|le|entrega|observa|acende|acendem|pinta|pintam|ajuda|ajudam|senta|sentam|acena|mostra|mostram|segura|seguram|benze|benzem|reza|rezam|ora|oram|canta|cantam|dança|danca|dançam|dancam|fala|falam|olha|olham|abraça|abraca)(?![\p{L}])/iu.test(sentence)
    const described = !wardrobeLater && !storyAct && !trailingActionClause(sentence) && (isDescriptionSentence(sentence) || (/^[\p{Lu}][\p{L}'’-]+/u.test(sentence) && /(?:\d+\s*(?:Jahre|anni|anos|years)|cerca de\s+\d+|Anfang\s+\d+|poco più)/iu.test(sentence) && !/(?:^|[^\p{L}])(?:in|im|am|auf|bei|ins|zum|zur|dans|au|aux|nel|nella|nello|alla|al|sul|no|na|em|dentro|betritt|betrat|entra|entro|arriva|chega|espera|abre|lê|le)\b/iu.test(sentence)))
    if (described) {
      const headed = preferPlaceHead(locativeHeads(sentence, language).filter(item => item.moves !== false && !isNonPlaceNoun(item.lemma) && !isRejectedPlace(item.lemma) && mentionMovesScene(sentence, item.index, language)), sentence)
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
      else if (subject && (cueLight(sentence, language) || lastWhere)) lastWhere = subject
      const nextLight = lightAfterCue(sentence, language, light)
      if (nextLight) light = nextLight
      castInText(sentence, characters).forEach(person => rememberPresent(present, person.name))
      return
    }
    const action = cleanText(sentence).replace(/[.!?。！？]+$/, '')
    const foundNames = castInText(action, characters)
    let who = ''
    let whoFlag = ''
    const grouped = groupSubject(action, characters, present)
    if (grouped) {
      who = grouped
      center = ''
    } else if (foundNames.length === 1) {
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
    who = applyKinship(who, action, characters, text, language)
    const records = places.map(place => ({
      name: place.name,
      keys: lex.places.filter(([, name]) => name === place.name).map(([key]) => key).concat(place.name),
      unlisted: place.unlisted === true
    }))
    const headed = preferPlaceHead(locativeHeads(action, language).filter(item => item.moves !== false && !isNonPlaceNoun(item.lemma) && !isRejectedPlace(item.lemma) && mentionMovesScene(action, item.index, language)), action)
    const cue = headed && !(headed.soft && lastWhere)
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
    const entered = enteredPlace(action, language)
    const nested = action.match(/(?:água|agua|water|neve|snow|gelo|ice)\s+(?:de|do|da|dos|das|of)\s+(?:a\s+|o\s+|the\s+)?([\p{L}'’-]+)/iu)
    const nestedPlace = nested ? (settingName(nested[1], language) || '') : ''
    const inspected = inspectedPlace(action, language)
    const timed = sentenceHasTimeCue(sentence, language) || opensParagraph(text, sentence)
    const ownedPlace = timed ? possessivePlace(action, language) : ''
    if (nestedPlace && !isRejectedPlace(nestedPlace)) {
      where = nestedPlace
      whereFlag = ''
    } else if (entered && !isRejectedPlace(entered)) {
      where = entered
      whereFlag = ''
    } else if (inspected && !isRejectedPlace(inspected)) {
      where = inspected
      whereFlag = ''
    } else if (ownedPlace && !isRejectedPlace(ownedPlace)) {
      where = ownedPlace
      whereFlag = ''
    }
    const finished = finishCarriedPlace(action, where || lastWhere, lastWhere, lastOutside)
    where = finished.where
    const flown = aircraftPlace(action, language)
    if (flown) where = flown
    lastOutside = finished.outside
    lastWhere = where || ''
    rememberPresent(present, who)
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
    scenes: found.scenes.scenes.map(({ number, who, where, what, duration, light, source, flags }) => ({ number, who, where, what, duration, rulesLight: true, ...(light ? { light } : {}), ...(source ? { source } : {}), ...(flags?.length ? { flags } : {}) }))
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
