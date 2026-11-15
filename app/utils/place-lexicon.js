/** Static place library. Membership is not a sentence list. Sure places can be named on their own. Ambiguous ones count only inside a locative. */
import data from '../data/place-lexicon.json' with { type: 'json' }

const TABLES = new Map(Object.entries(data.tags || {}).map(([language, table]) => [language, new Map(Object.entries(table))]))
const FULL = new Set(data.lemmas || [])
let active = FULL

const POSITIONAL = new Set(['bottom', 'top', 'side', 'edge', 'middle', 'front', 'back', 'left', 'right', 'end', 'line', 'part', 'kind', 'sort', 'type', 'fond', 'bas', 'haut', 'côté', 'cote', 'seite', 'fondo', 'lato', 'fundo', 'lado', 'gauche', 'droite', 'down', 'up', 'cut', 'dessus', 'dessous'])
const NEVER_PLACE = new Set(['son', 'sa', 'ses', 'sein', 'seine', 'seinem', 'seinen', 'seiner', 'suo', 'sua', 'suoi', 'sue', 'seu', 'seus', 'minha', 'meu', 'mon', 'ma', 'mes', 'my', 'his', 'her', 'their', 'the', 'le', 'la', 'les', 'il', 'lo', 'der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine', 'lever', 'soleil', 'matin', 'soir', 'aube', 'morning', 'evening', 'sunrise', 'sunset', 'morgen', 'nacht', 'notte', 'mattina', 'alba', 'manha', 'noite'])
const UNUSABLE = new Set(['a:object', 'a:adjective', 'a:garment', 'a:determiner'])

function keyOf(word) {
  return String(word || '').trim().toLowerCase().replace(/’/g, "'")
}

function tableFor(language) {
  if (language === 'zh' || language === 'zh-Hans') return TABLES.get('zh-Hans')
  return TABLES.get(language) || null
}

export function placeLexiconHas(word) {
  const key = keyOf(word)
  return key.length > 2 && active.has(key)
}

/** `s` is a sure place. `a:name`, `a:object`, `a:material`, and `a:other` are ambiguous. */
export function placeTag(language, word) {
  const table = tableFor(language)
  if (!table) return ''
  const key = language === 'ja' || language === 'zh-Hans' || language === 'zh' ? String(word || '').trim() : keyOf(word)
  if (!key || POSITIONAL.has(keyOf(key)) || NEVER_PLACE.has(keyOf(key))) return ''
  const tag = table.get(key) || ''
  if (!tag) return ''
  if (keyOf(key) === 'stairs') return 'a:other'
  if ((language === 'en' || !language) && !active.has(keyOf(key))) return ''
  return tag
}

export function placeIsSure(language, word) {
  return placeTag(language, word) === 's'
}

export function placeIsAmbiguous(language, word) {
  return String(placeTag(language, word) || '').startsWith('a:')
}

export function placeOtherSense(language, word) {
  const tag = placeTag(language, word)
  return tag.startsWith('a:') ? tag.slice(2) : ''
}

export function placeLexiconSize() {
  return active.size
}

export function placeLibraryCounts() {
  return data.counts || {}
}

export function placeLexiconMeta() {
  return {
    size: (data.lemmas || []).length,
    counts: data.counts || {},
    license: data.license,
    attribution: data.attribution,
    builtFrom: data.builtFrom
  }
}

/** Tests use this to drop part of the English lexicon and restore it afterwards. */
export function usePlaceLexicon(lemmas) {
  active = new Set(lemmas || data.lemmas)
}

export function placeLexiconLemmas() {
  return data.lemmas
}

export function placeLibraryLanguages() {
  return Object.keys(data.tags || {})
}

const HOLD = /(?:holds?|holding|carries|carrying|wears?|wearing|uses?|using|takes?|taking|grabs?|prend|prennent|porte|portent|tient|tiennent|utilise|utilisent|nimmt|nehmen|trägt|tragen|hält|halten|prende|prendono|indossa|indossano|usa|usano|pega|pegam|segura|seguram|leva|levam|拿着|穿着|戴着|持って|使って|持っ)/iu

/** The noun is the thing being held, worn, or used, rather than a locative object. */
export function heldPlaceNoun(sentence, index) {
  const before = String(sentence || '').slice(Math.max(0, index - 48), index)
  if (/(?:in|at|on|inside|into|to|reaches|reach|dans|au|aux|à|sur|em|no|na|nos|nas|num|numa|im|am|ins|zum|zur|beim|auf|bei|nel|nello|nella|alla|al|allo|sul|sullo|sulla|で|に|在)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|l['’]|der\s+|die\s+|das\s+|dem\s+|o\s+|os\s+|il\s+|lo\s+)?$/iu.test(before)) return false
  const tail = before.split(/\b(?:in|at|on|inside|dans|au|aux|sur|em|no|na|im|auf|bei|nel|nella|sul)\b/iu).at(-1) || before
  return HOLD.test(tail)
}

const STRONG = Object.freeze({
  en: ['in', 'at', 'on', 'inside', 'into', 'within', 'through', 'to', 'reaches', 'reach'],
  fr: ['dans', 'au', 'aux', 'à', 'chez', 'sur'],
  pt: ['em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'ao', 'à', 'aos', 'às', 'dentro', 'entra', 'chega'],
  de: ['in', 'im', 'am', 'an', 'auf', 'bei', 'ins', 'zum', 'zur', 'beim', 'betritt', 'betrat'],
  it: ['in', 'nel', 'nello', 'nella', 'negli', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dentro', 'entra', 'entro', 'arriva', 'apre']
})
const ARTICLE = new Set(['the', 'a', 'an', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'o', 'os', 'as', 'um', 'uma', 'der', 'die', 'das', 'dem', 'den', 'ein', 'eine', 'einem', 'einer', 'einen', 'il', 'lo', 'gli', 'i', 'del', 'della', 'dei', 'delle', 'his', 'her', 'their', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'seu', 'sua', 'suo', 'mio', 'mia', 'l', 'd'])
const MODIFIER = new Set(['old', 'little', 'small', 'tiny', 'narrow', 'big', 'large', 'young', 'new', 'grand', 'petit', 'petite', 'vieux', 'vieille', 'alt', 'alte', 'alter', 'alten', 'klein', 'kleine', 'kleiner', 'kleinen', 'vecchio', 'vecchia', 'piccolo', 'piccola', 'grande', 'velho', 'velha', 'pequeno', 'pequena', 'antico', 'antica', 'antigo', 'tin', 'early', 'late'])
const TIME_WORD = new Set(['dawn', 'morning', 'noon', 'night', 'evening', 'dusk', 'sunrise', 'sunset', 'day', 'midnight', 'mattina', 'sera', 'abend', 'morgen', 'nacht', 'noite', 'manha', 'manhã', 'aube', 'soir', 'midi', 'alba', 'giorno', 'notte', 'tarde', 'dia', 'early', 'late', 'nightfall'])
const SKIP_HEAD = new Set(['him', 'her', 'them', 'me', 'you', 'elle', 'lui', 'pixie', 'silence', 'counter', 'pocket', 'sleeve', 'left', 'right', 'hair', 'cut', 'hand', 'hands', 'eye', 'eyes', 'face', 'door', 'window', 'table', 'cup', 'letter', 'water', 'tea', 'it', 'one', 'end', 'side', 'front', 'back', 'top', 'bottom', 'yeux', 'oeil', 'sourcil', 'dos', 'poche', 'tiroir', 'main', 'mains', 'cheveux', 'ink', 'drawing', 'mark', 'sketch', 'paper'])
const DESTINATION = new Set(['to', 'into', 'onto', 'dans', 'au', 'aux', 'entra', 'apre', 'ins', 'zum', 'zur', 'alla', 'al', 'allo', 'reaches', 'reach', 'chega', 'para', 'na', 'no', 'nel', 'nella', 'im'])
const WEAK_BEFORE = /(?:^|[^\p{L}])(?:behind|below|under|above|beside|near|across|of|from|about|vers|près|pres|hinter|unter|neben|vicino|sotto|sopra|perto|atrás|atras)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|il\s+|lo\s+|l['’])?$/iu
const MATERIAL_BEFORE = /(?:en|of|de|aus|di|von)\s+$/iu
const OBJECT_AFTER = /^(?:\s+\p{L}[\p{L}'’-]*){0,3}\s+(?:window|door|table|wall|sill|pane|glass|frame|ledge|counter|desk|shutter|fenêtre|fenetre|porte|fenster|finestra|窗户|窗|窓)/iu

function displayName(lemma) {
  return String(lemma || '').replace(/^\p{Ll}/u, char => char.toUpperCase())
}

function bareToken(token) {
  return String(token || '').replace(/^[ld]'/iu, '')
}

/** The first noun after a strong preposition. Modifiers may sit in between. A later noun after below/under does not. */
export function locativeHeads(text, language) {
  const lang = language === 'zh' ? 'zh-Hans' : language
  const source = String(text || '')
  const preps = new Set(STRONG[lang] || [])
  if (!preps.size || !source) return []
  const tokens = [...source.matchAll(/[\p{L}][\p{L}'’-]+/gu)]
  const heads = []
  for (let index = 0; index < tokens.length; index += 1) {
    if (!preps.has(tokens[index][0].toLowerCase())) continue
    let cursor = index + 1
    let possessive = false
    while (cursor < tokens.length && (ARTICLE.has(bareToken(tokens[cursor][0]).toLowerCase()) || preps.has(tokens[cursor][0].toLowerCase()))) {
      if (/^(?:son|sa|ses|his|her|their|seu|sua|suo|mio|mia|mon|ma|mes)$/i.test(bareToken(tokens[cursor][0]))) possessive = true
      cursor += 1
    }
    let modifiers = 0
    while (cursor < tokens.length && modifiers < 3 && MODIFIER.has(tokens[cursor][0].toLowerCase())) {
      cursor += 1
      modifiers += 1
    }
    if (cursor >= tokens.length) continue
    const prep = tokens[index][0].toLowerCase()
    let chosen = null
    for (let look = cursor; look < Math.min(tokens.length, cursor + 4); look += 1) {
      const word = bareToken(tokens[look][0])
      const folded = word.toLowerCase()
      if (preps.has(folded) || WEAK_BEFORE.test(` ${folded} `)) break
      if (ARTICLE.has(folded) || TIME_WORD.has(folded) || SKIP_HEAD.has(folded) || POSITIONAL.has(folded) || NEVER_PLACE.has(folded) || MODIFIER.has(folded) || word.length < 3) continue
      let lemma = word
      let span = 1
      for (let size = Math.min(3, tokens.length - look); size >= 2; size -= 1) {
        const phrase = tokens.slice(look, look + size).map(token => bareToken(token[0])).join(' ')
        if (placeTag(lang, phrase) && !UNUSABLE.has(placeTag(lang, phrase))) {
          lemma = phrase
          span = size
          break
        }
      }
      const tag = placeTag(lang, lemma)
      if (tag && !UNUSABLE.has(tag)) {
        chosen = { lemma, tag, at: tokens[look].index, span }
        break
      }
      if (DESTINATION.has(prep) && !possessive) {
        const token = tokens[look][0]
        const capital = token[0] !== token[0].toLowerCase()
        if (!(capital && lang !== 'de')) chosen = { lemma, tag: 'unlisted', at: tokens[look].index, span: 1 }
        break
      }
    }
    if (!chosen) continue
    heads.push({ lemma: chosen.lemma, name: displayName(chosen.lemma), tag: chosen.tag, index: chosen.at, locative: true })
    index = cursor
  }
  return heads
}

/** Sure places anywhere, ambiguous places only in a locative. Held nouns and material phrases are left out. */
export function libraryHits(text, language) {
  const source = String(text || '')
  const lang = language === 'zh' ? 'zh-Hans' : language
  const table = tableFor(lang)
  if (!table || !source) return []
  const hits = []
  const push = (lemma, tag, index, locative) => {
    if (!tag || UNUSABLE.has(tag)) return
    if (tag === 'a:material' && !locative) return
    if (lang === 'zh-Hans' && (lemma === '门口' || ((lemma.startsWith('小') || lemma.startsWith('大')) && [...table.keys()].some(key => key !== lemma && lemma.endsWith(key))))) return
    if (tag !== 's' && tag !== 'unlisted' && !locative) return
    const followsParticle = /^(?:で|に|へ)/.test(source.slice(index + String(lemma).length, index + String(lemma).length + 1))
    if (heldPlaceNoun(source, index) && !followsParticle) return
    if (tag.startsWith('a:material') && MATERIAL_BEFORE.test(source.slice(Math.max(0, index - 8), index))) return
    if (!locative && /(?:about|of|à propos|von|sobre)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|der\s+|die\s+|das\s+)?$/iu.test(source.slice(Math.max(0, index - 16), index))) return
    const after = source.slice(index + lemma.length, index + lemma.length + 24)
    if (OBJECT_AFTER.test(after)) return
    hits.push({ name: displayName(lemma), lemma, tag, index, locative: Boolean(locative) })
  }
  if (lang === 'ja' || lang === 'zh-Hans') {
    for (const [lemma, tag] of table) {
      let from = 0
      while (from < source.length) {
        const index = source.indexOf(lemma, from)
        if (index < 0) break
        const next = source[index + lemma.length] || ''
        const prev = source[index - 1] || ''
        const insideName = (/\p{Script=Han}/u.test(next) && !/^[里上中内的]/.test(next) && !/[在去到]/.test(source.slice(Math.max(0, index - 6), index)))
          || (/\p{Script=Han}/u.test(prev) && !/[在去到の]/.test(prev))
        if (insideName) {
          from = index + 1
          continue
        }
        const after = source.slice(index + lemma.length, index + lemma.length + 2)
        const before = source.slice(Math.max(0, index - 8), index)
        const locative = lang === 'ja'
          ? /^(?:で|に|へ)/.test(after) || before.endsWith('の') && after.startsWith('中')
          : /[在去到]/.test(before) || /^(?:里|上|中|内)/.test(after)
        push(lemma, tag, index, locative)
        from = index + Math.max(1, lemma.length)
      }
    }
    if (lang === 'zh-Hans') {
      for (const match of source.matchAll(/[在去到][\p{Script=Han}]{0,6}的([\p{Script=Han}]{2,4})(?![\p{Script=Han}])/gu)) {
        const lemma = match[1]
        if (/[了着过说给填吹]/.test(lemma)) continue
        const at = match.index + match[0].length - lemma.length
        const tag = placeTag(lang, lemma) || 'unlisted'
        if (UNUSABLE.has(tag)) continue
        push(lemma, tag, at, true)
      }
    }
    return hits.filter(hit => !hits.some(other => other.lemma.length > hit.lemma.length && other.index <= hit.index && other.index + other.lemma.length >= hit.index + hit.lemma.length))
  }
  locativeHeads(source, lang).forEach(head => {
    if (head.tag === 'unlisted') return
    push(head.lemma, head.tag, head.index, true)
  })
  const tokens = [...source.matchAll(/[\p{L}][\p{L}'’-]+/gu)]
  const headed = new Set(hits.map(hit => hit.index))
  for (let index = 0; index < tokens.length; index += 1) {
    for (let size = Math.min(3, tokens.length - index); size >= 1; size -= 1) {
      const lemma = tokens.slice(index, index + size).map(token => bareToken(token[0])).join(' ')
      const tag = placeTag(lang, lemma)
      if (tag !== 's') continue
      const at = tokens[index].index
      if (headed.has(at)) break
      const before = source.slice(Math.max(0, at - 24), at)
      if (WEAK_BEFORE.test(before)) break
      const original = tokens[index][0]
      if (lang === 'de' && original[0] === original[0].toLowerCase()) break
      push(lemma, tag, at, false)
      index += size - 1
      break
    }
  }
  return hits
}
