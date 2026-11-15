/** Rule-based prose detection beyond English and French. No model call. */
import { cleanText } from './text.js'
import { foldName, scenarioBudget, scenarioPremise, scenarioToFields } from './scenario.js'

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
    look: /(?:cerca de \d+ anos|\d+ anos|cabelo (?:preto|castanho|loiro|curto|comprido)(?: (?:preto|castanho|loiro|curto|comprido))?|barba por fazer)/giu,
    outfit: /(?:casaco de lã [\p{L}-]+|casaco [\p{L}-]+)/giu,
    feminine: ['ela'],
    masculine: ['ele'],
    meet: /\b(encontra|conhece)\b/i,
    light: [[/\b(amanhecer|aurora)\b/i, 'dawn'], [/\b(crepúsculo|anoitecer|entardecer)\b/i, 'dusk'], [/\b(noite|meia-noite)\b/i, 'night'], [/\b(dia|manhã|tarde)\b/i, 'day']],
    mood: [[/\b(sorri|rir|riso)\b/i, 'playful'], [/\b(medo|ansioso)\b/i, 'uneasy'], [/\b(calmo|silêncio|triste)\b/i, 'quiet']]
  },
  de: {
    stop: ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'mit', 'auf', 'in', 'im', 'am', 'an', 'zu', 'vom', 'von', 'ist', 'nicht', 'sie', 'er', 'ihm', 'ihr', 'anfang', 'brief', 'mantel', 'haar', 'tür', 'tuer', 'stoppeln'],
    verbs: ['gibt', 'geben', 'liest', 'lesen', 'geht', 'gehen', 'sieht', 'sehen', 'läuft', 'kommt', 'öffnet', 'lacht', 'reicht', 'legt', 'nimmt', 'wartet'],
    places: [
      ['kai', 'Kai', 'ein Kai'],
      ['café', 'Café', 'ein Café'],
      ['cafe', 'Café', 'ein Café'],
      ['straße', 'Straße', 'eine Straße'],
      ['strasse', 'Straße', 'eine Straße'],
      ['strand', 'Strand', 'ein Strand'],
      ['wald', 'Wald', 'ein Wald'],
      ['haus', 'Haus', 'ein Haus'],
      ['park', 'Park', 'ein Park'],
      ['bahnhof', 'Bahnhof', 'ein Bahnhof'],
      ['küche', 'Küche', 'eine Küche'],
      ['brücke', 'Brücke', 'eine Brücke']
    ],
    look: /(?:anfang \d+|\d+|kurzes [\p{L} -]{0,24}haar|graue stoppeln|stoppeln)/giu,
    outfit: /(?:[\p{L}-]+ )?[\p{L}-]*mantel\b/giu,
    feminine: ['sie'],
    masculine: ['er'],
    meet: /\btrifft\b/i,
    light: [[/\b(morgendämmerung|morgenrot)\b/i, 'dawn'], [/\b(abenddämmerung|dämmerung)\b/i, 'dusk'], [/\b(nacht|mitternacht)\b/i, 'night'], [/\b(tag|morgen|vormittag)\b/i, 'day']],
    mood: [[/\b(lacht|lachen)\b/i, 'playful'], [/\b(angst|unruhig)\b/i, 'uneasy'], [/\b(still|traurig|ruhe)\b/i, 'quiet']]
  },
  it: {
    stop: ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'di', 'del', 'della', 'dei', 'in', 'nel', 'nella', 'sul', 'sulla', 'e', 'che', 'con', 'per', 'non', 'lei', 'lui', 'si', 'da', 'dalla'],
    verbs: ['porge', 'porgere', 'legge', 'leggere', 'allontana', 'allontanarsi', 'guarda', 'guardare', 'entra', 'esce', 'cammina', 'corre', 'sorride', 'dà', 'da', 'apre', 'aspetta', 'prende'],
    places: [
      ['molo', 'Molo', 'un molo'],
      ['caffè', 'Caffè', 'un caffè'],
      ['caffe', 'Caffè', 'un caffè'],
      ['strada', 'Strada', 'una strada'],
      ['spiaggia', 'Spiaggia', 'una spiaggia'],
      ['bosco', 'Bosco', 'un bosco'],
      ['casa', 'Casa', 'una casa'],
      ['parco', 'Parco', 'un parco'],
      ['stazione', 'Stazione', 'una stazione'],
      ['cucina', 'Cucina', 'una cucina'],
      ['ponte', 'Ponte', 'un ponte']
    ],
    look: /(?:\d+ anni|poco più di [\p{L}’']+|caschetto [\p{L}]+|barba [\p{L}]+)/giu,
    outfit: /(?:cappotto [\p{L} -]{0,28})/giu,
    feminine: ['lei'],
    masculine: ['lui'],
    meet: /\bincontra\b/i,
    light: [[/\b(alba|aurora)\b/i, 'dawn'], [/\b(crepuscolo|tramonto)\b/i, 'dusk'], [/\b(notte|mezzanotte)\b/i, 'night'], [/\b(giorno|mattina|pomeriggio)\b/i, 'day']],
    mood: [[/\b(sorride|ride)\b/i, 'playful'], [/\b(paura|ansioso)\b/i, 'uneasy'], [/\b(calmo|silenzio|triste)\b/i, 'quiet']]
  },
  lb: {
    stop: ['de', 'den', 'dem', 'd', 'en', 'eng', 'een', 'an', 'am', 'op', 'mat', 'fir', 'vun', 'vum', 'net', 'ass', 'och', 'si', 'hien', 'hie', 'him', 'um', 'der', 'déi', 'dat', 'ech'],
    verbs: ['gëtt', 'ginn', 'liest', 'liesen', 'geet', 'goen', 'kuckt', 'kucken', 'leeft', 'kënnt', 'laacht', 'hëlt', 'weit', 'dréit'],
    places: [
      ['quai', 'Quai', 'e Quai'],
      ['café', 'Café', 'e Café'],
      ['cafe', 'Café', 'e Café'],
      ['strooss', 'Strooss', 'eng Strooss'],
      ['strand', 'Strand', 'e Strand'],
      ['bësch', 'Bësch', 'e Bësch'],
      ['haus', 'Haus', 'en Haus'],
      ['park', 'Park', 'e Park'],
      ['gare', 'Gare', 'eng Gare'],
      ['kichen', 'Kichen', 'eng Kichen'],
      ['bréck', 'Bréck', 'eng Bréck']
    ],
    look: /(?:\d+|kuerzt [\p{L} -]{0,24}hoer|groe stoppeln|stoppeln)/giu,
    outfit: /(?:[\p{L}-]+ )?[\p{L}-]*mantel\b/giu,
    feminine: ['si'],
    masculine: ['hien', 'hie'],
    meet: /\bbegéint\b/i,
    light: [[/\b(mueren|mueresgrauen)\b/i, 'dawn'], [/\b(owesdämmerung|dämmerung|owend)\b/i, 'dusk'], [/\b(nuecht|mëtternuecht)\b/i, 'night'], [/\b(dag|mueren)\b/i, 'day']],
    mood: [[/\b(laacht|laachen)\b/i, 'playful'], [/\b(angst|onroueg)\b/i, 'uneasy'], [/\b(roueg|trauereg)\b/i, 'quiet']]
  }
}

function tokens(text) {
  return String(text || '').match(/[\p{L}][\p{L}'’-]+/gu) || []
}

function sentences(text) {
  return String(text || '').split(/(?<=[.!?。！？])\s*/).map(item => item.trim()).filter(Boolean)
}

function hasVerb(text, verbs) {
  const folded = foldName(text)
  return verbs.some(verb => new RegExp(`(?:^|[^\\p{L}])${foldName(verb)}(?=[^\\p{L}]|$)`, 'u').test(folded))
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

function nameOf(token, language) {
  if (language === 'lb') return token.replace(/^d'/i, '')
  return token
}

function findPlaces(text, lex) {
  const folded = foldName(text)
  const places = []
  lex.places.forEach(([key, name, description]) => {
    if (!new RegExp(`(?:^|[^\\p{L}])${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded)) return
    if (places.some(place => foldName(place.name) === foldName(name))) return
    places.push({ name, description, confidence: 'high' })
  })
  return places
}

function findCharacters(text, lex, places, language) {
  const reserved = new Set(places.flatMap(place => tokens(place.name).map(foldName)))
  lex.places.forEach(place => reserved.add(foldName(place[0])))
  const stop = new Set(lex.stop)
  const counts = new Map()
  const starts = new Set(sentences(text).map(sentence => foldName(tokens(sentence)[0] || '')))
  if (language === 'lb') {
    for (const match of String(text).matchAll(/(?:d'|D'|De |Den |Dem )([\p{Lu}][\p{L}'’-]+)/gu)) {
      const name = match[1]
      const key = foldName(name)
      if (key.length < 2 || stop.has(key) || reserved.has(key)) continue
      const entry = counts.get(key) || { forms: new Map(), count: 0, mid: 0 }
      entry.count += 1
      entry.mid += 1
      entry.forms.set(name, (entry.forms.get(name) || 0) + 1)
      counts.set(key, entry)
    }
  }
  tokens(text).forEach(token => {
    if (language === 'lb') return
    token = nameOf(token, language)
    if (!/^\p{Lu}/u.test(token)) return
    const key = foldName(token)
    if (key.length < 2 || stop.has(key) || reserved.has(key)) return
    if (harvest(token, lex.outfit).length || harvest(token, lex.look).length) return
    const entry = counts.get(key) || { forms: new Map(), count: 0, mid: 0 }
    entry.count += 1
    if (!starts.has(key)) entry.mid += 1
    entry.forms.set(token, (entry.forms.get(token) || 0) + 1)
    counts.set(key, entry)
  })
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

function whoFromPronoun(sentence, characters, lex) {
  const first = foldName(tokens(sentence)[0] || '')
  if (lex.feminine.includes(first) && characters[0]) return characters[0].name
  if (lex.masculine.includes(first) && characters[1]) return characters[1].name
  if (lex.masculine.includes(first) && characters[0]) return characters[0].name
  return ''
}

function findScenes(text, lex, characters, places) {
  const warnings = []
  const scenes = []
  let lastWho = characters[0]?.name || ''
  let lastWhere = places[0]?.name || ''
  sentences(text).forEach(sentence => {
    if (lex.meet.test(sentence) && (sentence.match(/,/g) || []).length >= 1 && !hasVerb(sentence.replace(lex.meet, ''), lex.verbs)) return
    if (!hasVerb(sentence, lex.verbs)) return
    const action = cleanText(sentence).replace(/[.!?。！？]+$/, '')
    const foundNames = characters.filter(character => nameInText(action, character.name))
    const who = foundNames.length ? foundNames.slice(0, 2).map(item => item.name).join(' and ') : (whoFromPronoun(action, characters, lex) || lastWho)
    if (who) lastWho = who.split(/\s+and\s+/)[0]
    const folded = foldName(action)
    const foundPlace = places.find(place => new RegExp(`(?:^|[^\\p{L}])${foldName(place.name)}(?=[^\\p{L}]|$)`, 'u').test(folded) || lex.places.some(([key, name]) => name === place.name && new RegExp(`(?:^|[^\\p{L}])${foldName(key)}(?=[^\\p{L}]|$)`, 'u').test(folded)))
    const where = foundPlace?.name || lastWhere
    if (where) lastWhere = where
    let confidence = foundNames.length && foundPlace ? 'high' : 'medium'
    if (!where) {
      confidence = 'low'
      warnings.push({ code: 'missing_place', message: `No place found for scene ${scenes.length + 1}.`, target: 'scenes', index: scenes.length, options: places.map(place => place.name) })
    }
    if (!who) {
      confidence = 'low'
      warnings.push({ code: 'missing_character', message: `No character found for scene ${scenes.length + 1}.`, target: 'scenes', index: scenes.length, options: characters.map(character => character.name) })
    }
    scenes.push({ number: scenes.length + 1, who: who || '', where: where || '', what: action, duration: 3, confidence })
  })
  return { scenes, warnings }
}

function overall(parts) {
  const values = parts.filter(Boolean)
  if (values.includes('low')) return 'low'
  if (values.includes('medium')) return 'medium'
  return values.length ? 'high' : 'low'
}

function pack(text, language, found) {
  const warnings = [...found.characters.warnings, ...found.places.warnings || [], ...found.scenes.warnings]
  const scenario = {
    characters: found.characters.characters.map(({ name, look, outfit }) => ({ name, look, outfit })),
    places: found.places.map(({ name, description }) => ({ name, description })),
    light: found.ambience.light,
    mood: found.ambience.mood,
    scenes: found.scenes.scenes.map(({ number, who, where, what, duration }) => ({ number, who, where, what, duration }))
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
  const places = findPlaces(text, lex)
  const characters = findCharacters(text, lex, places, language)
  const ambience = findAmbience(text, lex)
  const scenes = findScenes(text, lex, characters.characters, places)
  return pack(text, language, { characters, places, scenes, ambience })
}

const CJK = {
  ja: {
    verbs: ['渡す', '渡した', '読む', '読んだ', '歩き去る', '歩いて', '見る', '見た', '笑う', '入る', '出る', '開ける', '渡します'],
    places: [['埠頭', '埠頭', '雨の埠頭'], ['カフェ', 'カフェ', '小さなカフェ'], ['駅', '駅', '駅'], ['森', '森', '森'], ['海岸', '海岸', '海岸'], ['通り', '通り', '通り']],
    look: /(?:三十代前半|五十代|短い黒髪|白い無精ひげ|[\p{Script=Han}]{1,6}髪)/gu,
    outfit: /(?:[\p{Script=Han}ァ-ンー]{1,12}コート|エプロン|帽子)/gu
  },
  'zh-Hans': {
    verbs: ['交给', '读了', '读', '走开', '看着', '看', '笑', '走进', '打开', '递给'],
    places: [['码头', '码头', '雨中的码头'], ['咖啡馆', '咖啡馆', '小咖啡馆'], ['车站', '车站', '车站'], ['森林', '森林', '森林'], ['海边', '海边', '海边'], ['街道', '街道', '街道']],
    look: /(?:三十出头|五十多岁|黑色短发|灰白胡茬|[\p{Script=Han}]{2,8}发)/gu,
    outfit: /(?:[\p{Script=Han}]{2,8}大衣|[\p{Script=Han}]{2,6}外套|围裙)/gu
  }
}

function cjkSentences(text) {
  return String(text || '').split(/(?<=[。！？])/).map(item => item.trim()).filter(Boolean)
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
    if (characters.some(item => item.name === name)) return
    const confidence = look.length && outfit.length ? 'high' : 'low'
    if (!look.length) warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
    if (!outfit.length) warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    characters.push({ name, look: look.join('，'), outfit: outfit.join('，'), confidence })
  })
  if (!characters.length) {
    const particle = language === 'ja'
      ? [...String(text).matchAll(/([\p{Script=Han}]{1,4})(?:は|が)/gu)]
      : [...String(text).matchAll(/([\p{Script=Han}]{1,3})(?:把|是)/gu)]
    particle.forEach(match => {
      const name = match[1]
      if (['雨', '小', '在', '信'].includes(name)) return
      if (characters.some(item => item.name === name)) return
      characters.push({ name, look: '', outfit: '', confidence: 'low' })
      warnings.push({ code: 'missing_look', message: `No look found for ${name}.`, target: 'characters', name })
      warnings.push({ code: 'missing_outfit', message: `No outfit found for ${name}.`, target: 'characters', name })
    })
  }
  if (!characters.length) warnings.push({ code: 'missing_character', message: 'No character name found.', target: 'characters' })
  const places = []
  lex.places.forEach(([key, name, description]) => {
    if (text.includes(key) && !places.some(place => place.name === name)) places.push({ name, description, confidence: 'high' })
  })
  const scenes = []
  const sceneWarnings = []
  let lastWho = characters[0]?.name || ''
  let lastWhere = places[0]?.name || ''
  cjkSentences(text).forEach(sentence => {
    if (!lex.verbs.some(verb => sentence.includes(verb))) return
    const foundNames = characters.filter(character => sentence.includes(character.name))
    const who = foundNames.length ? foundNames.slice(0, 2).map(item => item.name).join(' and ') : lastWho
    if (who) lastWho = who.split(/\s+and\s+/)[0]
    const foundPlace = places.find(place => sentence.includes(place.name) || lex.places.some(([key, name]) => name === place.name && sentence.includes(key)))
    const where = foundPlace?.name || lastWhere
    if (where) lastWhere = where
    let confidence = foundNames.length && foundPlace ? 'high' : 'medium'
    if (!where) {
      confidence = 'low'
      sceneWarnings.push({ code: 'missing_place', message: `No place found for scene ${scenes.length + 1}.`, target: 'scenes', index: scenes.length })
    }
    scenes.push({ number: scenes.length + 1, who: who || '', where: where || '', what: cleanText(sentence).replace(/[。！？]+$/, ''), duration: 3, confidence })
  })
  let light = ''
  if (/黎明|夜明け|晨/.test(text)) light = 'dawn'
  else if (/黄昏|夕暮れ|黄昏/.test(text)) light = 'dusk'
  else if (/夜|晚上/.test(text)) light = 'night'
  let mood = ''
  if (/笑/.test(text)) mood = 'playful'
  return pack(text, language, {
    characters: { characters, warnings },
    places,
    scenes: { scenes, warnings: sceneWarnings },
    ambience: { light, mood, confidence: light || mood ? 'medium' : 'low' }
  })
}

export function detectLocalized(text, language) {
  if (language === 'ja' || language === 'zh-Hans') return detectCjk(text, language)
  return detectSpaced(text, language)
}
