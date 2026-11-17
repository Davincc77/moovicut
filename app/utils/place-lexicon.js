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
const NEVER_PLACE = new Set(['son', 'sa', 'ses', 'sein', 'seine', 'seinem', 'seinen', 'seiner', 'suo', 'sua', 'suoi', 'sue', 'seu', 'seus', 'minha', 'meu', 'mon', 'ma', 'mes', 'my', 'his', 'her', 'their', 'the', 'le', 'la', 'les', 'il', 'lo', 'der', 'die', 'das', 'dem', 'den', 'des', 'ein', 'eine', 'lever', 'soleil', 'matin', 'soir', 'aube', 'morning', 'evening', 'sunrise', 'sunset', 'morgen', 'nacht', 'notte', 'mattina', 'alba', 'manha', 'noite', 'madrugada', 'luar', 'anoitecer', 'entardecer', 'crepusculo', 'crepúsculo', 'meia-noite', 'noitinha'])
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
  'exhaust', 'steering', 'seatbelt', 'cinto', 'volante', 'para-choque', 'headlight',
  'hand', 'hands', 'eye', 'eyes', 'face', 'hair', 'head', 'arm', 'arms', 'leg', 'legs', 'foot', 'feet',
  'mão', 'mao', 'olho', 'olhos', 'rosto', 'cabelo', 'cabeça', 'cabeca', 'braço', 'braco', 'perna',
  'testa', 'forehead', 'queixo', 'chin', 'pescoço', 'pescoco', 'neck', 'ombro', 'ombros', 'shoulder', 'shoulders',
  'boca', 'joelho', 'knee', 'cotovelo', 'elbow', 'nariz', 'nose', 'orelha', 'ear', 'peito', 'chest', 'cintura', 'waist', 'dedo', 'finger',
  'chão', 'chao', 'floor', 'parede', 'wall', 'teto', 'tecto', 'ceiling', 'solo', 'ground', 'piso', 'soalho',
  'caixa', 'registadora', 'registradora', 'register', 'xaile', 'xale', 'shawl', 'coque', 'bun',
  'watch', 'watches', 'watching', 'relógio', 'relogio', 'relógios', 'relogios',
  'distance', 'light', 'darkness', 'silence', 'low', 'drawing', 'distancia', 'luz', 'silencio', 'silêncio',
  'french', 'english', 'portuguese', 'spanish', 'german', 'italian', 'japanese', 'chinese',
  'francês', 'frances', 'inglês', 'ingles', 'português', 'portugues', 'espanhol', 'alemão', 'alemao', 'japonês', 'japones', 'chinês', 'chines',
  'mirror', 'mirrors', 'espelho', 'espelhos', 'crowd', 'crowds', 'multidão', 'multidao', 'plateia',
  'sand', 'sands', 'areia', 'desk', 'desks', 'escrivaninha', 'secretária', 'secretaria',
  'trapeze', 'trapézio', 'trapezio', 'carriage', 'carruagem', 'air', 'ar', 'snow', 'neve', 'ice', 'gelo', 'água', 'agua', 'water',
  'base', 'bases', 'board', 'boards', 'quadro',
  'piano', 'pianos', 'lid', 'lids', 'tampa', 'tampas'
].map(word => word.toLowerCase().replace(/’/g, "'")))

/** Sure places the WordNet walk does not list. A locative still accepts other unlisted nouns. */
const SUPPLEMENT = new Map([
  ['en', new Map([
    ['lighthouse', 's'],
    ['sleeper compartment', 's'],
    ['dining car', 's'],
    ['red carpet', 's'],
    ['conservatory', 's'],
    ['atrium', 's'],
    ['study', 's'],
    ['attic', 's'],
    ['gallery', 's'],
    ['workshop', 's'],
    ['lobby', 's'],
    ['chapel', 's'],
    ['cloister', 's'],
    ['vestibule', 's'],
    ['larder', 's'],
    ['laundry', 's'],
    ['sea', 's'],
    ['ocean', 's'],
    ['kiln', 's'],
    ['church', 's'],
    ['stage', 's'],
    ['sleeper car', 's'],
    ['cellar', 's'],
    ['stables', 's'],
    ['stable', 's'],
    ['big top', 's'],
    ['hall', 's'],
    ['lake', 's'],
    ['yard', 's'],
    ['hut', 's'],
    ['cabin', 's'],
    ['cottage', 's'],
    ['shack', 's'],
    ['barn', 's'],
    ['paddock', 's'],
    ['cave', 's'],
    ['cavern', 's'],
    ['grotto', 's'],
    ['glacier', 's'],
    ['helipad', 's'],
    ['suite', 's'],
    ['beach', 's'],
    ['shore', 's'],
    ['coast', 's'],
    ['bay', 's'],
    ['island', 's'],
    ['pier', 's'],
    ['quay', 's'],
    ['dock', 's'],
    ['wharf', 's'],
    ['harbor', 's'],
    ['harbour', 's'],
    ['marina', 's'],
    ['runway', 's'],
    ['tarmac', 's'],
    ['hangar', 's'],
    ['warehouse', 's'],
    ['factory', 's'],
    ['mill', 's'],
    ['bakery', 's'],
    ['tavern', 's'],
    ['inn', 's'],
    ['lobby', 's'],
    ['corridor', 's'],
    ['hallway', 's'],
    ['staircase', 's'],
    ['balcony', 's'],
    ['terrace', 's'],
    ['porch', 's'],
    ['patio', 's'],
    ['garden', 's'],
    ['orchard', 's'],
    ['field', 's'],
    ['meadow', 's'],
    ['pasture', 's'],
    ['forest', 's'],
    ['woods', 's'],
    ['park', 's'],
    ['square', 's'],
    ['plaza', 's'],
    ['alley', 's'],
    ['bridge', 's'],
    ['tower', 's'],
    ['castle', 's'],
    ['chapel', 's'],
    ['cemetery', 's'],
    ['office', 's'],
    ['study', 's'],
    ['studio', 's'],
    ['gallery', 's'],
    ['workshop', 's'],
    ['forge', 's'],
    ['attic', 's'],
    ['basement', 's'],
    ['kitchen', 's'],
    ['bedroom', 's'],
    ['bathroom', 's'],
    ['nursery', 's'],
    ['classroom', 's'],
    ['museum', 's'],
    ['theatre', 's'],
    ['theater', 's'],
    ['arena', 's'],
    ['stadium', 's'],
    ['library', 's'],
    ['school', 's'],
    ['hospital', 's'],
    ['clinic', 's'],
    ['station', 's'],
    ['platform', 's'],
    ['market', 's'],
    ['courtyard', 's'],
    ['rooftop', 's'],
    ['clearing', 's'],
    ['ridge', 's'],
    ['valley', 's'],
    ['canyon', 's'],
    ['desert', 's'],
    ['dune', 's'],
    ['jungle', 's'],
    ['swamp', 's'],
    ['marsh', 's'],
    ['pond', 's'],
    ['waterfall', 's'],
    ['river', 's'],
    ['mountain', 's'],
    ['hill', 's'],
    ['farm', 's'],
    ['circus', 's']
  ])],
  ['pt', new Map([
    ['farol', 's'],
    ['mercado', 's'],
    ['tapete vermelho', 's'],
    ['compartimento', 's'],
    ['mar', 's'],
    ['praia', 's'],
    ['cais', 's'],
    ['átrio', 's'],
    ['atrio', 's'],
    ['escritório', 's'],
    ['escritorio', 's'],
    ['sótão', 's'],
    ['sotao', 's'],
    ['galeria', 's'],
    ['lavanderia', 's'],
    ['biblioteca', 's'],
    ['conservatório', 's'],
    ['conservatorio', 's'],
    ['vestíbulo', 's'],
    ['vestibulo', 's'],
    ['claustro', 's'],
    ['bilheteira', 's'],
    ['vinha', 's'],
    ['forno', 's'],
    ['fornalha', 's'],
    ['palco', 's'],
    ['igreja', 's'],
    ['adega', 's'],
    ['estábulos', 's'],
    ['estabulos', 's'],
    ['estábulo', 's'],
    ['estabulo', 's'],
    ['cavalariça', 's'],
    ['cavalariça', 's'],
    ['picadeiro', 's'],
    ['circo', 's'],
    ['lona', 's'],
    ['salão', 's'],
    ['salao', 's'],
    ['lago', 's'],
    ['lagos', 's'],
    ['lagoa', 's'],
    ['quintal', 's'],
    ['pátio', 's'],
    ['patio', 's'],
    ['cabana', 's'],
    ['choupana', 's'],
    ['palhoça', 's'],
    ['palhoca', 's'],
    ['glaciar', 's'],
    ['geleira', 's'],
    ['gruta', 's'],
    ['caverna', 's'],
    ['heliporto', 's'],
    ['suíte', 's'],
    ['suite', 's'],
    ['praia', 's'],
    ['costa', 's'],
    ['baía', 's'],
    ['baia', 's'],
    ['ilha', 's'],
    ['cais', 's'],
    ['doca', 's'],
    ['porto', 's'],
    ['marina', 's'],
    ['hangar', 's'],
    ['armazém', 's'],
    ['armazem', 's'],
    ['moinho', 's'],
    ['padaria', 's'],
    ['taberna', 's'],
    ['estalagem', 's'],
    ['cozinha', 's'],
    ['quarto', 's'],
    ['corredor', 's'],
    ['varanda', 's'],
    ['terraço', 's'],
    ['terraco', 's'],
    ['jardim', 's'],
    ['pomar', 's'],
    ['campo', 's'],
    ['prado', 's'],
    ['floresta', 's'],
    ['parque', 's'],
    ['praça', 's'],
    ['praca', 's'],
    ['ponte', 's'],
    ['torre', 's'],
    ['castelo', 's'],
    ['capela', 's'],
    ['cemitério', 's'],
    ['cemiterio', 's'],
    ['galeria', 's'],
    ['oficina', 's'],
    ['celeiro', 's'],
    ['tenda', 's'],
    ['estufa', 's'],
    ['telhado', 's'],
    ['biblioteca', 's'],
    ['museu', 's'],
    ['teatro', 's'],
    ['arena', 's'],
    ['estádio', 's'],
    ['estadio', 's'],
    ['escola', 's'],
    ['hospital', 's'],
    ['clínica', 's'],
    ['clinica', 's'],
    ['mercado', 's'],
    ['estação', 's'],
    ['estacao', 's'],
    ['plataforma', 's'],
    ['aeroporto', 's'],
    ['rio', 's'],
    ['ribeira', 's'],
    ['cascata', 's'],
    ['deserto', 's'],
    ['vale', 's'],
    ['duna', 's'],
    ['clareira', 's'],
    ['montanha', 's'],
    ['colina', 's'],
    ['quinta', 's'],
    ['pasto', 's'],
    ['barco', 's'],
    ['avião', 's'],
    ['aviao', 's'],
    ['aeronave', 's']
  ])]
])

function supplementTag(language, word) {
  const lang = language === 'zh' || language === 'zh-Hans' ? 'zh-Hans' : language
  const table = SUPPLEMENT.get(lang)
  if (!table) return ''
  const key = lang === 'ja' || lang === 'zh-Hans' ? String(word || '').trim() : keyOf(word)
  return table.get(key) || ''
}

/** A body part, a garment, a vehicle part, an abstract, or the same noun inside a phrase. Not a place. */
export function isNonPlaceNoun(lemma) {
  const text = String(lemma || '').trim()
  if (!text) return false
  const key = keyOf(text)
  if (NON_PLACE_NOUN.has(text) || NEVER_PLACE.has(key) || EXPLICIT_NON_PLACES.has(key)) return true
  const bits = text.split(/[\sの]+/).map(bit => bit.trim()).filter(Boolean)
  const surface = new Set(['ice', 'snow', 'sand', 'air', 'neve', 'gelo', 'areia', 'ar', 'base', 'board', 'água', 'agua', 'water'])
  if (bits.length > 1 && bits.some(bit => {
    const folded = keyOf(bit)
    if (surface.has(folded)) return false
    return NON_PLACE_NOUN.has(bit) || NEVER_PLACE.has(folded) || EXPLICIT_NON_PLACES.has(folded)
  })) {
    const head = keyOf(bits.at(-1))
    if (placeIsSure('en', head) || placeIsSure('pt', head) || LOCATION_HEAD.test(head)) return false
    return true
  }
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
  if (key.length <= 2) return false
  if (active.has(key)) return true
  for (const table of SUPPLEMENT.values()) if (table.has(key)) return true
  return false
}

/** `s` is a sure place. `a:name`, `a:object`, `a:material`, and `a:other` are ambiguous. */
export function placeTag(language, word) {
  const table = tableFor(language)
  if (!table) return ''
  const key = language === 'ja' || language === 'zh-Hans' || language === 'zh' ? String(word || '').trim() : keyOf(word)
  if (!key || POSITIONAL.has(keyOf(key)) || NEVER_PLACE.has(keyOf(key)) || isNonPlaceNoun(key)) return ''
  const extra = supplementTag(language, key)
  if (extra) return extra
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
  en: ['in', 'at', 'on', 'onto', 'upon', 'inside', 'into', 'within', 'through', 'to', 'outside', 'reaches', 'reach', 'by', 'near', 'beside', 'under', 'beneath'],
  fr: ['dans', 'au', 'aux', 'à', 'chez', 'sur'],
  pt: ['em', 'no', 'na', 'nos', 'nas', 'num', 'numa', 'ao', 'à', 'aos', 'às', 'dentro', 'entra', 'chega', 'até', 'ate', 'para', 'sob', 'junto'],
  it: ['in', 'nel', 'nello', 'nella', 'negli', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dentro', 'entra', 'entro', 'arriva', 'apre']
})
const ARTICLE = new Set(['the', 'a', 'an', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'o', 'os', 'as', 'um', 'uma', 'der', 'die', 'das', 'dem', 'den', 'ein', 'eine', 'einem', 'einer', 'einen', 'il', 'lo', 'gli', 'i', 'del', 'della', 'dei', 'delle', 'his', 'her', 'their', 'its', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'seu', 'sua', 'suo', 'mio', 'mia', 'l', 'd'])
const MODIFIER = new Set(['old', 'little', 'small', 'tiny', 'narrow', 'big', 'large', 'young', 'new', 'grand', 'petit', 'petite', 'vieux', 'vieille', 'alt', 'alte', 'alter', 'alten', 'klein', 'kleine', 'kleiner', 'kleinen', 'gross', 'große', 'grossen', 'großen', 'neu', 'neue', 'neuen', 'rot', 'rote', 'roten', 'roter', 'blau', 'blaue', 'blauen', 'vecchio', 'vecchia', 'piccolo', 'piccola', 'grande', 'velho', 'velha', 'pequeno', 'pequena', 'antico', 'antica', 'antigo', 'tin', 'early', 'late', 'same', 'other', 'next', 'meme', 'même'])
const TIME_WORD = new Set(['dawn', 'morning', 'noon', 'night', 'evening', 'dusk', 'twilight', 'sunrise', 'sunset', 'sundown', 'afternoon', 'day', 'midnight', 'nightfall', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mattina', 'mattino', 'sera', 'serata', 'pomeriggio', 'tramonto', 'mezzogiorno', 'alba', 'giorno', 'notte', 'abend', 'morgen', 'nacht', 'morgens', 'mittags', 'nachmittags', 'vormittags', 'abends', 'nachts', 'mittag', 'dämmerung', 'dammerung', 'noite', 'manha', 'manhã', 'tarde', 'dia', 'meio', 'meio-dia', 'fim', 'aube', 'soir', 'midi', 'matin', 'coucher', 'jour', 'nuit', 'soiree', 'soirée', 'apres-midi', 'après-midi', 'crépuscule', 'crepuscule', 'crepuscolo', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'early', 'late', 'madrugada', 'luar', 'anoitecer', 'entardecer', 'crepúsculo', 'noitinha', 'meia-noite'])
const PRONOUN = new Set(['she', 'he', 'they', 'her', 'his', 'him', 'them', 'we', 'you', 'elle', 'il', 'ils', 'elles', 'nous', 'vous', 'sie', 'er', 'ihn', 'ihr', 'ihnen', 'ela', 'ele', 'lei', 'lui'])
const VERB_STEM = new Set(['climb', 'walk', 'swim', 'go', 'come', 'run', 'enter', 'leave', 'reach', 'open', 'close', 'sit', 'stand', 'read', 'wait', 'look', 'turn', 'give', 'take', 'hold', 'carry', 'wear', 'unlock', 'rake', 'lower', 'boil', 'wave', 'buy', 'pay', 'drink', 'sleep', 'write', 'arrive', 'pick', 'put', 'eat', 'check', 'pour', 'lift', 'set', 'switch', 'speak', 'sitzen', 'gehen', 'kommen', 'kaufen', 'bezahlen', 'trinken', 'lesen', 'spielen', 'schlafen', 'entra', 'legge', 'scrive', 'accende', 'siede', 'compra', 'espera', 'mostra', 'apanha', 'fecha', 'come', 'marche', 'entre', 'ouvre', 'lit', 'regarde', 'attend'])
const PARTICLE = new Set(['down', 'up', 'away', 'back', 'out', 'off', 'along', 'over'])
const SKIP_HEAD = new Set(['him', 'her', 'them', 'me', 'you', 'elle', 'lui', 'pixie', 'silence', 'counter', 'pocket', 'bolso', 'sleeve', 'left', 'right', 'hair', 'cut', 'hand', 'hands', 'eye', 'eyes', 'face', 'door', 'window', 'table', 'cup', 'letter', 'water', 'tea', 'it', 'one', 'end', 'side', 'front', 'back', 'top', 'bottom', 'yeux', 'oeil', 'sourcil', 'dos', 'poche', 'tiroir', 'tiroirs', 'main', 'mains', 'cheveux', 'ink', 'drawing', 'mark', 'sketch', 'paper', 'step', 'steps', 'stair', 'stairs', 'post', 'rail', 'rails', 'drawer', 'drawers', 'coat', 'jacket', 'shirt', 'dress', 'hat', 'apron', 'manteau', 'tablier', 'mantel', 'hemd', 'kleid', 'hut', 'tasche', 'schuerze', 'schürze', 'auge', 'augen', 'gesicht', 'haar', 'kopf', 'bein', 'brief', 'stille', 'licht', 'traum', 'stimme', 'fenster', 'tisch', 'glas', 'tasse', 'sleep', 'schlaf', 'sommeil', 'sonno', 'dream', 'memory', 'thought', 'voice', 'name'])
const DESTINATION = new Set(['to', 'into', 'onto', 'dans', 'au', 'aux', 'entra', 'apre', 'ins', 'zum', 'zur', 'alla', 'al', 'allo', 'reaches', 'reach', 'chega', 'para', 'até', 'ate', 'na', 'no', 'nel', 'nella', 'im'])
const BARE_VERB_NOUN = new Set(['study', 'studies', 'studying', 'watch', 'watches', 'watching', 'look', 'looks', 'looking', 'wait', 'waits', 'waiting', 'stop', 'stops', 'stopping'])
const GENERIC_SETTING = new Set(['room', 'place', 'space', 'area', 'air', 'light', 'scene', 'sala', 'lugar', 'quarto', 'espaco', 'espaço', 'ar', 'luz', 'cena', 'setting'])
const WEAK_BEFORE = /(?:^|[^\p{L}])(?:behind|below|under|above|beside|near|across|of|from|about|vers|près|pres|hinter|unter|neben|vicino|sotto|sopra|perto|atrás|atras)\s+(?:the\s+|a\s+|an\s+|le\s+|la\s+|les\s+|il\s+|lo\s+|l['’])?$/iu
const MATERIAL_BEFORE = /(?:en|of|de|aus|di|von)\s+$/iu
const OBJECT_AFTER = /^(?:\s+\p{L}[\p{L}'’-]*){0,3}\s+(?:window|door|table|wall|sill|pane|glass|frame|ledge|counter|desk|shutter|fenêtre|fenetre|porte|fenster|finestra|窗户|窗|窓)/iu

function displayName(lemma) {
  return String(lemma || '').replace(/^\p{Ll}/u, char => char.toUpperCase())
}

const SURFACE_HEAD = /^(?:água|agua|water|neve|snow|gelo|ice|areia|sand)$/iu

/** Água, snow, and ice are not the place. A waterfall beat keeps the waterfall. A compound such as escola de surf stays whole. */
export function normalizePlaceName(lemma, language = 'en') {
  const text = tidyPlaceLemma(lemma)
  const bits = text.split(/\s+/).filter(Boolean)
  if (!bits.length) return ''
  if (bits.length === 1 && SURFACE_HEAD.test(bits[0])) return ''
  if (SURFACE_HEAD.test(bits[0])) {
    const prepAt = bits.findIndex(bit => PLACE_PREP.has(bit.toLowerCase()))
    if (prepAt < 0) return displayName(text)
    const inner = bits.slice(prepAt + 1).find(bit => !SURFACE_HEAD.test(bit) && !PLACE_PREP.has(bit.toLowerCase()) && (placeIsSure(language, bit) || placeIsSure('en', bit) || placeIsSure('pt', bit) || locationShaped(bit)))
    return inner ? displayName(inner) : ''
  }
  return displayName(text)
}

function takeCompound(words, tokens, index, lang) {
  const folded = bareToken(tokens[index]?.[0] || '').toLowerCase()
  if (!/^(?:de|do|da|dos|das|of)$/i.test(folded) || !words.length) return null
  let cursor = index + 1
  while (cursor < tokens.length && ARTICLE.has(bareToken(tokens[cursor][0]).toLowerCase())) cursor += 1
  if (cursor >= tokens.length) return null
  const next = bareToken(tokens[cursor][0])
  const nextFold = next.toLowerCase()
  if (!next || next.length < 3 || isVerbHead(nextFold) || TIME_WORD.has(nextFold) || PRONOUN.has(nextFold)) return null
  const head = words.map(item => item.word).join(' ')
  const surface = SURFACE_HEAD.test(words.at(-1).word)
  const nextPlace = placeIsSure(lang, nextFold) || placeIsSure('en', nextFold) || placeIsSure('pt', nextFold) || locationShaped(next)
  const headTag = placeTag(lang, head) || placeTag('en', head) || placeTag('pt', head)
  const headPlace = headTag === 's' || locationShaped(head) || (headTag.startsWith('a:') && !/^a:(?:object|material|garment|adjective|determiner)$/.test(headTag))
  if (surface && nextPlace) return { words: [{ word: next, at: tokens[cursor].index }], end: cursor }
  if (isVerbHead(nextFold) || isModifierWord(next, lang) || /^(?:small|little|tiny|big|large|old|new|young|other|same|pequeno|pequena|grande|velho|velha)$/i.test(nextFold)) return null
  if (headPlace && !isNonPlaceNoun(next) && nextFold.length >= 3 && !/^(?:cantil|martelo|cane|tool|faca|knife|hammer|ladder|escada)$/i.test(nextFold)) {
    return {
      words: [...words, { word: tokens[index][0], at: tokens[index].index }, { word: next, at: tokens[cursor].index }],
      end: cursor
    }
  }
  return null
}

const DOOR_WORD = /^(?:porta|portas|portão|portao|door|doors|gate|gates|janela|janelas|window|windows|drawer|gaveta)$/iu

/** "opens the hut" and "abre a porta da igreja" adopt the place that is entered. A bare door does not. */
export function enteredPlace(sentence, language = 'en') {
  const source = String(sentence || '')
  const door = source.match(/(?<![\p{L}])(?:opens?|opened|opening|abre|abrem|abriu|abrir)(?![\p{L}])\s+(?:the\s+|a\s+|an\s+|o\s+|os\s+|as\s+|uma\s+|um\s+)?(?:porta|portas|portão|portao|door|doors|gate|gates)\s+(?:de|do|da|dos|das|of)\s+(?:o\s+|a\s+|the\s+|os\s+|as\s+)?([\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3})/iu)
  if (door) {
    const name = settingName(door[1], language) || (placeIsSure(language, door[1]) || placeIsSure('pt', door[1]) || placeIsSure('en', door[1]) ? displayName(door[1]) : '')
    if (name && !isRejectedPlace(name)) return name
  }
  const open = source.match(/(?<![\p{L}])(?:opens?|opened|opening|abre|abrem|abriu)(?![\p{L}])\s+(?:the\s+|a\s+|an\s+|o\s+|a\s+|uma\s+|um\s+)?((?:small\s+|little\s+|tiny\s+|old\s+|pequena?\s+|velha?\s+)?[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2})/iu)
  if (!open) return ''
  const raw = tidyPlaceLemma(open[1])
  if (!raw || DOOR_WORD.test(raw.split(/\s+/).at(-1) || '')) return ''
  const name = settingName(raw, language) || openedCompound(raw, language)
  if (!name || DOOR_WORD.test(name) || (isRejectedPlace(name) && !openedCompound(raw, language))) return ''
  return name
}

/** "abre a escola de surf" keeps the compound. The head is the place; the tail is not cut off. */
function openedCompound(raw, language) {
  const bits = String(raw || '').split(/\s+/).filter(Boolean)
  const join = bits.findIndex(bit => /^(?:de|do|da|dos|das|of)$/i.test(bit))
  if (join <= 0 || join >= bits.length - 1) return ''
  const head = bits[0]
  const other = language === 'pt' ? 'en' : 'pt'
  const tag = placeTag(language, head) || placeTag(other, head)
  const headPlace = tag === 's' || locationShaped(head) || (String(tag).startsWith('a:') && !/^a:(?:object|material|garment|adjective|determiner)$/.test(tag))
  if (!headPlace || isNonPlaceNoun(head)) return ''
  const phrase = tidyPlaceLemma(bits.slice(0, join + 2).join(' '))
  if (!phrase || DOOR_WORD.test(phrase.split(/\s+/).at(-1) || '')) return ''
  return displayName(phrase)
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

const PHRASE_STOP = new Set(['behind', 'below', 'under', 'above', 'beside', 'near', 'across', 'of', 'from', 'about', 'with', 'and', 'or', 'then', 'while', 'when', 'where', 'who', 'that', 'de', 'do', 'da', 'di', 'von', 'des', 'du', 'del', 'della', 'loin', 'toujours', 'meme', 'même', 'encore', 'aussi', 'still', 'just', 'very', 'without', 'around', 'during', 'sans', 'ohne', 'com', 'até', 'ate', 'para', 'por', 'pelo', 'pela', 'sem', 'sobre', 'onde', 'quando', 'outside', 'fora'])
const PLACE_PREP = new Set(['com', 'with', 'de', 'do', 'da', 'dos', 'das', 'of', 'em', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'into', 'onto', 'para', 'por', 'pelo', 'pela', 'à', 'ao', 'aos', 'às', 'a', 'na', 'no', 'nas', 'nos', 'num', 'numa', 'upon', 'dentro', 'sobre', 'sem', 'without', 'and', 'e', 'or'])
const MANNER_PLACE = new Set(['hurry', 'rush', 'haste', 'panic', 'flash', 'moment', 'while', 'vain', 'turn', 'fact', 'silence', 'jest', 'earnest', 'secret', 'order', 'shape', 'row', 'pressa', 'silencio', 'silêncio', 'cena', 'scene', 'vista', 'view', 'sight', 'cue', 'jeito', 'modo', 'vez', 'aperto'])
const STATE_ADJ = new Set(['empty', 'quiet', 'silent', 'still', 'calm', 'dark', 'bright', 'vazio', 'vazia', 'calmo', 'calma', 'escuro', 'escura', 'deserto', 'deserta'])
const GARMENT_HEAD = /^(?:[\p{L}'’-]+\s+){0,3}(?:cardigans?|waistcoats?|vests?|blouses?|trousers|pants|jeans|coletes?|camisolas?|saias?|calças|calcas|vestidos?|casacos?|jaquetas?|blusas?|sweaters?|coats?|jackets?|dresses?|shirts?|aprons?|scarves?|scarfs?|hats?|caps?|boots?|cloaks?|robes?|hoodies?|uniforms?|skirts?|peacoats?|overcoats?|cardigãs?|pulôveres?|pullovers?)$/iu
const BODY_HEAD = /^(?:[\p{L}'’-]+\s+){0,3}(?:beards?|barbas?|hair|cabelo|cabelos|braids?|tranças|trancas|trança|tranca|buns?|coques?|curls?|faces?|rostos?|hands?|mãos|maos|eyes?|olhos)$/iu
const OBJECT_HEAD = /^(?:[\p{L}'’-]+\s+){0,3}(?:watch(?:es)?|relógio|relogio|relógios|relogios|cases?|estojos?|notebooks?|cadernos?|caderno|newspapers?|jornais|jornal|books?|livros?|letters?|cartas?|chairs?|cadeiras?|cadeira|stools?|banquinhos?|benches?|bancos?|scales?|balanças|balancas|balança|windows?|janelas?|janela|doors?|portas?|tables?|mesas?|bags?|mochilas?|mochila|purses?|wallets?|phones?|telefones?|canes?|bengalas?|bengala|facões|facoes|facão|facao|facas?|knife|knives|cups?|copos?|bottles?|lamps?|candeeiros?|pianos?|lids?|tampas?)$/iu
const VERB_PLACE = /^(?:correr|corre|correndo|running|runs|run|tests?|testing|stepping|arrives?|arriving|walks?|walking|waits?|waiting|hurrying|hurry)$/iu
const LOCATION_HEAD = /(?:room|house|hall|shop|yard|barn|stable|stables|cottage|station|kitchen|deck|quay|pier|dock|warehouse|office|studio|gallery|church|caravan|vineyard|compartment|lighthouse|market|forest|beach|cafe|café|loft|attic|cellar|basement|porch|balcony|terrace|garden|courtyard|plaza|square|street|bridge|tower|museum|library|theatre|theater|cinema|hotel|hangar|garage|workshop|factory|farm|field|cliff|shore|harbour|harbor|port|marina|yacht|ship|boat|ferry|platform|lobby|corridor|hallway|gate|store|bakery|bar|pub|school|hospital|clinic|archive|cave|tunnel|cabin|hut|tent|camp|villa|apartment|flat|conservatory|atrium|study|pantry|greenhouse|sea|ocean|kiln|stage|sala|varanda|conves|convés|cais|loja|armazem|armazém|floresta|mercado|oficina|igreja|estacao|estação|falesia|falésia|cozinha|patio|pátio|quintal|galpao|galpão|adega|biblioteca|teatro|porao|porão|sotao|sótão|praia|miradouro|vinha|estabulo|estábulo|iate|navio|barco|galeria|estalagem|estufa|celeiro|tombadilho|camarote|vagao|vagão|carruagem|doca|atelier|ateliê|porteira|portao|portão|bilheteira|mar|átrio|atrio|palco|forno|fornalha|olaria|steps|stairs)$/iu
/** Locatives that can name an unlisted setting, not only to/into/na/no. */
const LOOSE_LOCATIVE = new Set(['in', 'at', 'on', 'inside', 'through', 'within', 'em', 'na', 'no', 'nos', 'nas', 'num', 'numa', 'ao', 'à', 'aos', 'às', 'dentro', 'sob'])
const SOFT_PREP = new Set(['by', 'near', 'beside', 'under', 'beneath', 'sob', 'junto'])
const CONTRACT = new Set(['do', 'da', 'dos', 'das', 'del', 'della', 'dello', 'dei', 'du', 'des'])

function placeWords(lemma) {
  return keyOf(lemma).split(/\s+/).filter(Boolean)
}

/** Drop a trailing tool phrase (`com facão`, `with a cane`) and a dangling preposition. */
export function tidyPlaceLemma(lemma) {
  let text = String(lemma || '').replace(/\s+/g, ' ').trim()
  text = text.replace(/\s+(?:com|with)\s+.+$/iu, '')
  let words = text.split(/\s+/).filter(Boolean)
  while (words.length > 1 && PLACE_PREP.has(words.at(-1).toLowerCase())) words.pop()
  while (words.length > 1 && STATE_ADJ.has(words[0].toLowerCase())) words.shift()
  return words.join(' ')
}

function locationShaped(lemma) {
  const text = keyOf(tidyPlaceLemma(lemma))
  if (!text) return false
  if (placeTag('en', text) === 's' || placeTag('pt', text) === 's') return true
  const bits = text.split(/\s+/)
  if (bits.length === 1 && /^(?:steps?|stairs?)$/u.test(text)) return false
  return LOCATION_HEAD.test(bits.at(-1))
}

function indefiniteArticle(word, language) {
  const article = String(word || '').toLowerCase()
  if (language === 'pt') return article === 'um' || article === 'uma'
  return article === 'a' || article === 'an' || article === 'um' || article === 'uma'
}

function definiteArticle(word, language) {
  const article = String(word || '').toLowerCase()
  if (language === 'pt' && article === 'a') return true
  return /^(?:the|o|os|as|le|la|les|il|lo)$/i.test(article)
}

/** A sure place, or a compound whose head is a real setting. A bare room, a watch, and a verb are not. */
export function settingName(lemma, language = 'en') {
  const text = tidyPlaceLemma(lemma)
  if (!text || isRejectedPlace(text)) return ''
  const lang = language === 'zh' ? 'en' : (language || 'en')
  if (GENERIC_SETTING.has(keyOf(text))) return ''
  if (placeTag(lang, text) === 's' || placeTag(lang === 'pt' ? 'en' : 'pt', text) === 's') return displayName(text)
  if (locationShaped(text) && !GENERIC_SETTING.has(keyOf(text.split(/\s+/).at(-1)))) return displayName(text)
  if (locationShaped(text) && text.split(/\s+/).length > 1) return displayName(text)
  return ''
}

/** The next word is part of the noun, not the verb that follows a place subject. */
export function extendsPlace(word, language = 'en') {
  const key = keyOf(word)
  if (!key || /^(?:is|are|was|were|está|esta|estão|estao|fica|ficam|são|sao)$/iu.test(key)) return false
  if (placeTag(language, key) || placeTag('en', key) || placeTag('pt', key)) return true
  return isRejectedPlace(key) && !VERB_PLACE.test(key)
}

const MOVE_VERB = /(?<![\p{L}])(?:cross(?:es|ed|ing)?|wade(?:s|d|ing)?|stride(?:s|d|ing)?|swim(?:s|ming)?|sail(?:s|ed|ing)?|float(?:s|ed|ing)?|return(?:s|ed|ing)?|go(?:es|ing)?|went|board(?:s|ed|ing)?|pilot(?:s|ed|ing)?|pilota(?:m|r|ndo|ram)?|embarca(?:m|r|ndo|ram)?|atravessa(?:m|r|ndo)?|nada(?:m|r|ndo)?|caminha(?:m|r|ndo)?|anda(?:m|r|ndo)?|corre(?:m|r|ndo)?|volta(?:m|r|ndo)?|vai|vão|vao|chega(?:m|r|ndo)?|entra(?:m|r|ndo)?|arrive(?:s|d)?|arriving|segue(?:m)?|sobe(?:m)?|desce(?:m)?)(?![\p{L}])/giu
const MOVE_SKIP = new Set(['the', 'a', 'an', 'o', 'os', 'as', 'um', 'uma', 'his', 'her', 'their', 'seu', 'sua', 'to', 'into', 'onto', 'through', 'in', 'on', 'at', 'para', 'até', 'ate', 'no', 'na', 'nos', 'nas', 'em', 'ao', 'à', 'aos', 'às', 'pelo', 'pela', 'pelos', 'pelas', 'for', 'over', 'along', 'por', 'de', 'do', 'da', 'dos', 'das', 'up', 'down', 'back'])

function placeFromMoveWords(words, language) {
  for (let size = Math.min(4, words.length); size >= 1; size -= 1) {
    const phrase = words.slice(0, size).join(' ')
    const next = words[size]
    if (next && extendsPlace(next, language)) continue
    const name = settingName(phrase, language)
    if (name) return name
  }
  return ''
}

function surePlaceWord(word, lang) {
  const folded = String(word || '').toLowerCase()
  if (!folded) return false
  return placeTag(lang, folded) === 's' || placeTag('en', folded) === 's' || placeTag('pt', folded) === 's'
}

const FLIGHT_VERB = /(?<![\p{L}])(?:descol(?:a|am|ar|ou|ando|aram)|voa|voam|voar|voando|voou|take(?:s|n)?\s+off|took\s+off|taking\s+off|fl(?:y|ies|ew)|flying)(?![\p{L}])/iu
const BOARD_VERB = /(?<![\p{L}])(?:board(?:s|ed|ing)?|embarc(?:a|am|ar|ou|ando|aram))(?![\p{L}])/iu
const AIRCRAFT_NOUN = /(?<![\p{L}])(?:aviões|avioes|avião|aviao|aeronaves|aeronave|airplanes?|aircraft|planes?|jets?)(?![\p{L}])/iu
const OTHER_VEHICLE = /(?<![\p{L}])(?:barcos?|boats?|ships?|navios?|helicópteros?|helicopteros?|helicopters?|comboios?|trains?|carros?|iate|yachts?|ferries|ferry)(?![\p{L}])/iu

/** Takeoff, flight, or boarding puts the scene in the aircraft and keeps it there. A river underneath does not. */
export function aircraftPlace(sentence, language = 'en') {
  const text = String(sentence || '')
  if (!text || (OTHER_VEHICLE.test(text) && !AIRCRAFT_NOUN.test(text))) return ''
  const flight = FLIGHT_VERB.test(text)
  const boardsCraft = BOARD_VERB.test(text) && AIRCRAFT_NOUN.test(text)
  if (!flight && !boardsCraft) return ''
  return language === 'pt' ? 'Avião' : 'Plane'
}

/** The place a movement verb reaches. A later path noun wins over the vehicle. "on a ladder" does not replace the glacier. */
export function movementPlace(sentence, language = 'en') {
  const source = String(sentence || '')
  let best = ''
  for (const match of source.matchAll(MOVE_VERB)) {
    const after = source.slice(match.index + match[0].length).replace(/[.;:!?].*$/u, '')
    const words = after.match(/[\p{L}][\p{L}'’-]*/gu) || []
    const content = []
    let hops = 0
    for (const word of words) {
      if (hops > 8) break
      hops += 1
      const folded = word.toLowerCase()
      if (MOVE_SKIP.has(folded)) {
        const sofar = placeFromMoveWords(content, language)
        if (sofar) best = sofar
        content.length = 0
        continue
      }
      content.push(word)
      if (content.length >= 4) break
    }
    const name = placeFromMoveWords(content, language)
    if (name) best = name
  }
  return best
}

/**
 * Clothing, body or hair, handheld objects, manner, idioms, verbs, and labels that
 * end on a preposition are not settings. A lexicon tag does not override this.
 */
export function isRejectedPlace(lemma) {
  const text = tidyPlaceLemma(lemma)
  if (!text) return true
  const bits = placeWords(text).filter(bit => !ARTICLE.has(bit) && !PLACE_PREP.has(bit))
  const head = bits.at(-1) || ''
  const content = bits.join(' ')
  if (!head || !content) return true
  if (isNonPlaceNoun(head) || isNonPlaceNoun(content)) return true
  if (MANNER_PLACE.has(keyOf(content)) || MANNER_PLACE.has(head) || PLACE_PREP.has(head)) return true
  if (GARMENT_HEAD.test(content) || BODY_HEAD.test(content) || OBJECT_HEAD.test(content)) return true
  if (VERB_PLACE.test(head) || VERB_PLACE.test(keyOf(content))) return true
  if (bits.every(bit => MODIFIER.has(bit) || STATE_ADJ.has(bit))) return true
  if (/^(?:its|his|her|their|seu|sua|meu|minha|our|your)\b/iu.test(content) && placeTag('en', head) !== 's' && placeTag('pt', head) !== 's') return true
  return false
}

const INTERIOR_HEAD = /^(?:cave|cavern|grotto|lodge|hut|cabin|cottage|room|kitchen|church|cellar|basement|attic|bedroom|hall|oficina|gruta|caverna|cabana|casa|quarto|sala|salão|salao|igreja|adega|porão|porao|sótão|sotao|celeiro|lobby|corridor|hallway|suite|suíte)$/iu

export function isInteriorPlace(name) {
  const bits = keyOf(name).split(/\s+/).filter(Boolean)
  const head = bits.at(-1) || ''
  const phrase = bits.join(' ')
  return INTERIOR_HEAD.test(head) || INTERIOR_HEAD.test(phrase) || /(?:cave|caverna|gruta)/.test(phrase)
}

/** A leave with no destination. Returns the previous outdoor place, an empty string to clear the interior, or null when the sentence does not leave. */
export function leaveTarget(sentence, current, outside) {
  const source = String(sentence || '')
  if (!/(?<![\p{L}])(?:leaves?|leaving|left|exits?|exiting|sai|saem|saindo|sair)(?![\p{L}])/iu.test(source)) return null
  if (/(?<![\p{L}])(?:leaves?|left|exits?|sai|saem)\s+(?:the\s+|o\s+|a\s+|os\s+|as\s+|um\s+|uma\s+)?[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3}\s+(?:for|to|into|onto|para|até|ate|in|na|no)\s+/iu.test(source)) return null
  const object = source.match(/(?<![\p{L}])(?:leaves?|left|exits?|sai|saem)\s+(?:the\s+|o\s+|a\s+|os\s+|as\s+|um\s+|uma\s+)?([\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,2})/iu)
  const left = object ? object[1] : ''
  const placeLike = left && (settingName(left, 'en') || settingName(left, 'pt') || isInteriorPlace(left) || keyOf(left) === keyOf(current || ''))
  if (left && !placeLike) return null
  const back = String(outside || '')
  if (back && keyOf(back) !== keyOf(current || '')) return back
  return ''
}

/** Walking into snow or water leaves a stage. The surface is the setting of that beat. */
export function surfaceShift(sentence, current) {
  const from = keyOf(current)
  const fromStage = /^(?:stage|palco)$/iu.test(from)
  const fromSurface = /^(?:snow|water|ice|neve|água|agua|gelo)$/iu.test(from)
  if (!fromStage && !fromSurface) return ''
  if (!/(?<![\p{L}])(?:walks?|walked|walking|wades?|waded|wading|enters?|entered|cross(?:es|ed|ing)?|goes|went|go|entra|entram|caminha|nada|atravessa|desce|sobe)(?![\p{L}])/iu.test(sentence)) return ''
  const match = String(sentence || '').match(/(?<![\p{L}])(snow|water|ice|neve|águas?|aguas?|gelo)(?![\p{L}])/iu)
  if (!match) return ''
  const word = match[1].toLowerCase()
  const name = word.startsWith('águ') || word.startsWith('agu') ? 'Água' : word === 'neve' ? 'Neve' : word === 'gelo' ? 'Gelo' : word === 'snow' ? 'Snow' : word === 'ice' ? 'Ice' : word === 'water' ? 'Water' : ''
  if (!name || keyOf(name) === from) return ''
  return name
}

/** "Livro na loja" is the shop. The object in front of the preposition is not the place. */
export function objectHostPlace(lemma, language = 'en') {
  const bits = tidyPlaceLemma(lemma).split(/\s+/).filter(Boolean)
  const at = bits.findIndex(bit => /^(?:na|no|nos|nas|em|in|on|at|dentro)$/i.test(bit))
  if (at <= 0) return ''
  const object = bits.slice(0, at).join(' ')
  const host = bits.slice(at + 1).join(' ')
  if (!object || !host) return ''
  if (!isRejectedPlace(object) && !OBJECT_HEAD.test(object)) return ''
  return settingName(host, language) || ''
}

export function finishCarriedPlace(sentence, where, previous, outside) {
  let next = where || ''
  const host = objectHostPlace(next, 'en') || objectHostPlace(next, 'pt')
  if (host) next = host
  const left = leaveTarget(sentence, previous, outside)
  if (left !== null) next = left
  const surface = left === null ? surfaceShift(sentence, previous || where) : ''
  if (surface) next = surface
  let nextOutside = outside || ''
  if (next && !isInteriorPlace(next)) nextOutside = next
  return { where: next, outside: nextOutside }
}

function stageIsIncidental(source, lemma, at) {
  if (!/^(?:stage|palco)$/i.test(keyOf(lemma))) return false
  const before = String(source || '').slice(Math.max(0, at - 24), at)
  if (/(?:this|that|next|neste|nessa|neste|este|esse|essa)\s+$/iu.test(before)) return true
  const after = String(source || '').slice(at + String(lemma).length, at + String(lemma).length + 28)
  return /^\s+(?:light|lights|luz|door|doors|porta|left|right|manager|direction)/iu.test(after)
}

/** The first real place in the sentence. Leaving without a destination does not keep the interior. */
export function preferPlaceHead(heads, sentence = '') {
  const list = (heads || []).filter(Boolean)
  if (!list.length) return null
  const leaving = /(?<![\p{L}])(?:leaves?|leaving|left|exits?|sai|saem)(?![\p{L}])/iu
  if (leaving.test(sentence)) {
    const dest = list.filter(head => {
      const before = String(sentence).slice(Math.max(0, (head.index || 0) - 56), head.index || 0)
      return !/(?<![\p{L}])(?:leaves?|left|exits?|sai|saem)\s+(?:the\s+|a\s+|an\s+|o\s+|os\s+|as\s+|um\s+|uma\s+)?$/iu.test(before)
    })
    if (dest.length) return dest[dest.length - 1]
    return null
  }
  return list[0]
}

/** The noun phrase after a strong preposition. A compound stays whole. A time word or a verb is never the place. */
export function locativeHeads(text, language) {
  const lang = language === 'zh' ? 'zh-Hans' : language
  const source = String(text || '')
  const preps = new Set(STRONG[lang] || [])
  if (!preps.size || !source) return []
  const tokens = [...source.matchAll(/[\p{L}][\p{L}'’-]*/gu)]
  const heads = []
  for (let index = 0; index < tokens.length; index += 1) {
    if (!preps.has(tokens[index][0].toLowerCase())) continue
    let cursor = index + 1
    let possessive = false
    let indefinite = false
    let definite = false
    while (cursor < tokens.length && (ARTICLE.has(bareToken(tokens[cursor][0]).toLowerCase()) || preps.has(tokens[cursor][0].toLowerCase()) || CONTRACT.has(tokens[cursor][0].toLowerCase()))) {
      const article = bareToken(tokens[cursor][0])
      if (/^(?:son|sa|ses|his|her|their|its|seu|sua|suo|mio|mia|mon|ma|mes)$/i.test(article)) possessive = true
      if (CONTRACT.has(article.toLowerCase())) definite = true
      if (indefiniteArticle(article, lang)) indefinite = true
      if (definiteArticle(article, lang)) definite = true
      cursor += 1
    }
    let modifiers = 0
    while (cursor < tokens.length && modifiers < 3 && isModifierWord(bareToken(tokens[cursor][0]), lang)) {
      const ahead = [0, 1].map(offset => bareToken(tokens[cursor + offset]?.[0] || '')).filter(Boolean).join(' ')
      if (ahead && placeTag(lang, ahead) === 's') break
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
      if (/^(?:de|do|da|dos|das|of)$/i.test(folded)) {
        const compound = takeCompound(words, tokens, look, lang)
        if (compound) {
          words.splice(0, words.length, ...compound.words)
          look = compound.end
          break
        }
      }
      if (preps.has(folded) || PHRASE_STOP.has(folded) || PRONOUN.has(folded) || WEAK_BEFORE.test(` ${folded} `)) break
      if (words.length && isVerbHead(upcoming) && !placeTag(lang, `${words.map(item => item.word).join(' ')} ${word}`)) break
      const capitalName = word[0] !== word[0].toLowerCase() && word[0] === word[0].toUpperCase()
      if (!words.length && TIME_WORD.has(folded)) break
      if (!words.length && (isVerbHead(folded, upcoming) || ARTICLE.has(folded) || isModifierWord(word, lang) || (capitalName && !surePlaceWord(folded, lang)))) {
        const sureStart = isModifierWord(word, lang) && placeTag(lang, [word, upcoming].filter(Boolean).join(' ')) === 's'
        if (!sureStart) continue
      }
      if (POSITIONAL.has(folded)) {
        const onlyModifiers = words.length > 0 && words.every(item => MODIFIER.has(item.word.toLowerCase()) || STATE_ADJ.has(item.word.toLowerCase()))
        if (onlyModifiers) words.push({ word, at: tokens[look].index })
        break
      }
      if (SKIP_HEAD.has(folded) && placeTag(lang, folded) !== 's' && placeTag('en', folded) !== 's' && placeTag('pt', folded) !== 's') {
        const phrase = [...words.map(item => item.word), word].join(' ')
        if (placeTag(lang, phrase) === 's') {
          words.push({ word, at: tokens[look].index })
          continue
        }
        if (words.length && /^(?:steps?|stairs?)$/i.test(folded)) words.push({ word, at: tokens[look].index })
        break
      }
      if ((capitalName && !surePlaceWord(folded, lang)) || TIME_WORD.has(folded) || isVerbHead(folded, upcoming) || ARTICLE.has(folded) || NEVER_PLACE.has(folded) || word.length < 3) break
      words.push({ word, at: tokens[look].index })
    }
    if (!words.length || possessive) continue
    if (words.some(item => isNonPlaceNoun(item.word))) {
      const phrase = words.map(item => item.word).join(' ')
      if (placeTag(lang, phrase) !== 's' && !locationShaped(phrase)) continue
    }
    if (words.some(item => {
      const folded = item.word.toLowerCase()
      return PRONOUN.has(folded) || TIME_WORD.has(folded) || isVerbHead(item.word)
    })) continue
    const lemma = tidyPlaceLemma(words.map(item => item.word).join(' '))
    if (!lemma || isRejectedPlace(lemma) || /^(?:com|with|wearing)\b/iu.test(lemma)) continue
    if (words.length === 1 && BARE_VERB_NOUN.has(words[0].word.toLowerCase()) && !definite) continue
    let tag = placeTag(lang, lemma)
    if ((!tag || UNUSABLE.has(tag)) && words.length > 1) tag = placeTag(lang, words.at(-1).word)
    if (tag && UNUSABLE.has(tag)) continue
    if (!tag) {
      const adopts = DESTINATION.has(prep) || LOOSE_LOCATIVE.has(prep)
      if (!adopts) continue
      if (indefinite && !locationShaped(lemma)) continue
      if (!DESTINATION.has(prep) && words.length === 1 && !locationShaped(lemma) && !definite) continue
      const namedPerson = words.every(item => item.word[0] !== item.word[0].toLowerCase())
      if (namedPerson) continue
      tag = 'unlisted'
    }
    if (SOFT_PREP.has(prep) && tag !== 's' && !locationShaped(lemma)) continue
    const toward = new Set(['to', 'into', 'onto', 'zum', 'zur', 'ins', 'vers', 'para', 'verso', 'até', 'ate'])
    const arrived = /(?:^|[^\p{L}])(?:go(?:es|ing|ne)?|went|return(?:s|ed|ing)?|board(?:s|ed|ing)?|pilot(?:s|ed|ing)?|pilota(?:m|r|ndo)?|embarca(?:m|r|ndo)?|walk(?:s|ed|ing)?|climb(?:s|ed|ing)?|enter(?:s|ed|ing)?|reach(?:es|ed|ing)?|come[s]?|came|lead(?:s|ing)?|climb(?:s|ed|ing)?|arriv(?:e|es|ed|ing)|step(?:s|ped)?|descend(?:s|ed|ing)?|wade(?:s|d|ing)?|cross(?:es|ed|ing)?|head(?:s|ed|ing)?|swim(?:s|ming)?|sail(?:s|ed|ing)?|float(?:s|ed|ing)?|crawl(?:s|ed|ing)?|creep(?:s|ing)?|crept|duck(?:s|ed|ing)?|squeeze[sd]?|squeezing|slide[sd]?|sliding|clamber(?:s|ed|ing)?|rasteja(?:m|r|ndo)?|geht|gehen|ging|komm(?:t|en)|kam|betritt|betrat|erreicht|entra(?:r|ndo)?|chega|vai|va|arrive|entre|descend|monte|caminha(?:m|r|ndo)?|anda(?:m|r|ndo)?|corre(?:m|r|ndo)?|volta(?:m|r|ndo)?|segue(?:m)?|sobe(?:m)?|desce(?:m)?|nada(?:m|r|ndo)?|atravessa(?:m|r|ndo)?|carrega(?:m|r|ndo)?|leva(?:m|r|ndo)?|traz|carries|carrying|brings|bring|走进|来到|回到|进了)(?![\p{L}])/iu
    const moves = !toward.has(prep) || arrived.test(source.slice(Math.max(0, tokens[index].index - 48), words.at(-1).at + words.at(-1).word.length))
    const beside = /^(?:by|near|beside)$/i.test(prep)
    const spoken = normalizePlaceName(lemma, lang)
    if (!spoken || stageIsIncidental(source, spoken, words[0].at)) continue
    heads.push({ lemma: spoken, name: spoken, tag, index: words[0].at, locative: true, moves, soft: beside })
    index = cursor
  }
  const directMove = new Set(['enter', 'enters', 'entered', 'entering', 'arrive', 'arrives', 'arrived', 'arriving', 'reach', 'reaches', 'reached', 'board', 'boards', 'boarded', 'boarding', 'return', 'returns', 'returned', 'returning', 'go', 'goes', 'went', 'pilot', 'pilots', 'piloted', 'pilota', 'pilotam', 'embarca', 'embarcam', 'embarcar', 'atravessa', 'atravessar', 'volta', 'voltam', 'vai', 'vao', 'vão', 'entra', 'entram', 'entrou', 'entrar', 'entrando', 'chega', 'chegam', 'chegou', 'chegar', 'chegando'])
  const stepPrep = new Set(['to', 'into', 'onto', 'upon', 'on', 'in', 'at', 'inside', 'through', 'no', 'na', 'nos', 'nas', 'em', 'num', 'numa', 'ao', 'à', 'aos', 'às', 'para', 'a', 'até', 'ate'])
  for (let index = 0; index < tokens.length; index += 1) {
    if (!directMove.has(tokens[index][0].toLowerCase())) continue
    let cursor = index + 1
    let hops = 0
    let indefinite = false
    let definite = false
    while (cursor < tokens.length && hops < 3 && (stepPrep.has(tokens[cursor][0].toLowerCase()) || ARTICLE.has(bareToken(tokens[cursor][0]).toLowerCase()))) {
      const article = bareToken(tokens[cursor][0])
      if (indefiniteArticle(article, lang)) indefinite = true
      if (definiteArticle(article, lang)) definite = true
      cursor += 1
      hops += 1
    }
    let modifiers = 0
    while (cursor < tokens.length && modifiers < 3 && isModifierWord(bareToken(tokens[cursor][0]), lang)) {
      cursor += 1
      modifiers += 1
    }
    if (cursor >= tokens.length) continue
    const words = []
    for (let look = cursor; look < Math.min(tokens.length, cursor + 5); look += 1) {
      const word = bareToken(tokens[look][0])
      const folded = word.toLowerCase()
      const upcoming = bareToken(tokens[look + 1]?.[0] || '').toLowerCase()
      if (/^(?:de|do|da|dos|das|of)$/i.test(folded)) {
        const compound = takeCompound(words, tokens, look, lang)
        if (compound) {
          words.splice(0, words.length, ...compound.words)
          look = compound.end
          break
        }
      }
      if (preps.has(folded) || stepPrep.has(folded) || PHRASE_STOP.has(folded) || PRONOUN.has(folded)) break
      if (words.length && isVerbHead(upcoming) && !placeTag(lang, `${words.map(item => item.word).join(' ')} ${word}`)) break
      const capitalName = word[0] !== word[0].toLowerCase() && word[0] === word[0].toUpperCase()
      if (!words.length && TIME_WORD.has(folded)) break
      if (!words.length && (isVerbHead(folded, upcoming) || ARTICLE.has(folded) || isModifierWord(word, lang) || (capitalName && !surePlaceWord(folded, lang)))) {
        const sureStart = isModifierWord(word, lang) && placeTag(lang, [word, upcoming].filter(Boolean).join(' ')) === 's'
        if (!sureStart) continue
      }
      if (POSITIONAL.has(folded)) {
        const onlyModifiers = words.length > 0 && words.every(item => MODIFIER.has(item.word.toLowerCase()) || STATE_ADJ.has(item.word.toLowerCase()))
        if (onlyModifiers) words.push({ word, at: tokens[look].index })
        break
      }
      if (SKIP_HEAD.has(folded) && placeTag(lang, folded) !== 's' && placeTag('en', folded) !== 's' && placeTag('pt', folded) !== 's') {
        if (words.length && /^(?:steps?|stairs?)$/i.test(folded)) words.push({ word, at: tokens[look].index })
        break
      }
      if ((capitalName && !surePlaceWord(folded, lang)) || TIME_WORD.has(folded) || isVerbHead(folded, upcoming) || ARTICLE.has(folded) || NEVER_PLACE.has(folded) || word.length < 3) break
      words.push({ word, at: tokens[look].index })
    }
    if (!words.length) continue
    if (words.some(item => isNonPlaceNoun(item.word))) {
      const phrase = words.map(item => item.word).join(' ')
      if (placeTag(lang, phrase) !== 's' && !locationShaped(phrase)) continue
    }
    const lemma = tidyPlaceLemma(words.map(item => item.word).join(' '))
    if (!lemma || isRejectedPlace(lemma) || /^(?:com|with|wearing)\b/iu.test(lemma)) continue
    if (words.length === 1 && BARE_VERB_NOUN.has(words[0].word.toLowerCase()) && !definite) continue
    if (indefinite && !locationShaped(lemma) && !placeTag(lang, lemma)) continue
    if (heads.some(head => head.index === words[0].at)) continue
    let tag = placeTag(lang, lemma)
    if ((!tag || UNUSABLE.has(tag)) && words.length > 1) tag = placeTag(lang, words.at(-1).word)
    if (tag && UNUSABLE.has(tag)) continue
    if (!tag && !locationShaped(lemma)) continue
    if (!tag) tag = 'unlisted'
    const spoken = normalizePlaceName(lemma, lang)
    if (!spoken || stageIsIncidental(source, spoken, words[0].at)) continue
    heads.push({ lemma: spoken, name: spoken, tag, index: words[0].at, locative: true, moves: true })
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
    if (!tag || UNUSABLE.has(tag) || isNonPlaceNoun(lemma) || isRejectedPlace(lemma)) return
    if (tag === 'a:material' && !locative) return
    if (lang === 'zh-Hans' && (lemma === '门口' || ((lemma.startsWith('小') || lemma.startsWith('大')) && [...table.keys()].some(key => key !== lemma && lemma.endsWith(key))))) return
    if (tag !== 's' && tag !== 'unlisted' && !locative) return
    if (!locative) {
      const before = source.slice(Math.max(0, index - 24), index)
      const towardOnly = /(?:^|[^\p{L}])(?:to|into|onto|zum|zur|ins|vers|para|verso)\s+(?:the\s+|a\s+|an\s+|der\s+|die\s+|das\s+|dem\s+|den\s+)?$/iu.test(before)
      const arrived = /(?:walk|go(?:es|ing)?|went|return|board|pilot|pilota|embarca|enter|reach|come|arriv|crawl|creep|duck|squeeze|slide|clamber|rasteja|geht|komm|betritt|entra|chega|volta)/iu.test(source.slice(Math.max(0, index - 48), index))
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
      const subject = before.match(/(?:^|[^\p{L}])(\p{L}[\p{L}'’-]+)\s+$/u)
      const subjectWord = subject ? subject[1] : ''
      const article = /^(?:the|a|an|o|os|as|um|uma|le|la|les)$/i.test(subjectWord)
      const pronoun = /^(?:ela|ele|eles|elas|she|he|they)$/i.test(subjectWord)
      const named = subjectWord && subjectWord[0] !== subjectWord[0].toLowerCase() && !article
      if (pronoun || named) break
      push(lemma, tag, at, false)
      index += size - 1
      break
    }
  }
  return hits
}
