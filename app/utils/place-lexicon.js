/** Static place library. Membership is not a sentence list. Sure places can be named on their own. Ambiguous ones count only inside a locative. */
import { createRequire } from 'node:module'

// `with { type: 'json' }` is a with-statement to Rollup, so `nuxt generate` rejects it.
// Node still needs an attribute for a static JSON import. createRequire loads the file for
// tests and `node server/prod-server.mjs`. The Vite plugin in nuxt.config.ts rewrites this
// call into a plain JSON import for the client build.
const require = createRequire(import.meta.url)
const data = require('../data/place-lexicon.json')

const TABLES = new Map(Object.entries(data.tags || {}).map(([language, table]) => [language, new Map(Object.entries(table))]))
const FULL = new Set(data.lemmas || [])
let active = FULL

const POSITIONAL = new Set(['bottom', 'top', 'side', 'edge', 'middle', 'front', 'back', 'left', 'right', 'end', 'line', 'part', 'kind', 'sort', 'type', 'fond', 'bas', 'haut', 'côté', 'cote', 'seite', 'fondo', 'lato', 'fundo', 'lado', 'gauche', 'droite', 'down', 'up', 'cut', 'dessus', 'dessous'])
const NEVER_PLACE = new Set(['son', 'sa', 'ses', 'sein', 'seine', 'seinem', 'seinen', 'seiner', 'suo', 'sua', 'suoi', 'sue', 'seu', 'seus', 'minha', 'meu', 'mon', 'ma', 'mes', 'my', 'his', 'her', 'their', 'the', 'le', 'la', 'les', 'il', 'lo', 'der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine', 'lever', 'soleil', 'matin', 'soir', 'aube', 'morning', 'evening', 'sunrise', 'sunset', 'morgen', 'nacht', 'notte', 'mattina', 'alba', 'manha', 'noite'])
const UNUSABLE = new Set(['a:object', 'a:adjective', 'a:garment', 'a:determiner'])
/** Body parts, garments, and other nouns that are not settings. A one-character prefix such as 右 still counts. */
const NON_PLACE_NOUN = new Set([
  '眉', '眉尻', '眉毛', '目', '眼', '目尻', '腕', '手', '顔', '脸', '髪', '头发', '发髻', '頭', '头', '足', '脚', '口', '嘴', '耳', '鼻', '肩', '指', '背', '背中', '颊', '脸颊', '手腕', '胳膊',
  '前掛け', '手ぬぐい', 'エプロン', '作業着', 'カバー', '腕カバー', '袖', '袖子', '围裙', '衣服', '腕带', '圆脸', '眼睛'
])

/**
 * Explicit non-places. A lexicon tag does not override this list.
 * Abstracts and false locatives, then vehicle parts and devices.
 */
const EXPLICIT_NON_PLACES = new Set([
  'place', 'circle', 'circulo', 'círculo', 'lugar',
  'van', 'speaker', 'speakers', 'altifalante', 'altifalantes', 'carrinha', 'furgao', 'furgão',
  'wheel', 'wheels', 'roda', 'rodas', 'engine', 'motor', 'dashboard', 'radio', 'rádio',
  'headlight', 'headlights', 'bumper', 'tyre', 'tire', 'pneu', 'microphone', 'microfone',
  'laptop', 'monitor', 'amplifier', 'amplificador', 'horn', 'brake', 'brakes', 'travão', 'travao',
  'exhaust', 'steering', 'seatbelt', 'cinto', 'volante', 'farol', 'para-choque',
  'hand', 'hands', 'eye', 'eyes', 'face', 'hair', 'head', 'arm', 'arms', 'leg', 'legs', 'foot', 'feet',
  'mão', 'mao', 'olho', 'olhos', 'rosto', 'cabelo', 'cabeça', 'cabeca', 'braço', 'braco', 'perna'
].map(word => word.toLowerCase().replace(/’/g, "'")))

/** A body part, a garment, a vehicle part, an abstract, or the same noun inside a phrase. Not a place. */
export function isNonPlaceNoun(lemma) {
  const text = String(lemma || '').trim()
  if (!text) return false
  const key = keyOf(text)
  if (NON_PLACE_NOUN.has(text) || NEVER_PLACE.has(key) || EXPLICIT_NON_PLACES.has(key)) return true
  const bits = text.split(/[\sの]+/).map(bit => bit.trim()).filter(Boolean)
  if (bits.length > 1 && bits.some(bit => NON_PLACE_NOUN.has(bit) || NEVER_PLACE.has(keyOf(bit)) || EXPLICIT_NON_PLACES.has(keyOf(bit)))) return true
  return [...NON_PLACE_NOUN].some(word => word.length >= 2 && text.endsWith(word) && text.length === word.length + 1)
}

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
  const raw = String(sentence || '').slice(Math.max(0, index - 48), index)
  const before = raw.split(/[。！？.!?]/).at(-1) || raw
  if (/(?:で|に|へ|在)$/u.test(before)) return false
  if (/(?:in|at|on|inside|into|to|reaches|reach|dans|au|aux|à|sur|em|no|na|nos|nas|num|numa|im|am|ins|zum|zur|beim|auf|bei|nel|nello|nella|alla|al|allo|sul|sullo|sulla|で|に|在)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|l['’]|der\s+|die\s+|das\s+|dem\s+|o\s+|os\s+|il\s+|lo\s+)?$/iu.test(before)) return false
  const tail = before.split(/\b(?:in|at|on|inside|dans|au|aux|sur|em|no|na|im|auf|bei|nel|nella|sul)\b/iu).at(-1) || before
  return HOLD.test(tail)
}

const STRONG = Object.freeze({
  en: ['in', 'at', 'on', 'inside', 'into', 'within', 'through', 'to', 'reaches', 'reach'],
  fr: ['dans', 'au', 'aux', 'à', 'chez', 'sur'],
  pt: ['em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'ao', 'à', 'aos', 'às', 'dentro', 'entra', 'chega'],
  it: ['in', 'nel', 'nello', 'nella', 'negli', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dentro', 'entra', 'entro', 'arriva', 'apre']
})
const ARTICLE = new Set(['the', 'a', 'an', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'o', 'os', 'as', 'um', 'uma', 'der', 'die', 'das', 'dem', 'den', 'ein', 'eine', 'einem', 'einer', 'einen', 'il', 'lo', 'gli', 'i', 'del', 'della', 'dei', 'delle', 'his', 'her', 'their', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'seu', 'sua', 'suo', 'mio', 'mia', 'l', 'd'])
const MODIFIER = new Set(['old', 'little', 'small', 'tiny', 'narrow', 'big', 'large', 'young', 'new', 'grand', 'petit', 'petite', 'vieux', 'vieille', 'alt', 'alte', 'alter', 'alten', 'klein', 'kleine', 'kleiner', 'kleinen', 'gross', 'große', 'grossen', 'großen', 'neu', 'neue', 'neuen', 'rot', 'rote', 'roten', 'roter', 'blau', 'blaue', 'blauen', 'vecchio', 'vecchia', 'piccolo', 'piccola', 'grande', 'velho', 'velha', 'pequeno', 'pequena', 'antico', 'antica', 'antigo', 'tin', 'early', 'late', 'same', 'other', 'next', 'meme', 'même'])
const TIME_WORD = new Set(['dawn', 'morning', 'noon', 'night', 'evening', 'dusk', 'twilight', 'sunrise', 'sunset', 'sundown', 'afternoon', 'day', 'midnight', 'nightfall', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mattina', 'mattino', 'sera', 'serata', 'pomeriggio', 'tramonto', 'mezzogiorno', 'alba', 'giorno', 'notte', 'abend', 'morgen', 'nacht', 'morgens', 'mittags', 'nachmittags', 'vormittags', 'abends', 'nachts', 'mittag', 'dämmerung', 'dammerung', 'noite', 'manha', 'manhã', 'tarde', 'dia', 'meio', 'meio-dia', 'fim', 'aube', 'soir', 'midi', 'matin', 'coucher', 'jour', 'nuit', 'soiree', 'soirée', 'apres-midi', 'après-midi', 'crépuscule', 'crepuscule', 'crepuscolo', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'early', 'late'])
const PRONOUN = new Set(['she', 'he', 'they', 'her', 'his', 'him', 'them', 'we', 'you', 'elle', 'il', 'ils', 'elles', 'nous', 'vous', 'sie', 'er', 'ihn', 'ihr', 'ihnen', 'ela', 'ele', 'lei', 'lui'])
const VERB_STEM = new Set(['climb', 'walk', 'swim', 'go', 'come', 'run', 'enter', 'leave', 'reach', 'open', 'close', 'sit', 'stand', 'read', 'wait', 'look', 'turn', 'give', 'take', 'hold', 'carry', 'wear', 'unlock', 'rake', 'lower', 'boil', 'wave', 'buy', 'pay', 'drink', 'sleep', 'write', 'arrive', 'pick', 'put', 'eat', 'check', 'pour', 'lift', 'set', 'switch', 'speak', 'sitzen', 'gehen', 'kommen', 'kaufen', 'bezahlen', 'trinken', 'lesen', 'spielen', 'schlafen', 'entra', 'legge', 'scrive', 'accende', 'siede', 'compra', 'espera', 'mostra', 'apanha', 'fecha', 'come', 'marche', 'entre', 'ouvre', 'lit', 'regarde', 'attend'])
const PARTICLE = new Set(['down', 'up', 'away', 'back', 'out', 'off', 'along', 'over'])
const SKIP_HEAD = new Set(['him', 'her', 'them', 'me', 'you', 'elle', 'lui', 'pixie', 'silence', 'counter', 'pocket', 'bolso', 'sleeve', 'left', 'right', 'hair', 'cut', 'hand', 'hands', 'eye', 'eyes', 'face', 'door', 'window', 'table', 'cup', 'letter', 'water', 'tea', 'it', 'one', 'end', 'side', 'front', 'back', 'top', 'bottom', 'yeux', 'oeil', 'sourcil', 'dos', 'poche', 'tiroir', 'tiroirs', 'main', 'mains', 'cheveux', 'ink', 'drawing', 'mark', 'sketch', 'paper', 'step', 'steps', 'stair', 'stairs', 'post', 'rail', 'rails', 'drawer', 'drawers', 'coat', 'jacket', 'shirt', 'dress', 'hat', 'apron', 'manteau', 'tablier', 'mantel', 'hemd', 'kleid', 'hut', 'tasche', 'schuerze', 'schürze', 'auge', 'augen', 'gesicht', 'haar', 'kopf', 'bein', 'brief', 'stille', 'licht', 'traum', 'stimme', 'fenster', 'tisch', 'glas', 'tasse', 'sleep', 'schlaf', 'sommeil', 'sonno', 'dream', 'memory', 'thought', 'voice', 'name'])
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

function isModifierWord(word, lang) {
  const folded = String(word || '').toLowerCase()
  if (MODIFIER.has(folded)) return true
  if (placeTag(lang, folded)) return false
  return folded.length > 4 && /(?:lit|ish|ful|less|ous|ive)$/u.test(folded)
}

function isVerbHead(word, next = '') {
  const key = String(word || '').toLowerCase()
  if (!key) return false
  if (VERB_STEM.has(key)) return true
  const stem = key.replace(/(?:ing|ed|es|s|e)$/u, '')
  if (stem.length >= 3 && VERB_STEM.has(stem)) return true
  if (/(?:am|em|amos|aram|eram|ando|endo)$/u.test(key) && key.length >= 6) return true
  return PARTICLE.has(String(next || '').toLowerCase())
}

const PHRASE_STOP = new Set(['behind', 'below', 'under', 'above', 'beside', 'near', 'across', 'of', 'from', 'about', 'with', 'and', 'or', 'then', 'while', 'when', 'where', 'who', 'that', 'de', 'do', 'da', 'di', 'von', 'des', 'du', 'del', 'della', 'loin', 'toujours', 'meme', 'même', 'encore', 'aussi', 'still', 'just', 'very', 'without', 'around', 'during', 'sans', 'ohne'])

/** The noun phrase after a strong preposition. A compound stays whole. A time word or a verb is never the place. */
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
    while (cursor < tokens.length && modifiers < 3 && isModifierWord(bareToken(tokens[cursor][0]), lang)) {
      cursor += 1
      modifiers += 1
    }
    if (cursor >= tokens.length) continue
    const prep = tokens[index][0].toLowerCase()
    const words = []
    for (let look = cursor; look < Math.min(tokens.length, cursor + 5); look += 1) {
      const word = bareToken(tokens[look][0])
      const folded = word.toLowerCase()
      const upcoming = bareToken(tokens[look + 1]?.[0] || '').toLowerCase()
      if (preps.has(folded) || PHRASE_STOP.has(folded) || PRONOUN.has(folded) || WEAK_BEFORE.test(` ${folded} `)) break
      if (words.length && isVerbHead(upcoming) && !placeTag(lang, `${words.map(item => item.word).join(' ')} ${word}`)) break
      const capitalName = word[0] !== word[0].toLowerCase() && word[0] === word[0].toUpperCase()
      if (!words.length && TIME_WORD.has(folded)) break
      if (!words.length && (isVerbHead(folded, upcoming) || ARTICLE.has(folded) || isModifierWord(word, lang) || capitalName)) continue
      if (capitalName || TIME_WORD.has(folded) || isVerbHead(folded, upcoming) || ARTICLE.has(folded) || SKIP_HEAD.has(folded) || POSITIONAL.has(folded) || NEVER_PLACE.has(folded) || word.length < 3) break
      words.push({ word, at: tokens[look].index })
    }
    if (!words.length || possessive) continue
    if (words.some(item => isNonPlaceNoun(item.word))) continue
    if (words.some(item => {
      const folded = item.word.toLowerCase()
      return PRONOUN.has(folded) || TIME_WORD.has(folded) || isVerbHead(item.word)
    })) continue
    const lemma = words.map(item => item.word).join(' ')
    if (isNonPlaceNoun(lemma)) continue
    let tag = placeTag(lang, lemma)
    if ((!tag || UNUSABLE.has(tag)) && words.length > 1) tag = placeTag(lang, words.at(-1).word)
    if (tag && UNUSABLE.has(tag)) continue
    if (!tag) {
      if (!DESTINATION.has(prep) && words.length === 1) continue
      const namedPerson = words.every(item => item.word[0] !== item.word[0].toLowerCase())
      if (namedPerson) continue
      tag = 'unlisted'
    }
    const toward = new Set(['to', 'into', 'onto', 'zum', 'zur', 'ins', 'vers', 'para', 'verso'])
    const arrived = /(?:^|[^\p{L}])(?:go(?:es|ing|ne)?|went|walk(?:s|ed|ing)?|climb(?:s|ed|ing)?|enter(?:s|ed|ing)?|reach(?:es|ed|ing)?|come[s]?|came|arriv(?:e|es|ed|ing)|step(?:s|ped)?|descend(?:s|ed|ing)?|geht|gehen|ging|komm(?:t|en)|kam|betritt|betrat|erreicht|entra(?:r|ndo)?|chega|vai|va|arrive|entre|descend|monte|走进|来到|回到|进了)/iu
    const moves = !toward.has(prep) || arrived.test(source.slice(Math.max(0, tokens[index].index - 48), words.at(-1).at + words.at(-1).word.length))
    heads.push({ lemma, name: displayName(lemma), tag, index: words[0].at, locative: true, moves })
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
    if (!tag || UNUSABLE.has(tag) || isNonPlaceNoun(lemma)) return
    if (tag === 'a:material' && !locative) return
    if (lang === 'zh-Hans' && (lemma === '门口' || ((lemma.startsWith('小') || lemma.startsWith('大')) && [...table.keys()].some(key => key !== lemma && lemma.endsWith(key))))) return
    if (tag !== 's' && tag !== 'unlisted' && !locative) return
    if (!locative) {
      const before = source.slice(Math.max(0, index - 24), index)
      const towardOnly = /(?:^|[^\p{L}])(?:to|into|onto|zum|zur|ins|vers|para|verso)\s+(?:the\s+|a\s+|an\s+|der\s+|die\s+|das\s+|dem\s+|den\s+)?$/iu.test(before)
      const arrived = /(?:walk|go(?:es|ing)?|went|enter|reach|come|arriv|geht|komm|betritt|entra|chega)/iu.test(source.slice(Math.max(0, index - 48), index))
      if (towardOnly && !arrived) return
    }
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
        if (lang === 'ja' && /^[\p{Script=Katakana}ー]+$/u.test(lemma) && (/\p{Script=Katakana}/u.test(prev) || /\p{Script=Katakana}/u.test(next))) {
          from = index + 1
          continue
        }
        const after = source.slice(index + lemma.length, index + lemma.length + 12)
        const before = source.slice(Math.max(0, index - 8), index)
        if (lang === 'ja') {
          const compound = after.match(/^の([\p{Script=Han}]{1,8})(?![\p{Script=Han}])/u)
          if (compound && !/^(?:中|上|下|前|後|外|内|方)/.test(compound[1])) {
            const full = `${lemma}の${compound[1]}`
            const rest = source.slice(index + full.length)
            if (/^(?:を(?:訪ね|登|入|出|行|来|向か|戻)|[にでへ])/.test(rest)) {
              const headTag = placeTag(lang, compound[1])
              if (headTag && !UNUSABLE.has(headTag)) push(compound[1], headTag, index + full.length - compound[1].length, true)
              else push(full, 'unlisted', index, true)
              from = index + full.length
              continue
            }
          }
        }
        const locative = lang === 'ja'
          ? /^(?:で|に|へ|を)/.test(after) || before.endsWith('の') && after.startsWith('中')
          : /(?:在|去|到|来到)/.test(before) || /^(?:里|上|中|内|边|旁)/.test(after)
        push(lemma, tag, index, locative)
        from = index + Math.max(1, lemma.length)
      }
    }
    if (lang === 'ja') {
      const motion = String.raw`(?=を(?:訪ね|登|入|出|行|来|向か|戻)|[にでへ])`
      for (const match of source.matchAll(new RegExp(`([\\p{Script=Han}]{1,4}(?:の[\\p{Script=Han}]{1,8})+)${motion}`, 'gu'))) {
        const parts = match[1].split('の')
        const head = parts.at(-1)
        const headTag = placeTag(lang, head)
        const lemma = headTag && !UNUSABLE.has(headTag) ? head : match[1]
        const at = headTag && !UNUSABLE.has(headTag) ? match.index + match[1].lastIndexOf(head) : match.index
        push(lemma, headTag && !UNUSABLE.has(headTag) ? headTag : 'unlisted', at, true)
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
      const framed = /(?:来到|走到|回到|进了|到了|来到|到|在)([\p{Script=Han}]{2,8}?)(?:里|上|中|内|边|旁)/gu
      for (const match of source.matchAll(framed)) {
        let lemma = match[1]
        if (lemma.includes('的')) lemma = lemma.split('的').at(-1) || lemma
        if (lemma.length < 2 || /^(?:他们|她们|我们|大家|两人|二人|这里|那里)/.test(lemma) || /[了着过说给]/.test(lemma)) continue
        const at = match.index + match[0].lastIndexOf(lemma)
        push(lemma, placeTag(lang, lemma) || 'unlisted', at, true)
      }
      const suffixed = /(?:来到|走到|回到|到了|到|在)([\p{Script=Han}]{1,6}(?:房|屋|坊|社|庙|寺|站|闸|船|场|楼|室|厅|院|巷|街|铺|厂|库|棚|窑|桥|塔|亭|口|门|园|馆|店|庄|村|镇))/gu
      for (const match of source.matchAll(suffixed)) {
        let lemma = match[1]
        if (lemma.includes('的')) lemma = lemma.split('的').at(-1) || lemma
        if (lemma.length < 2 || /^(?:他们|她们|我们|大家|两人|二人)/.test(lemma) || /[了着过说给]/.test(lemma)) continue
        const at = match.index + match[0].length - lemma.length
        push(lemma, placeTag(lang, lemma) || 'unlisted', at, true)
      }
    }
    return hits.filter(hit => !hits.some(other => other.lemma.length > hit.lemma.length && other.index <= hit.index && other.index + other.lemma.length >= hit.index + hit.lemma.length))
  }
  locativeHeads(source, lang).forEach(head => {
    if (head.moves === false) return
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
      push(lemma, tag, at, false)
      index += size - 1
      break
    }
  }
  return hits
}
