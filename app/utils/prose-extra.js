/** Rule-based prose detection for Portuguese and Simplified Chinese. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'
import { cueLight, findPlaceCue, inNamedVenue, isFunctionWord, isNumberWord, isQuotedOrRemembered, isVenueType, mentionMovesScene, namedVenues } from './scene-split.js'
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
    look: /(?:cerca de \d+ anos|\d+ anos|nos seus cinquenta(?: e poucos)?|cinquenta e poucos|pescador|pescadora|cabelo (?:preto|castanho|loiro|curto|comprido)(?: (?:preto|castanho|loiro|curto|comprido))?|barba por fazer)/giu,
    outfit: /(?:casaco de lã [\p{L}-]+|casaco [\p{L}-]+)/giu,
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
    const nextLight = cueLight(sentence, language)
    if (nextLight) light = nextLight
    else if (light) flags.push({ field: 'light', code: 'light_carried' })
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
    'zh-Hans': ['场景', '文中没有点名的地点']
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

const CJK = {
  'zh-Hans': {
    verbs: ['交给', '读了', '读', '走开', '看着', '看', '笑', '走进', '打开', '递给'],
    places: [['码头', '码头', '雨中的码头'], ['咖啡馆', '咖啡馆', '小咖啡馆'], ['车站', '车站', '车站'], ['森林', '森林', '森林'], ['海边', '海边', '海边'], ['街道', '街道', '街道']],
    look: /(?:三十出头|五十出头|五十多岁|四十多岁|渔夫|渔民|黑色短发|灰白胡茬|[\p{Script=Han}]{2,8}发)/gu,
    outfit: /(?:[\p{Script=Han}]{2,8}大衣|[\p{Script=Han}]{2,6}外套|围裙)/gu
  }
}

function looksVerbal(part) {
  if (/出头|出頭|岁|歲/u.test(part) && !/[了着过]/u.test(part)) return false
  return /[了着过]|(?:走|看|说|笑|拿|打|站|坐|开|关|读|写|等|到|来|去|买|卖|吃|喝|睡|跑|进|出|上|下|给|送|放|找|听|问|答|想|做|干|洗|切|煮|烧|修|装|搬|抬|推|拉|摇|点|挥|望|倒|填|吹|交)/u.test(part)
}

function cjkSentences(text, language) {
  const sentences = String(text || '').split(/(?<=[。！？；;])/).map(item => item.trim()).filter(Boolean)
  if (language !== 'zh-Hans') return sentences
  const clauses = []
  for (const sentence of sentences) {
    if (/岁|歲|出头|出頭/u.test(sentence) && !looksVerbal(sentence)) {
      clauses.push(sentence)
      continue
    }
    const parts = sentence.split(/[，,]/).map(item => item.trim()).filter(Boolean)
    const verbal = parts.filter(looksVerbal)
    if (verbal.length >= 2) clauses.push(...verbal)
    else clauses.push(sentence)
  }
  return clauses
}

function detectCjk(text, language) {
  const lex = CJK[language]
  const characters = []
  const warnings = []
  const quoted = [...String(text).matchAll(/[「『"]([\p{Script=Han}\p{Script=Katakana}A-Za-z]{1,12})[」』"]([^。！？]{0,80})/gu)]
  quoted.forEach(match => {
    const name = match[1]
    const window = match[2] || ''
    const look = unique(harvest(window, lex.look))
    const outfit = unique(harvest(window, lex.outfit))
    if (isNumberWord(name, language) || characters.some(item => item.name === name)) return
    const confidence = look.length && outfit.length ? 'high' : 'low'
    if (!look.length) warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
    if (!outfit.length) warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    characters.push({ name, look: look.join('，'), outfit: outfit.join('，'), confidence })
  })
  const cjkReject = name => !name || ['雨', '小', '在', '信', '二人', '人', '两人', '他们', '她们', '我们', '大家', '彼', '彼ら', '彼女', '三十', '四十', '五十', '六十', '七十', '八十'].includes(name) || /^[一二三四五六七八九十百千万零\d]+$/u.test(name) || /^在/.test(name) || /[里上边中内]$/.test(name) || /[了着过说给]/.test(name)
  if (!characters.length || language === 'zh-Hans') {
    const particle = [...String(text).matchAll(/(?:表哥|表妹|表弟|表姐|侄子|侄女|哥哥|姐姐|弟弟|妹妹|父亲|母亲|叔叔|阿姨)?([\p{Script=Han}]{2,4}?)(?=[一二三四五六七八九十百千万零\d]{1,6}岁)/gu)]
    particle.forEach(match => {
      const name = match[1] || match[2]
      if (cjkReject(name) || isNumberWord(name, language)) return
      if (language === 'zh-Hans' && name.length < 2) return
      if (characters.some(item => item.name === name)) return
      characters.push({ name, look: '', outfit: '', confidence: 'low' })
      warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
      warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    })
  }
  const clauseNames = language === 'zh-Hans'
    ? [...String(text).matchAll(/(?:^|[。！？，,])([\p{Script=Han}]{2,3})(?=[\p{Script=Han}]{0,4}(?:拿|走|看|说|笑|等|打|站|坐|把|是|读|写|开|关|倒))/gu)]
    : []
  clauseNames.forEach(match => {
    const name = match[1]
    if (cjkReject(name) || /[拿走看说笑等打站坐读写开关给那处在把的了从向对]$/u.test(name)) return
    if (characters.some(item => item.name === name || item.name.endsWith(name) || name.endsWith(item.name))) return
    characters.push({ name, look: '', outfit: '', confidence: 'low' })
  })
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const name = characters[index].name
    if (characters.some(item => item.name !== name && item.name.length > name.length && item.name.endsWith(name))) characters.splice(index, 1)
  }
  if (!characters.length) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  const places = []
  lex.places.forEach(([key, name, description]) => {
    if (text.includes(key) && !places.some(place => place.name === name)) places.push({ name, description, confidence: 'high' })
  })
  namedVenues(text, language).forEach(venue => {
    if (!places.some(place => place.name === venue.name)) places.push({ name: venue.name, description: venue.description, confidence: 'high' })
  })
  libraryHits(text, language).forEach(hit => {
    if (isNonPlaceNoun(hit.lemma) || isNeverPlace(hit.name)) return
    if (characters.some(item => hit.lemma.includes(item.name) || item.name.includes(hit.lemma))) return
    if (!places.some(place => place.name === hit.name)) places.push({ name: hit.name, description: hit.name, confidence: hit.tag === 's' ? 'high' : hit.tag === 'unlisted' ? 'low' : 'medium', ...(hit.tag === 'unlisted' ? { unlisted: true } : {}) })
  })
  for (let index = places.length - 1; index >= 0; index -= 1) {
    if (isNonPlaceNoun(places[index].name) || isNeverPlace(places[index].name)) places.splice(index, 1)
  }
  const scenes = []
  const sceneWarnings = []
  let lastWho = characters[0]?.name || ''
  let lastWhere = ''
  let light = ''
  cjkSentences(text, language).forEach(sentence => {
    if (language !== 'zh-Hans' && /は[^。]{0,48}で、/u.test(sentence) && !lex.verbs.some(verb => sentence.includes(verb))) return
    if (language === 'zh-Hans' && /岁|歲|出头|出頭/u.test(sentence) && !looksVerbal(sentence)) return
    const named = characters.some(item => sentence.includes(item.name))
    if (language !== 'zh-Hans' && !named && !lex.verbs.some(verb => sentence.includes(verb)) && !/[るたます]$/u.test(sentence.replace(/[。！？；]+$/u, ''))) return
    if (language === 'zh-Hans' && !named && !looksVerbal(sentence) && !lex.verbs.some(verb => sentence.includes(verb))) return
    const foundNames = characters.filter(character => {
      if (sentence.includes(character.name)) return true
      const kana = character.name.match(/[\p{Script=Hiragana}\p{Script=Katakana}]{2,}$/u)
      if (kana && sentence.includes(kana[0])) return true
      return character.name.length >= 4 && new RegExp(`${character.name.slice(-2)}(?:は|が|を|に|と|も)`).test(sentence)
    })
    const who = foundNames.length ? foundNames.slice(0, 2).map(item => item.name).join(' and ') : lastWho
    if (who) lastWho = who.split(/\s+and\s+/)[0]
    const records = places.map(place => ({
      name: place.name,
      keys: lex.places.filter(([, name]) => name === place.name).map(([key]) => key).concat(place.name)
    }))
    const cue = findPlaceCue(sentence, language, records)
    const owned = cue && characters.some(item => item.name === cue.name || item.name === cue.key)
    let where = lastWhere
    if (cue?.name && !cue.uncertain && !owned) where = cue.name
    if (where) lastWhere = where
    let confidence = foundNames.length && cue ? 'high' : 'medium'
    if (!where) {
      confidence = 'low'
      sceneWarnings.push({ code: 'missing_place', message: `No place found for scene ${scenes.length + 1}.`, target: 'scenes', index: scenes.length })
    }
    let shotLight = ''
    if (/黎明|夜明け|晨|朝|日出|日の出/.test(sentence) && !/夕方|傍晚/.test(sentence)) shotLight = 'dawn'
    else if (/黄昏|夕暮れ|夕方|傍晚/.test(sentence)) shotLight = 'dusk'
    else if (/夜|晚上/.test(sentence)) shotLight = 'night'
    if (shotLight) light = shotLight
    else shotLight = light
    const cjkFlags = []
    if (!foundNames.length && who) cjkFlags.push({ field: 'who', code: 'who_carried' })
    if (!foundNames.length && !who) cjkFlags.push({ field: 'who', code: 'who_missing' })
    if (where && !(cue?.name && foldName(cue.name) === foldName(where))) cjkFlags.push({ field: 'where', code: 'place_carried' })
    if (!where) cjkFlags.push({ field: 'where', code: 'place_missing' })
    const cjkWhat = cleanText(sentence).replace(/[。！？]+$/, '')
    scenes.push({ number: scenes.length + 1, who: who || '', where: where || '', what: cjkWhat, source: cjkWhat, flags: cjkFlags, duration: 3, confidence, light: shotLight })
  })
  const sheetLight = scenes.find(scene => scene.light)?.light || ''
  let mood = ''
  if (/笑/.test(text)) mood = 'playful'
  return pack(text, language, {
    characters: { characters, warnings },
    places,
    scenes: { scenes, warnings: sceneWarnings },
    ambience: { light: sheetLight, mood, confidence: sheetLight || mood ? 'medium' : 'low' }
  })
}

export function detectLocalized(text, language) {
  if (language === 'zh-Hans') return detectCjk(text, language)
  return detectSpaced(text, language)
}
