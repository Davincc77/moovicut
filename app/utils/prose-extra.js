/** Rule-based prose detection for Portuguese. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { cueLight, findPlaceCue, inNamedVenue, isDescriptionSentence, isFunctionWord, isNumberWord, isQuotedOrRemembered, isVenueType, lightAfterCue, mentionMovesScene, namedVenues, subjectPlace } from './scene-split.js'
import { isNonPlaceNoun, isRejectedPlace, libraryHits, locativeHeads, movementPlace, preferPlaceHead, tidyPlaceLemma } from './place-lexicon.js'

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
    const found = identityTraits(text, person.name, characters.map(item => item.name))
    const usable = bit => bit && !new RegExp(`^${person.name}\\b`, 'iu').test(bit) && !TRAIT_VERB.test(bit) && !ACTION_CLAUSE.test(bit) && !/\b(?:veste|vestem|tira|tiram|despe|carrega|carregam|wears?|carries|holds?|pulls?|takes?\s+off)\b/iu.test(bit)
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

const PT_UNIT = 'um|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove'
const PT_TEEN = 'dez|onze|doze|treze|catorze|quatorze|quinze|dezasseis|dezesseis|dezassete|dezessete|dezoito|dezanove|dezenove'
const PT_TEN = 'vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa'
const PT_AGE = new RegExp(`^(?:cerca de\\s+)?(?:tem\\s+|têm\\s+)?(?:\\d{1,3}|${PT_TEEN}|${PT_TEN}(?:\\s+e\\s+(?:${PT_UNIT}))?)(?:\\s+anos)?$|^(?:nos seus\\s+[\\p{L}'’-]+(?:\\s+[\\p{L}'’-]+)?)`, 'iu')
const PT_ROLE = /(?<![\p{L}])(pescadora|pescador|padeira|padeiro|professora|professor|cozinheira|cozinheiro|enfermeira|enfermeiro|agricultora|agricultor|marinheira|marinheiro|guarda|aprendiz|arquivista|aluna|aluno|estudante|pintora|pintor)(?![\p{L}])/iu
const PT_LOOK = /(?<![\p{L}])(cabelo|cabelos|barba|bigode|olhos|rosto|pele|coque|caracóis|caracois|tranças|trancas|franja|madeixas|binóculos|binoculos|óculos|oculos)(?![\p{L}])/iu
const PT_WEAR = /(?<![\p{L}])(impermeável|impermeavel|gabardina|capa|casaco|avental|vestido|camisa|t-shirt|jaqueta|blusa|saia|calças|calcas|chapéu|chapeu|botas|lenço|lenco|xaile|uniforme|jardineira|jardineiras|luvas|luva|camisola|colete|macacão|macacao|pulôver|pullover|fato-macaco|fato|farda)(?![\p{L}])/iu
const PT_PROP = /(?<![\p{L}])((?:um|uma|uns|umas)\s+(?:apito|lanterna|chave|carta|bússola|bussola|martelo|câmara|camera|leque|flauta|pincel|caderno|cadernos|mochila|prancha|facão|facao|machado|microfone|estetoscópio|estetoscopio|anel|conchas|concha)|binóculos(?:\s+ao\s+pescoço)?|binoculos(?:\s+ao\s+pescoco)?|lanterna|apito|câmara|camera|leque|flauta|pincel|caderno|cadernos|mochila|violino|giz|prancha|facão|facao|conchas|concha|microfone)(?![\p{L}])/iu
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
    garmentHits.forEach(match => outfits.push(tidyAttribute(match[0])))
    for (const match of `${bit} ${raw}`.matchAll(new RegExp(ITEM_BIT.source, 'giu'))) outfits.push(tidyAttribute(match[1] || match[0]))
    if (!garmentHits.length && (PT_PROP.test(bit) || PT_PROP.test(raw))) outfits.push(tidyAttribute(bit))
    else if (!aged && !role && !looked && bit.split(/\s+/).length <= 5 && !/^(?:no|na|em|ao|à)\b/iu.test(bit) && !ACTION_CLAUSE.test(bit) && !/^\p{Lu}/u.test(bit)) outfits.push(bit)
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
const HAIR_BIT = new RegExp(`(?<![\\p{L}])(?:slicked-back\\s+)?(?:(?:short|long|curly|wavy|straight|auburn|copper|brown|black|blonde|blond|gray|grey|salt|frozen|white|silver|red|dark|fine|thin|castanh[oa]s?|grisalh[oa]|pret[oa]|ruiv[oa]|loir[oa]s?)\\s+){1,3}(?:hair|braids?|beard|cabelo|caracóis|caracois|tranças|trancas|barba|coque|bun|curls|locs|franja|madeixas|sideburns)(?:\\s+(?:${HAIR_STYLE}))?|(?<![\\p{L}])(?:tranças|trancas|cabelo|caracóis|caracois|barba|braids?|beard|coque|curls|franja|madeixas|sideburns)\\s+[\\p{L}'’-]+(?:\\s+(?:${HAIR_STYLE}|[\\p{L}'’-]+)){0,4}`, 'giu')
const MARK_BIT = /(?<![\p{L}])((?:red|white|round|rubber)\s+nose|(?:nariz)(?:\s+vermelho|\s+de\s+palhaço|\s+de\s+palhaco)?)(?![\p{L}])/giu
const GARMENT_WORD = 't-shirt|tee-shirt|sweatshirt|raincoat|peacoat|overcoat|waistcoat|cardigan|blazer|anorak|parka|hoodie|jumper|pullover|overalls|dungarees|impermeável|impermeavel|gabardina|casaco|jaqueta|camisola|colete|vestido|camisa|blusa|saia|calças|calcas|avental|jardineira|macacão|macacao|farda|fato-macaco|fato|capa|cape|cloak|robe|uniform|apron|coat|jacket|dress|shirt|sweater|skirt|blouse|trousers|pants|scarf|gloves|luvas|goggles|óculos|oculos|hat|cap|boots|botas|suit'
const GARMENT_BIT = new RegExp(`(?<![\\p{L}])((?:[\\p{L}'’-]+\\s+){0,3}(?:${GARMENT_WORD}))(?![\\p{L}])(?:\\s+(?!e\\b|and\\b|com\\b|with\\b|e\\b)(?:de|do|da|dos|das|of|[\\p{L}'’-]+)){0,3}`, 'giu')
const ITEM_WORD = 'mochila|backpack|rucksack|locket|whistle|apito|key|chave|compass|bússola|bussola|lanterna|câmara|camera|leque|fan|binóculos|binoculos|punch|radio|flauta|flute|pincel|brush|caderno|cadernos|notebook|violino|axe|machado|picareta|cane|bengala|goggles|facão|facao|machete|prancha|surfboard|conchas|concha|shells|shell|microphone|microfone|stethoscope|estetoscópio|estetoscopio|anel|ring|rings|nariz|nose'
const ITEM_BIT = new RegExp(`(?<![\\p{L}])(?:uma|um|uns|umas|an|a)(?![\\p{L}])\\s+((?:[\\p{L}'’-]+\\s+){0,2}(?:${ITEM_WORD})(?![\\p{L}])(?:\\s+(?:de|do|da|of)\\s+[\\p{L}'’-]+|\\s+[\\p{L}'’-]+){0,2})`, 'giu')
const BARE_ITEM = new RegExp(`(?<![\\p{L}])((?:[\\p{L}'’-]+\\s+){0,2}(?:${ITEM_WORD})(?![\\p{L}])(?:\\s+(?:de|do|da|of)\\s+[\\p{L}'’-]+|\\s+[\\p{L}'’-]+){0,2})`, 'giu')
const ROLE_BIT = /(?:^|[^\p{L}])(?:é|e|is)\s+(?:um|uma|a|an|the|o|a)?\s*(aprendiz|arquivista|archivist|apprentice|pescadora|pescador|aluna|aluno|estudante|student|guarda|padeira|padeiro|professora|professor)/giu
const BARE_ROLE = /(?<![\p{L}])(aprendiz|arquivista|archivist|apprentice|aluna|aluno|estudante|student)(?![\p{L}])/giu
const TRAIT_VERB = /(?<![\p{L}])(?:fecha|abre|espera|pinta|pousa|rega|acena|corre|caminha|levanta|larga|apanha|pega|lifts?|sets?|puts?|opens?|closes?|waits?|walks?|waves?|sits?|reads?|checks?|holds?|carries|carrega|veste|calls?|chama|nada|lava|lavam|yawns?|boceja|tira|tiram|despe|pulls?|takes?)(?![\p{L}])/iu
const ACTION_CLAUSE = /(?<![\p{L}])(?:lava|lavam|washes|wash|yawns?|yawned|boceja|bocejam|apanha|apanham|practises?|practices?|ensaia|encena|tira|tiram|despe|despem|takes?\s+off|puts?\s+on|pulls?|puxa|puxam|walks?|runs?|sits?|stands?|smiles?|waves?|writes?|pushes?)(?![\p{L}])/iu
const WEAR_LEAD = /(?<![\p{L}])(?:pulls?\s+on|puts?\s+on|zips(?:\s+into)?|veste|vestem|usa|usam|calça|calca|wears?|wore)(?![\p{L}])\s+(?:uma|um|uns|umas|an|a|the|her|his|o|a|de\s+)?([^.,;]+)/giu
const CARRY_LEAD = /(?<![\p{L}])(?:carrega|carregam|leva|levam|traz|segura|seguram|keeps?|holds?|holding|carries|carrying)(?![\p{L}])\s+(?:uma|um|uns|umas|an|a|the|her|his|o|a|seu|sua)?\s*([^.,;]+)/giu
const ACTION_HOLD = /(?:both hands|duas mãos|duas maos|ambas as mãos|ambas as maos)/iu
const COLOR_LEAD = /^(?:black|brown|blonde|blond|red|ginger|auburn|silver|white|grey|gray|blue|green|pink|purple|navy|charcoal|oatmeal|rust|gold|amber|ash|olive|plum|russet|saffron|indigo|wool|linen|velvet|silk|leather|yellow|copper|preto|preta|pretos|pretas|azul|verde|vermelho|vermelha|amarelo|amarela|cinzento|cinzenta|castanho|castanha|grisalho|grisalha|lã|la|couro|linho|veludo|curto|curta|comprido|comprida|liso|lisa)$/iu

function tidyAttribute(value, kind = '') {
  let bit = cleanText(value).replace(/[.,;]+$/g, '')
  bit = bit.replace(/^(?:in|at|on|inside|into|beside|near|by|em|no|na|nos|nas|dans|sur|ao|à)\s+/iu, '')
  let previous = ''
  while (bit !== previous) {
    previous = bit
    bit = bit.replace(/^(?:off|out|away|without|wears?|wore|wearing|pulls?(?:\s+on)?|puts?(?:\s+on)?|takes?(?:\s+off)?|removes?|veste|vestem|usa|usam|calça|calca|carrega|carregam|leva|levam|traz|segura|seguram|keeps?|holds?|holding|carries|carrying|has|have|tem|têm|tira|tiram|despe|despem|puxa|puxam|é|e|is|de|do|da|uma|um|uns|umas|an|a|the|o|os|as|his|her|their|seu|sua|suas|seus|and|with|com|over|down|up)\s+/iu, '')
    if (/^\p{Lu}[\p{L}'’-]+$/u.test(bit.split(/\s+/)[0] || '') && !COLOR_LEAD.test(bit.split(/\s+/)[0] || '')) {
      bit = bit.replace(/^\p{Lu}[\p{L}'’-]+\s+/u, '')
    }
  }
  if (kind !== 'hair' && kind !== 'age') {
    bit = bit.split(/\s+(?<![\p{L}])(?:in|at|on|inside|into|onto|beside|near|by|down|up|to|toward|towards|em|no|na|nos|nas|dans|sur|ao|à|para)(?![\p{L}])\s+/iu)[0]
  }
  const words = []
  for (const word of bit.split(/\s+/).filter(Boolean)) {
    if (words.length && (/^\p{Lu}/u.test(word) && !COLOR_LEAD.test(word) || /^(?:veste|vestem|wears?|wore|waits?|espera|abre|opens?|carrega|carregam|carries|holds?|holding|walks?|sits?|tira|pulls?|takes?|lava|yawns?)$/iu.test(word))) break
    words.push(word)
  }
  bit = words.join(' ')
  if (kind !== 'hair') bit = bit.replace(/(?:\s+(?:de|do|da|dos|das|em|no|na|com|with|por|para|ao|à|pelo|pela|and|e|até|ate))+$/iu, '')
  else bit = bit.replace(/(?:\s+(?:de|do|da|em|com|até|ate|para))+$/iu, '')
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
      if (found >= 0 && (otherAt < 0 || found < otherAt)) otherAt = found
    }
    const pronoun = /^(?:she|he|they|ela|ele|eles|elas)\b/iu.test(sentence.trim())
    if (selfAt >= 0 && (otherAt < 0 || selfAt <= otherAt)) subject = name
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
  const source = identityWindow(text, name, names)
  if (!source) return { looks, outfits, ages, items }
  const addAge = value => { pushUnique(ages, value, 'age'); pushUnique(looks, value, 'age') }
  const addItem = value => {
    if (ACTION_HOLD.test(value)) return
    const clean = tidyAttribute(value)
    if (!clean || ACTION_CLAUSE.test(clean)) return
    pushUnique(items, clean)
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
    if (/(?:pulls?|puxa|puxam)\b/iu.test(clause)) return 'keep'
    if (ACTION_CLAUSE.test(clause) && !/(?:wears?|wore|veste|vestem|usa|usam|carrega|carregam|leva|levam|traz|carries|carrying|holds?|has|have|tem|têm|takes?\s+off|puts?\s+on|tira|tiram|despe)\b/iu.test(clause)) return 'skip'
    return 'keep'
  }
  for (const match of source.matchAll(new RegExp(YEAR_OLD.source, 'giu'))) addAge(match[1])
  for (const match of source.matchAll(new RegExp(AGE_BIT.source, 'giu'))) addAge(match[0])
  for (const match of source.matchAll(new RegExp(STATED_AGE.source, 'giu'))) addAge(match[1])
  for (const match of source.matchAll(new RegExp(LISTED_AGE.source, 'giu'))) addAge(match[1])
  for (const match of source.matchAll(new RegExp(HAIR_BIT.source, 'giu'))) pushUnique(looks, match[0], 'hair')
  for (const match of source.matchAll(new RegExp(MARK_BIT.source, 'giu'))) pushUnique(looks, match[1] || match[0])
  for (const match of source.matchAll(new RegExp(ROLE_BIT.source, 'giu'))) pushUnique(looks, match[1])
  for (const match of source.matchAll(new RegExp(BARE_ROLE.source, 'giu'))) pushUnique(looks, match[1])
  for (const match of source.matchAll(new RegExp(GARMENT_BIT.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    pushUnique(outfits, match[0])
  }
  for (const match of source.matchAll(new RegExp(ITEM_BIT.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    addItem(match[1] || match[0])
  }
  for (const match of source.matchAll(new RegExp(BARE_ITEM.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    addItem(match[1] || match[0])
  }
  for (const match of source.matchAll(new RegExp(WEAR_LEAD.source, 'giu'))) {
    if (keepWorn(match.index) === 'change' || keepWorn(match.index) === 'skip') continue
    splitJoined(match[1]).forEach(part => {
      if (/(?:carrega|carregam|carries|carrying|holds?|grips?|segura)/iu.test(part)) return
      pushUnique(outfits, part)
    })
  }
  for (const match of source.matchAll(new RegExp(CARRY_LEAD.source, 'giu'))) {
    if (keepWorn(match.index) === 'skip') continue
    addItem(match[1])
  }
  return { looks, outfits, ages, items }
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

function sheetBlob(entry) {
  return foldName([entry?.look, entry?.l, entry?.outfit, entry?.o, entry?.age, entry?.years, entry?.items, entry?.props, entry?.carried, entry?.marks, entry?.hair, entry?.role].map(value => cleanText(value)).filter(Boolean).join(' '))
}

function sheetCovers(blob, value) {
  const key = foldName(value)
  if (!key || key.length < 2) return true
  if (blob.includes(key)) return true
  const words = key.split(/\s+/).filter(word => word.length > 2)
  return words.length > 0 && words.every(word => blob.includes(word))
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
    const worn = found.outfits.filter(item => !found.items.some(bit => foldName(bit) === foldName(item)))
    note('age', found.ages)
    note('outfit', worn)
    note('items', found.items)
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
