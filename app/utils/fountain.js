/** Fountain-like text mapped onto the existing scenario planner. No model call. */
import { cleanText } from './text.js'

const HEADING = /^(?:(INT|EXT|INT\.?\/EXT|I\/E)\.?)\s+(.+?)(?:\s+-\s+(.+))?$/i
const TIME = [
  [/dawn|sunrise|morning|aube|matin|amanhecer|morgen|alba|朝|晨/i, 'dawn'],
  [/dusk|sunset|evening|soir|crepusculo|crepúsculo|abend|tramonto|黄昏|夕/i, 'dusk'],
  [/night|nuit|noite|nacht|notte|夜/i, 'night'],
  [/day|noon|jour|dia|tag|giorno|昼|午/i, 'day']
]

function timeOf(label) {
  const value = String(label || '')
  const hit = TIME.find(([pattern]) => pattern.test(value))
  return hit ? hit[1] : ''
}

function splitBlocks(text) {
  return String(text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(item => item.trim()).filter(Boolean)
}

/**
 * CHARACTERS
 * Name — look — outfit
 *
 * INT. KITCHEN - DAWN
 * One action.
 */
export function parseFountain(text) {
  const blocks = splitBlocks(text)
  const characters = []
  const places = []
  const scenes = []
  let mode = ''
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
    const head = lines[0] || ''
    if (/^(characters|personnages|personen|personaggi|人物|キャラクター)$/i.test(head)) {
      mode = 'characters'
      lines.slice(1).forEach(line => {
        const parts = line.split(/\s+[—–-]\s+/).map(cleanText)
        if (!parts[0]) return
        characters.push({ name: parts[0], look: parts[1] || '', outfit: parts[2] || '' })
      })
      continue
    }
    const heading = head.match(HEADING)
    if (heading) {
      mode = 'scene'
      const place = cleanText(heading[2])
      const light = timeOf(heading[3])
      if (place && !places.some(item => item.name.toLowerCase() === place.toLowerCase())) {
        places.push({ name: place, description: place })
      }
      lines.slice(1).forEach(line => {
        if (!line || line.startsWith('#')) return
        scenes.push({ who: '', where: place, what: cleanText(line), ...(light ? { light } : {}) })
      })
      continue
    }
    if (mode === 'characters') {
      lines.forEach(line => {
        const parts = line.split(/\s+[—–-]\s+/).map(cleanText)
        if (!parts[0]) return
        characters.push({ name: parts[0], look: parts[1] || '', outfit: parts[2] || '' })
      })
    }
  }
  return { characters, places, scenes, light: scenes.find(scene => scene.light)?.light || '' }
}

export function isFountain(text) {
  return /^(?:INT|EXT|I\/E)\b/im.test(String(text || '')) || /^\s*CHARACTERS\s*$/im.test(String(text || ''))
}

/** Paste this into the model you already use. Moovicut does not call that model. */
export const FOUNTAIN_PROMPTS = Object.freeze({
  en: 'Turn the story below into a storyboard sheet. Use a CHARACTERS block, one person per line: Name — look — outfit. Then one scene heading per place or time change, written INT. or EXT. PLACE - TIME. Under each heading, one action per line. Do not add shots I did not imply. Keep my names and actions as written.\n\nSTORY\n',
  fr: 'Transforme le récit ci-dessous en feuille de storyboard. Bloc CHARACTERS, une personne par ligne : Nom — apparence — tenue. Puis un en-tête par changement de lieu ou de moment : INT. ou EXT. LIEU - MOMENT. Sous chaque en-tête, une action par ligne. N’ajoute pas de plan que je n’ai pas suggéré. Garde mes noms et mes actions tels quels.\n\nRÉCIT\n',
  de: 'Wandle die folgende Geschichte in ein Storyboard. Block CHARACTERS, eine Person pro Zeile: Name — Aussehen — Kleidung. Dann eine Szenenüberschrift je Orts- oder Zeitwechsel: INT. oder EXT. ORT - ZEIT. Darunter eine Handlung pro Zeile. Füge keine Einstellung hinzu, die ich nicht angelegt habe. Lass Namen und Handlungen unverändert.\n\nGESCHICHTE\n',
  pt: 'Transforma a história abaixo numa folha de storyboard. Bloco CHARACTERS, uma pessoa por linha: Nome — aspeto — roupa. Depois um cabeçalho por mudança de lugar ou de hora: INT. ou EXT. LUGAR - HORA. Sob cada cabeçalho, uma ação por linha. Não acrescentes planos que eu não tenha sugerido. Mantém os nomes e as ações como estão.\n\nHISTÓRIA\n',
  it: 'Trasforma la storia qui sotto in un foglio di storyboard. Blocco CHARACTERS, una persona per riga: Nome — aspetto — abiti. Poi un’intestazione per ogni cambio di luogo o di tempo: INT. o EXT. LUOGO - TEMPO. Sotto ogni intestazione, un’azione per riga. Non aggiungere inquadrature che non ho suggerito. Lascia nomi e azioni come sono.\n\nSTORIA\n',
  ja: '次の物語をストーリーボードにしてください。CHARACTERS ブロックに、一人一行で「名前 — 見た目 — 服装」。場所か時刻が変わるたびに見出しを一行：INT. または EXT. 場所 - 時刻。見出しの下は、動作を一行に一つ。書いていないショットは足さないでください。名前と動作はそのまま残してください。\n\n物語\n',
  'zh-Hans': '把下面的故事写成分镜表。CHARACTERS 块里每人一行：名字 — 外形 — 服装。地点或时间一变就写一行标题：INT. 或 EXT. 地点 - 时间。每个标题下面，一个动作占一行。不要添加我没有写出的镜头。名字和动作保持原样。\n\n故事\n'
})
