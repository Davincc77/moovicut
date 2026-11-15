/** Prompt language for planner-written lines. English is returned unchanged. */
import { PHRASES } from './prompt-phrases.js'

export const PROMPT_LANGUAGES = Object.freeze(['en', 'zh-Hans', 'pt', 'ja', 'fr', 'de', 'it'])
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
        'zh-Hans': `${where}的远景，${at}，${who}进入画面`,
        pt: `Um plano geral de ${where}, ${at}, com ${who} a entrar no quadro`,
        ja: `${at}の${where}のワイド。${who}がフレームに入る`,
        fr: `Un plan large de ${where}, ${at}, avec ${who} qui entre dans le cadre`,
        de: `Eine Totale von ${where}, ${at}, ${who} betritt das Bild`,
        it: `Un campo lungo di ${where}, ${at}, con ${who} che entra nell'inquadratura`
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) is readable in a closer frame, posture and expression clear\.?$/,
    fill(lang, who) {
      const table = {
        'zh-Hans': `${who}在更近的景别里清晰可读，姿态和表情清楚`,
        pt: `${who} lê-se num plano mais próximo, postura e expressão claras`,
        ja: `${who}は近めのフレームで読み取れる。姿勢と表情は明確`,
        fr: `${who} est lisible dans un cadre plus proche, posture et expression claires`,
        de: `${who} ist in einer näheren Einstellung lesbar, Haltung und Ausdruck klar`,
        it: `${who} è leggibile in un quadro più vicino, postura ed espressione chiare`
      }
      return table[lang]
    }
  },
  {
    re: /^One new detail appears in (.+) and changes the next gesture\.?$/,
    fill(lang, where) {
      const table = {
        'zh-Hans': `${where}里出现一个新细节，并改变下一个动作`,
        pt: `Um pormenor novo aparece em ${where} e muda o gesto seguinte`,
        ja: `${where}に新しい細部が現れ、次の仕草が変わる`,
        fr: `Un détail nouveau apparaît dans ${where} et change le geste suivant`,
        de: `Ein neues Detail erscheint in ${where} und ändert die nächste Geste`,
        it: `Un dettaglio nuovo appare in ${where} e cambia il gesto successivo`
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) stops as the situation turns\.?$/,
    fill(lang, who) {
      const table = {
        'zh-Hans': `${who}在局势转向时停下`,
        pt: `${who} pára quando a situação vira`,
        ja: `状況が転じ、${who}は立ち止まる`,
        fr: `${who} s’arrête quand la situation tourne`,
        de: `${who} hält an, als die Lage kippt`,
        it: `${who} si ferma quando la situazione gira`
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) says “(.+)”\.?$/,
    fill(lang, who, line) {
      const table = {
        'zh-Hans': `${who}说“${line}”`,
        pt: `${who} diz “${line}”`,
        ja: `${who}は「${line}」と言う`,
        fr: `${who} dit « ${line} »`,
        de: `${who} sagt „${line}“`,
        it: `${who} dice “${line}”`
      }
      return table[lang]
    }
  },
  {
    re: /^(.+?) chooses a direction and moves through (.+)\.?$/,
    fill(lang, who, where) {
      const table = {
        'zh-Hans': `${who}选定方向，穿过${where}`,
        pt: `${who} escolhe uma direcção e atravessa ${where}`,
        ja: `${who}は方向を決め、${where}を進む`,
        fr: `${who} choisit une direction et traverse ${where}`,
        de: `${who} wählt eine Richtung und bewegt sich durch ${where}`,
        it: `${who} sceglie una direzione e attraversa ${where}`
      }
      return table[lang]
    }
  },
  {
    re: /^The result of that choice is visible around (.+)\.?$/,
    fill(lang, who) {
      const table = {
        'zh-Hans': `这个选择的结果在${who}周围可见`,
        pt: `O resultado dessa escolha vê-se à volta de ${who}`,
        ja: `その選択の結果が${who}の周りに見える`,
        fr: `Le résultat de ce choix est visible autour de ${who}`,
        de: `Das Ergebnis dieser Wahl ist um ${who} sichtbar`,
        it: `Il risultato di quella scelta è visibile intorno a ${who}`
      }
      return table[lang]
    }
  },
  {
    re: /^A quiet hold on (.+?) at (.+)\.?$/,
    fill(lang, where, when) {
      const at = phrase(lang, when)
      const table = {
        'zh-Hans': `${where}，${at}，安静停留`,
        pt: `Uma pausa quieta em ${where}, ${at}`,
        ja: `${where}、${at}を静かに保つ`,
        fr: `Un maintien calme sur ${where}, ${at}`,
        de: `Ein stilles Halten auf ${where}, ${at}`,
        it: `Una tenuta quieta su ${where}, ${at}`
      }
      return table[lang]
    }
  },
  {
    re: /^The last image stays on (.+?) in (.+)\.?$/,
    fill(lang, who, where) {
      const table = {
        'zh-Hans': `最后的画面停在${where}里的${who}上`,
        pt: `A última imagem fica em ${who} em ${where}`,
        ja: `最後の絵は${where}の${who}に留まる`,
        fr: `La dernière image reste sur ${who} dans ${where}`,
        de: `Das letzte Bild bleibt auf ${who} in ${where}`,
        it: `L’ultima immagine resta su ${who} in ${where}`
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
        'zh-Hans': `${who}在${at}的${where}完成${beat}这一拍，${rhythm}`,
        pt: `${who} faz o tempo ${beat} em ${where} à ${at}, ${rhythm}`,
        ja: `${who}は${at}の${where}で${beat}の拍を演じる、${rhythm}`,
        fr: `${who} joue le temps ${beat} dans ${where} à ${at}, ${rhythm}`,
        de: `${who} spielt den ${beat}-Schlag in ${where} bei ${at}, ${rhythm}`,
        it: `${who} esegue il tempo ${beat} in ${where} a ${at}, ${rhythm}`
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
        'zh-Hans': `独立的${tone}画面，${who}在${place}，镜头 ${number}`,
        pt: `Um quadro autónomo de ${tone} de ${who} em ${place}, plano ${number}`,
        ja: `独立した${tone}のフレーム。${who}、${place}、ショット ${number}`,
        fr: `Un cadre autonome ${tone} de ${who} dans ${place}, plan ${number}`,
        de: `Ein eigenständiges ${tone}-Bild von ${who} in ${place}, Einstellung ${number}`,
        it: `Un quadro autonomo ${tone} di ${who} in ${place}, inquadratura ${number}`
      }
      return table[lang]
    }
  }
]

const LOCATIONS = [
  [/^a far edge of (.+)$/, {
    'zh-Hans': place => `${place}的远处边缘`,
    pt: place => `uma margem distante de ${place}`,
    ja: place => `${place}の遠い端`,
    fr: place => `un bord lointain de ${place}`,
    de: place => `ein ferner Rand von ${place}`,
    it: place => `un bordo lontano di ${place}`
  }],
  [/^a close corner of (.+)$/, {
    'zh-Hans': place => `${place}的近角`,
    pt: place => `um canto próximo de ${place}`,
    ja: place => `${place}の近い隅`,
    fr: place => `un coin proche de ${place}`,
    de: place => `eine nahe Ecke von ${place}`,
    it: place => `un angolo vicino di ${place}`
  }],
  [/^ground level at (.+)$/, {
    'zh-Hans': place => `${place}的地面高度`,
    pt: place => `ao nível do chão em ${place}`,
    ja: place => `${place}の地面の高さ`,
    fr: place => `au niveau du sol à ${place}`,
    de: place => `auf Bodenhöhe bei ${place}`,
    it: place => `a livello del suolo a ${place}`
  }],
  [/^an overhead view of (.+)$/, {
    'zh-Hans': place => `${place}的俯视`,
    pt: place => `uma vista de cima de ${place}`,
    ja: place => `${place}の俯瞰`,
    fr: place => `une vue plongeante de ${place}`,
    de: place => `eine Aufsicht auf ${place}`,
    it: place => `una vista dall'alto di ${place}`
  }],
  [/^the shadowed side of (.+)$/, {
    'zh-Hans': place => `${place}的阴影一侧`,
    pt: place => `o lado em sombra de ${place}`,
    ja: place => `${place}の影の側`,
    fr: place => `le côté à l’ombre de ${place}`,
    de: place => `die schattige Seite von ${place}`,
    it: place => `il lato in ombra di ${place}`
  }],
  [/^a foreground detail within (.+)$/, {
    'zh-Hans': place => `${place}前景中的一个细节`,
    pt: place => `um detalhe em primeiro plano dentro de ${place}`,
    ja: place => `${place}の前景の細部`,
    fr: place => `un détail au premier plan dans ${place}`,
    de: place => `ein Vordergrunddetail in ${place}`,
    it: place => `un dettaglio in primo piano dentro ${place}`
  }],
  [/^eye level inside (.+)$/, {
    'zh-Hans': place => `${place}内的平视高度`,
    pt: place => `à altura dos olhos dentro de ${place}`,
    ja: place => `${place}の中の目の高さ`,
    fr: place => `à hauteur des yeux dans ${place}`,
    de: place => `auf Augenhöhe in ${place}`,
    it: place => `all’altezza degli occhi dentro ${place}`
  }],
  [/^the opposite side of (.+)$/, {
    'zh-Hans': place => `${place}的对面`,
    pt: place => `o lado oposto de ${place}`,
    ja: place => `${place}の反対側`,
    fr: place => `le côté opposé de ${place}`,
    de: place => `die gegenüberliegende Seite von ${place}`,
    it: place => `il lato opposto di ${place}`
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
    const ofWord = lang === 'zh-Hans' || lang === 'ja' ? '：' : ` ${phrase(lang, 'of')} `
    const joined = lang === 'zh-Hans' || lang === 'ja' ? `${frame}${ofWord}${action}` : `${frame}${ofWord}${action}`
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
    'zh-Hans': `制作一条 ${duration} 秒的 ${aspect} 镜头。`,
    pt: `Cria um plano de ${duration} segundos em ${aspect}.`,
    ja: `${duration}秒、${aspect} のショットを作る。`,
    fr: `Crée un plan de ${duration} secondes en ${aspect}.`,
    de: `Erzeuge eine ${duration}-Sekunden-Einstellung in ${aspect}.`,
    it: `Crea un’inquadratura di ${duration} secondi in ${aspect}.`
  }
  return table[lang] || `Create a ${duration}-second ${aspect} shot.`
}

function shotCountLine(lang, index, total) {
  const table = {
    'zh-Hans': `镜头 ${index} / ${total}。`,
    pt: `Plano ${index} de ${total}.`,
    ja: `ショット ${index} / ${total}。`,
    fr: `Plan ${index} sur ${total}.`,
    de: `Einstellung ${index} von ${total}.`,
    it: `Inquadratura ${index} di ${total}.`
  }
  return table[lang] || `Shot ${index} of ${total}.`
}

function independentShotLine(lang, index, total) {
  const table = {
    'zh-Hans': `独立镜头 ${index} / ${total}。一个单独的角度，不是延续。`,
    pt: `Plano independente ${index} de ${total}. Um ângulo à parte, não uma continuação.`,
    ja: `独立ショット ${index} / ${total}。別のアングルで、続きではない。`,
    fr: `Plan indépendant ${index} sur ${total}. Un angle à part, pas une suite.`,
    de: `Eigenständige Einstellung ${index} von ${total}. Ein eigener Winkel, keine Fortsetzung.`,
    it: `Inquadratura indipendente ${index} di ${total}. Un angolo a sé, non una continuazione.`
  }
  return table[lang] || `Independent shot ${index} of ${total}. A separate angle, not a continuation.`
}

function aspectLine(lang, aspect) {
  const table = {
    'zh-Hans': `画幅 ${aspect}`,
    pt: `proporção ${aspect}`,
    ja: `アスペクト比 ${aspect}`,
    fr: `format ${aspect}`,
    de: `Seitenverhältnis ${aspect}`,
    it: `formato ${aspect}`
  }
  return table[lang] || `aspect ratio ${aspect}`
}

function timingShort(lang, duration, aspect) {
  const table = {
    'zh-Hans': `${duration} 秒，${aspect}。不要字幕、标题、标志或水印。`,
    pt: `${duration}s, ${aspect}. Sem legendas, títulos, logótipos ou marcas de água.`,
    ja: `${duration}秒、${aspect}。字幕、タイトル、ロゴ、透かしは入れない。`,
    fr: `${duration} s, ${aspect}. Pas de sous-titres, titres, logos ni filigranes.`,
    de: `${duration}s, ${aspect}. Keine Untertitel, Titel, Logos oder Wasserzeichen.`,
    it: `${duration} s, ${aspect}. Niente sottotitoli, titoli, loghi o filigrane.`
  }
  return table[lang] || `${duration}s, ${aspect}. No captions, titles, logos or watermarks.`
}

function timingLong(lang, duration, aspect, index) {
  const table = {
    'zh-Hans': `${duration} 秒，${aspect}。镜头 ${index}。不要字幕、标题、标志或水印。`,
    pt: `${duration} segundos, ${aspect}. Plano ${index}. Sem legendas, títulos, logótipos ou marcas de água.`,
    ja: `${duration}秒、${aspect}。ショット ${index}。字幕、タイトル、ロゴ、透かしは入れない。`,
    fr: `${duration} secondes, ${aspect}. Plan ${index}. Pas de sous-titres, titres, logos ni filigranes.`,
    de: `${duration} Sekunden, ${aspect}. Einstellung ${index}. Keine Untertitel, Titel, Logos oder Wasserzeichen.`,
    it: `${duration} secondi, ${aspect}. Inquadratura ${index}. Niente sottotitoli, titoli, loghi o filigrane.`
  }
  return table[lang] || `${duration} seconds, ${aspect}. Shot ${index}. No captions, titles, logos or watermarks.`
}

function timingLabel(lang, duration) {
  const table = {
    'zh-Hans': `时长：${duration} 秒。不要字幕、标题、标志或水印。`,
    pt: `TEMPO: ${duration} segundos. Sem legendas, títulos, logótipos ou marcas de água.`,
    ja: `タイミング：${duration}秒。字幕、タイトル、ロゴ、透かしは入れない。`,
    fr: `DURÉE : ${duration} secondes. Pas de sous-titres, titres, logos ni filigranes.`,
    de: `ZEIT: ${duration} Sekunden. Keine Untertitel, Titel, Logos oder Wasserzeichen.`,
    it: `TEMPO: ${duration} secondi. Niente sottotitoli, titoli, loghi o filigrane.`
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
