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
  if (/(?:in|at|on|inside|into|dans|au|aux|à|a|sur|em|no|na|nos|nas|im|am|auf|bei|nel|nello|nella|sul|sullo|sulla|で|に|在)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|l['’]|der\s+|die\s+|das\s+|dem\s+|o\s+|os\s+)?$/iu.test(before)) return false
  const tail = before.split(/\b(?:in|at|on|inside|dans|au|aux|sur|em|no|na|im|auf|bei|nel|nella|sul)\b/iu).at(-1) || before
  return HOLD.test(tail)
}

const LOCATIVE_BEFORE = /(?:^|[^\p{L}])(?:in|at|on|inside|into|within|through|dans|au|aux|à|sur|chez|em|no|na|nos|nas|dentro|im|am|auf|bei|nel|nello|nella|sul|sullo|sulla|betritt|betrat|entra|entro|enters?|entered|arriva|chega)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|l['’]|o\s+|os\s+|as\s+|um\s+|uma\s+|un\s+|une\s+|der\s+|die\s+|das\s+|dem\s+|den\s+|il\s+|lo\s+|his\s+|her\s+|their\s+)?(?:(?!(?:behind|near|of|from|toward|towards|across|about|sits|sit|sets|set|stands|stand|waits|wait|reads|read)\b)[\p{L}'’-]+\s+){0,3}$/iu
const MATERIAL_BEFORE = /(?:en|of|de|aus|di|von)\s+$/iu
const OBJECT_AFTER = /^(?:\s+\p{L}[\p{L}'’-]*){0,3}\s+(?:window|door|table|wall|sill|pane|glass|frame|ledge|counter|desk|shutter|fenêtre|fenetre|porte|fenster|finestra|窗户|窗|窓)/iu

function displayName(lemma) {
  return String(lemma || '').replace(/^\p{Ll}/u, char => char.toUpperCase())
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
    if (tag !== 's' && !locative) return
    if (heldPlaceNoun(source, index)) return
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
        const after = source.slice(index + lemma.length, index + lemma.length + 2)
        const before = source.slice(Math.max(0, index - 8), index)
        const locative = lang === 'ja'
          ? /^(?:で|に|へ)/.test(after) || before.endsWith('の') && after.startsWith('中')
          : /[在去到]/.test(before) || /^(?:里|上|中|内)/.test(after)
        push(lemma, tag, index, locative)
        from = index + Math.max(1, lemma.length)
      }
    }
    return hits.filter(hit => !hits.some(other => other.lemma.length > hit.lemma.length && other.index <= hit.index && other.index + other.lemma.length >= hit.index + hit.lemma.length))
  }
  const tokens = [...source.matchAll(/[\p{L}][\p{L}'’-]+/gu)]
  for (let index = 0; index < tokens.length; index += 1) {
    for (let size = Math.min(3, tokens.length - index); size >= 1; size -= 1) {
      const lemma = tokens.slice(index, index + size).map(token => token[0]).join(' ')
      const tag = placeTag(lang, lemma)
      if (!tag) continue
      const at = tokens[index].index
      const before = source.slice(Math.max(0, at - 32), at)
      const locative = LOCATIVE_BEFORE.test(before)
      const original = tokens[index][0]
      if (lang === 'de' && tag === 's' && !locative && original[0] === original[0].toLowerCase()) break
      push(lemma, tag, at, locative)
      index += size - 1
      break
    }
  }
  return hits
}
