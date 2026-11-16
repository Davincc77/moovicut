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
  let placeName = ''
  let placeLight = ''
  const takeLine = (line, speakerBox) => {
    if (!line || line.startsWith('#')) return
    if (/^\([^)]+\)$/.test(line)) return
    const spoken = /^[\p{Lu}0-9][\p{Lu}0-9 .''-]{0,40}$/u.test(line) && line === line.toUpperCase() && !/^(?:INT|EXT|I\/E)\b/.test(line)
    if (spoken) {
      speakerBox.name = cleanText(line.replace(/\s*\^$/, ''))
      if (speakerBox.name && !characters.some(person => person.name.toLowerCase() === speakerBox.name.toLowerCase())) {
        characters.push({ name: speakerBox.name, look: '', outfit: '' })
      }
      return
    }
    const named = characters.find(person => line.toLowerCase().startsWith(`${person.name.toLowerCase()} `) || line.toLowerCase() === person.name.toLowerCase())
    const who = named?.name || speakerBox.name || ''
    scenes.push({
      who,
      where: placeName,
      what: cleanText(line),
      source: cleanText(line),
      flags: who ? (named ? [] : [{ field: 'who', code: 'who_dialogue' }]) : [{ field: 'who', code: 'who_missing' }],
      ...(placeLight ? { light: placeLight } : {})
    })
    if (named) speakerBox.name = ''
  }
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
      placeName = cleanText(heading[2])
      placeLight = timeOf(heading[3])
      if (placeName && !places.some(item => item.name.toLowerCase() === placeName.toLowerCase())) {
        places.push({ name: placeName, description: placeName })
      }
      const speakerBox = { name: '' }
      lines.slice(1).forEach(line => takeLine(line, speakerBox))
      continue
    }
    if (mode === 'scene') {
      const speakerBox = { name: '' }
      lines.forEach(line => takeLine(line, speakerBox))
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
  pt: 'Transforma a história abaixo numa folha de storyboard. Bloco CHARACTERS, uma pessoa por linha: Nome — aspeto — roupa. Depois um cabeçalho por mudança de lugar ou de hora: INT. ou EXT. LUGAR - HORA. Sob cada cabeçalho, uma ação por linha. Não acrescentes planos que eu não tenha sugerido. Mantém os nomes e as ações como estão.\n\nHISTÓRIA\n'
})
