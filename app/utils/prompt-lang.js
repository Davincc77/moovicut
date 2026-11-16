/** Prompt language for planner-written lines. English is returned unchanged. */
import { PHRASES } from './prompt-phrases.js'

export const PROMPT_LANGUAGES = Object.freeze(['en', 'pt'])
const CODES = new Set(PROMPT_LANGUAGES)

export function readPromptLanguage(value) {
  if (value == null || value === '') return 'en'
  const text = String(value).trim()
  if (CODES.has(text)) return text
  const error = new Error(`promptLanguage must be one of: ${PROMPT_LANGUAGES.join(', ')}.`)
  error.status = 400
  error.code = 'invalid_prompt_language'
  throw error
}

export function promptLanguageOf(project) {
  const value = project?.promptLanguage || project?.prompt_language
  return CODES.has(value) ? value : 'en'
}

/** Known planner phrase. Unknown text, and every English lookup, is returned as written. */
export function phrase(lang, text) {
  const value = text == null ? '' : String(text)
  if (!value || !lang || lang === 'en') return value
  const exact = PHRASES[value]
  if (exact?.[lang]) return exact[lang]
  const folded = value.toLowerCase()
  if (folded !== value && PHRASES[folded]?.[lang]) {
    const translated = PHRASES[folded][lang]
    if (/^\p{Lu}/u.test(value)) return translated.charAt(0).toUpperCase() + translated.slice(1)
    return translated
  }
  return value
}

const TIMES = [
  'daylight consistent with the idea',
  'golden hour',
  'blue hour',
  'afternoon',
  'evening',
  'midnight',
  'twilight',
  'sunrise',
  'sunset',
  'morning',
  'storm',
  'night',
  'dawn',
  'dusk',
  'rain'
]

/** Light line. English text is not rewritten. Known time and palette clauses are. */
export function localizeLight(lang, text) {
  const value = text == null ? '' : String(text)
  if (!value || !lang || lang === 'en') return value
  const exact = phrase(lang, value)
  if (exact !== value) return exact
  const lower = value.toLowerCase()
  for (const time of TIMES) {
    if (lower === time) return phrase(lang, time)
    const prefix = `${time}, `
    if (lower.startsWith(prefix)) {
      const rest = value.slice(prefix.length)
      const when = phrase(lang, time)
      const palette = phrase(lang, rest)
      const spoken = `${when}, ${palette}`
      return /^\p{Lu}/u.test(value) ? spoken.charAt(0).toUpperCase() + spoken.slice(1) : spoken
    }
  }
  return value
}

const BEATS = [
  {
    re: /^A wide view of (.+?) at (.+), with (.+) entering the frame\.?$/,
    fill(lang, where, when, who) {
      const at = phrase(lang, when)
      const table = {
        pt: `Um plano geral de ${where}, ${at}, com ${who} a entrar no quadro`,
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) is readable in a closer frame, posture and expression clear\.?$/,
    fill(lang, who) {
      const table = {
        pt: `${who} lê-se num plano mais próximo, postura e expressão claras`,
      }
      return table[lang]
    }
  },
  {
    re: /^One new detail appears in (.+) and changes the next gesture\.?$/,
    fill(lang, where) {
      const table = {
        pt: `Um pormenor novo aparece em ${where} e muda o gesto seguinte`,
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) stops as the situation turns\.?$/,
    fill(lang, who) {
      const table = {
        pt: `${who} pára quando a situação vira`,
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) says “(.+)”\.?$/,
    fill(lang, who, line) {
      const table = {
        pt: `${who} diz “${line}”`,
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) chooses a direction and moves through (.+)\.?$/,
    fill(lang, who, where) {
      const table = {
        pt: `${who} escolhe uma direcção e atravessa ${where}`,
      }
      return table[lang]
    }
  },
  {
    re: /^The result of that choice is visible around (.+)\.?$/,
    fill(lang, who) {
      const table = {
        pt: `O resultado dessa escolha vê-se à volta de ${who}`,
      }
      return table[lang]
    }
  },
  {
    re: /^A quiet hold on (.+?) at (.+)\.?$/,
    fill(lang, where, when) {
      const at = phrase(lang, when)
      const table = {
        pt: `Uma pausa quieta em ${where}, ${at}`,
      }
      return table[lang]
    }
  },
  {
    re: /^The last image stays on (.+?) in (.+)\.?$/,
    fill(lang, who, where) {
      const table = {
        pt: `A última imagem fica em ${who} em ${where}`,
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) plays the (.+) beat in (.+?) at (.+), (.+)\.?$/,
    fill(lang, who, stage, where, when, pace) {
      const at = phrase(lang, when)
      const beat = phrase(lang, stage)
      const rhythm = phrase(lang, pace)
      const table = {
        pt: `${who} faz o tempo ${beat} em ${where} à ${at}, ${rhythm}`,
      }
      return table[lang]
    }
  },
  {
    re: /^A standalone (.+) frame of (.+) in (.+), shot (\d+)\.?$/,
    fill(lang, mood, who, location, number) {
      const tone = phrase(lang, mood)
      const place = translateLocation(lang, location)
      const table = {
        pt: `Um quadro autónomo de ${tone} de ${who} em ${place}, plano ${number}`,
      }
      return table[lang]
    }
  }
]

const LOCATIONS = [
  [/^a far edge of (.+)$/, {
    pt: place => `uma margem distante de ${place}`,
  }],
  [/^a close corner of (.+)$/, {
    pt: place => `um canto próximo de ${place}`,
  }],
  [/^ground level at (.+)$/, {
    pt: place => `ao nível do chão em ${place}`,
  }],
  [/^an overhead view of (.+)$/, {
    pt: place => `uma vista de cima de ${place}`,
  }],
  [/^the shadowed side of (.+)$/, {
    pt: place => `o lado em sombra de ${place}`,
  }],
  [/^a foreground detail within (.+)$/, {
    pt: place => `um detalhe em primeiro plano dentro de ${place}`,
  }],
  [/^eye level inside (.+)$/, {
    pt: place => `à altura dos olhos dentro de ${place}`,
  }],
  [/^the opposite side of (.+)$/, {
    pt: place => `o lado oposto de ${place}`,
  }]
]

function translateLocation(lang, location) {
  for (const [pattern, table] of LOCATIONS) {
    const match = String(location).match(pattern)
    if (match && table[lang]) return table[lang](match[1])
  }
  return location
}

/** Planner beat with the names left as written. Returns '' when the line is not a template. */
export function translateBeat(text, lang) {
  const value = String(text || '').trim()
  if (!value || !lang || lang === 'en') return ''
  for (const beat of BEATS) {
    const match = value.match(beat.re)
    if (!match) continue
    const spoken = beat.fill(lang, ...match.slice(1))
    if (spoken) return spoken
  }
  return ''
}

const LABELS = [
  'Time / moment:',
  'Product (locked):',
  'Style lock:',
  'Voice-over:',
  'CONTINUITY:',
  'Continuity:',
  'LIGHTING:',
  'Lighting:',
  'Characters:',
  'Character:',
  'Location:',
  'Dialogue:',
  'Audience:',
  'Wardrobe:',
  'Framing:',
  'Palette:',
  'Pacing:',
  'Camera:',
  'CAMERA:',
  'ACTION:',
  'Family:',
  'Visual:',
  'People:',
  'Places:',
  'Spoken line:',
  'Do not show:',
  'Topic:',
  'Genre:',
  'Light:',
  'Place:',
  'STYLE:',
  'Style:',
  'Sound:',
  'AUDIO:',
  'SCENE:',
  'Look:',
  'Lens:',
  'Idea:'
].sort((a, b) => b.length - a.length)

const FRAMING_WORDS = ['extreme close-up', 'over-the-shoulder', 'tracking shot', 'medium shot', 'static shot', 'crane shot', 'close-up', 'high angle', 'low angle', 'wide shot', 'POV']

function replaceLongPhrases(text, lang) {
  let next = text
  const keys = Object.keys(PHRASES).filter(key => key.length >= 8).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (!next.includes(key)) continue
    next = next.split(key).join(phrase(lang, key))
  }
  return next
}

function replaceLabels(text, lang) {
  let next = text
  for (const label of LABELS) {
    if (!next.includes(label)) continue
    next = next.split(label).join(phrase(lang, label))
  }
  return next
}

function replaceFramingWords(text, lang) {
  let next = text
  for (const word of FRAMING_WORDS) {
    const pattern = new RegExp(`(?<![\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
    next = next.replace(pattern, match => phrase(lang, match.toLowerCase() === 'pov' ? 'POV' : word))
  }
  return next
}

function translateInline(text, lang) {
  const beat = translateBeat(text.replace(/\.$/, ''), lang)
  if (beat) return /\.$/.test(text) ? `${beat}.` : beat
  let next = localizeLight(lang, text)
  next = replaceLongPhrases(next, lang)
  next = replaceLabels(next, lang)
  next = replaceFramingWords(next, lang)
  return next
}

function applyTemplates(line, lang) {
  let match = line.match(/^(extreme close-up|over-the-shoulder|tracking shot|medium shot|static shot|crane shot|close-up|high angle|low angle|wide shot|POV) of (.+)$/i)
  if (match) {
    const body = match[2].replace(/\.$/, '')
    const action = translateBeat(body, lang) || translateInline(body, lang)
    const frame = phrase(lang, match[1].toLowerCase() === 'pov' ? 'POV' : match[1].toLowerCase())
    const ofWord = ` ${phrase(lang, 'of')} `
    const joined = `${frame}${ofWord}${action}`
    return /\.$/.test(match[2]) || line.endsWith('.') ? `${joined}.` : joined
  }
  match = line.match(/^Create a (\d+)-second ([0-9:]+) shot\.$/)
  if (match) return createShotLine(lang, match[1], match[2])
  match = line.match(/^Shot (\d+) of (\d+)\. (.*)$/)
  if (match) return `${shotCountLine(lang, match[1], match[2])} ${translateInline(match[3], lang)}`.trim()
  match = line.match(/^Independent shot (\d+) of (\d+)\. A separate angle, not a continuation\.$/)
  if (match) return independentShotLine(lang, match[1], match[2])
  match = line.match(/^aspect ratio ([0-9:]+)$/)
  if (match) return aspectLine(lang, match[1])
  match = line.match(/^(\d+)s, ([0-9:]+)\. No captions, titles, logos or watermarks\.$/)
  if (match) return timingShort(lang, match[1], match[2])
  match = line.match(/^(\d+) seconds, ([0-9:]+)\. Shot (\d+)\. No captions, titles, logos or watermarks\.$/)
  if (match) return timingLong(lang, match[1], match[2], match[3])
  match = line.match(/^TIMING: (\d+) seconds\. No captions, titles, logos or watermarks\.$/)
  if (match) return timingLabel(lang, match[1])
  return null
}

function createShotLine(lang, duration, aspect) {
  const table = {
    pt: `Cria um plano de ${duration} segundos em ${aspect}.`,
  }
  return table[lang] || `Create a ${duration}-second ${aspect} shot.`
}

function shotCountLine(lang, index, total) {
  const table = {
    pt: `Plano ${index} de ${total}.`,
  }
  return table[lang] || `Shot ${index} of ${total}.`
}

function independentShotLine(lang, index, total) {
  const table = {
    pt: `Plano independente ${index} de ${total}. Um ângulo à parte, não uma continuação.`,
  }
  return table[lang] || `Independent shot ${index} of ${total}. A separate angle, not a continuation.`
}

function aspectLine(lang, aspect) {
  const table = {
    pt: `proporção ${aspect}`,
  }
  return table[lang] || `aspect ratio ${aspect}`
}

function timingShort(lang, duration, aspect) {
  const table = {
    pt: `${duration}s, ${aspect}. Sem legendas, títulos, logótipos ou marcas de água.`,
  }
  return table[lang] || `${duration}s, ${aspect}. No captions, titles, logos or watermarks.`
}

function timingLong(lang, duration, aspect, index) {
  const table = {
    pt: `${duration} segundos, ${aspect}. Plano ${index}. Sem legendas, títulos, logótipos ou marcas de água.`,
  }
  return table[lang] || `${duration} seconds, ${aspect}. Shot ${index}. No captions, titles, logos or watermarks.`
}

function timingLabel(lang, duration) {
  const table = {
    pt: `TEMPO: ${duration} segundos. Sem legendas, títulos, logótipos ou marcas de água.`,
  }
  return table[lang] || `TIMING: ${duration} seconds. No captions, titles, logos or watermarks.`
}

/** Detailed prompt. The English document is not passed through here. */
export function translateDetailedPrompt(text, lang) {
  if (!lang || lang === 'en') return text
  return String(text).split('\n').map((line, index) => {
    if (!line.trim()) return line
    if (index === 0 && line.startsWith('Idea: ')) return `${phrase(lang, 'Idea:')} ${line.slice('Idea: '.length)}`
    const templated = applyTemplates(line, lang)
    if (templated != null) return templated
    for (const label of LABELS) {
      if (line === label) return phrase(lang, label)
      if (!line.startsWith(`${label} `)) continue
      const rest = line.slice(label.length + 1)
      return `${phrase(lang, label)} ${translateInline(rest, lang)}`
    }
    if (line === 'STYLE PRESET' || line === 'FILM SHEET' || line === 'CONTINUITY SHEET') return phrase(lang, line)
    return translateInline(line, lang)
  }).join('\n')
}

export function framingTermsForMatch() {
  const terms = new Set(FRAMING_WORDS)
  for (const word of FRAMING_WORDS) {
    const row = PHRASES[word]
    if (!row) continue
    for (const value of Object.values(row)) if (value) terms.add(value)
  }
  return [...terms]
}

export function stampPromptLanguage(project, lang) {
  if (lang && lang !== 'en') project.promptLanguage = lang
  else delete project.promptLanguage
  return project
}
