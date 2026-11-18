/** A capitalised actor with no sheet. No lock is invented for that name. */
import { foldName } from './scenario.js'
import { isFunctionWord, isNumberWord } from './scene-split.js'
import { placeIsSure } from './place-lexicon.js'
import { warningAction } from './warning-action.js'

const NOT_NAME = new Set([
  'early', 'together', 'late', 'suddenly', 'finally', 'meanwhile', 'soon', 'inside', 'outside', 'later',
  'yesterday', 'tomorrow', 'tonight', 'today', 'once', 'still', 'already', 'then', 'after', 'before',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'segunda', 'terca', 'terça', 'quarta', 'quinta', 'sexta', 'sabado', 'sábado', 'domingo',
  'janeiro', 'fevereiro', 'marco', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  'the', 'a', 'an', 'she', 'he', 'they', 'her', 'his', 'ela', 'ele', 'eles', 'elas',
  'na', 'no', 'nas', 'nos', 'em', 'ao', 'aos', 'de', 'do', 'da', 'dos', 'das', 'um', 'uma',
  'place', 'shot', 'style', 'camera', 'light', 'opening', 'part'
])

const ACTOR_NEXT = /^(?:acena|acenam|ajuda|ajudam|caminha|caminham|corre|correm|espera|esperam|canta|cantam|dança|danca|dançam|fala|falam|olha|olham|fotografa|fotografam|anota|anotam|aponta|apontam|ri|riem|paga|pagam|embrulha|embrulham|sobe|sobem|entra|entram|sai|saem|voa|voam|observa|observam|leva|levam|traz|trazem|pega|pegam|põe|poe|põem|veste|vestem|tira|tiram|mostra|mostram|segura|seguram|entrega|entregam|dá|dao|dão|abre|abrem|fecha|fecham|lê|le|escreve|escrevem|sorri|sorriem|acende|pinta|pintam|benze|reza|aplaude|cumprimenta|senta|sentam|boceja|lava|lavam|nada|nadam|surfa|surfam|rema|remam|grita|gritam|conta|contam|temper|distribui|explica|testa|encera|hasteia|descasca|bate|puxa|cai|aponta|flies|fly|waits|wait|walks|walk|waves|wave|helps|help|gives|give|looks|look|sings|sing|stands|stand|sits|sit|runs|run|enters|enter|opens|open|checks|check|reads|read|writes|write|smiles|smile|nods|nod|pays|pay|laughs|laugh|points|point|notes|note|watches|watch|hands|hand|boards|board|starts|start|lights|light|turns|turn|holds|hold|carries|carry|wears|wear|takes|take|puts|put|drops|drop|picks|pick|returns|return|steps|step|crosses|cross|calls|call|meets|meet|leaves|leave|goes|go|comes|come)$/iu

const OBJECT_BEFORE = /(?<![\p{L}])(?:ajuda|ajudam|helps?|gives?|hands?|looks?\s+at|olha(?:m)?\s+para|dá|dão|dao|entrega(?:m)?|mostra(?:m)?|chama(?:m)?)\s+(?:a\s+|o\s+|os\s+|as\s+|the\s+|to\s+|for\s+)?$/iu
const BODY_BEFORE = /(?<![\p{L}])(?:testa|mão|mao|maos|mãos|hand|hands|rosto|face|ombro|ombros|shoulder|shoulders|braço|braco|arm|arms|cabeça|cabeca|head|colo|lap|bochecha|cheek|olho|olhos|eye|eyes)\s+(?:de|do|da|dos|das|of)\s+$/iu

function tokensOf(text) {
  return [...String(text || '').matchAll(/[\p{L}][\p{L}'’-]+/gu)].map(match => ({ word: match[0], index: match.index }))
}

function sheetedName(name, characters) {
  const key = foldName(name)
  if (!key) return true
  return (characters || []).some(person => {
    const full = foldName(person?.name)
    if (!full) return false
    if (full === key) return true
    const parts = String(person.name).split(/\s+/).map(foldName).filter(part => part.length >= 3)
    if (!parts.includes(key)) return false
    const owners = characters.filter(other => String(other?.name || '').split(/\s+/).some(part => foldName(part) === key))
    return owners.length === 1
  })
}

function blockedToken(word) {
  const key = foldName(word)
  if (!key || key.length < 2) return true
  if (NOT_NAME.has(key)) return true
  if (isFunctionWord(word) || isNumberWord(word)) return true
  if (placeIsSure('en', key) || placeIsSure('pt', key)) return true
  return false
}

function editDistance(left, right) {
  const a = foldName(left)
  const b = foldName(right)
  if (!a || !b || Math.abs(a.length - b.length) > 2) return 99
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = a[i - 1] === b[j - 1] ? previous : 1 + Math.min(previous, row[j], row[j - 1])
      previous = saved
    }
  }
  return row[b.length]
}

function suggestionFor(name, characters) {
  let best = ''
  let bestDistance = 99
  let ties = 0
  for (const person of characters || []) {
    const full = String(person?.name || '').trim()
    if (!full) continue
    const parts = full.split(/\s+/).filter(part => foldName(part).length >= 3)
    const distance = Math.min(editDistance(name, full), ...parts.map(part => editDistance(name, part)), ...name.split(/\s+/).map(part => Math.min(editDistance(part, full), ...parts.map(bit => editDistance(part, bit)))))
    if (distance < 1 || distance > 2) continue
    if (distance < bestDistance) {
      best = full
      bestDistance = distance
      ties = 1
    } else if (distance === bestDistance && foldName(full) !== foldName(best)) ties += 1
  }
  return ties === 1 ? best : ''
}

/** Capitalised actors in this beat who do not resolve to a sheet. */
export function unsheetedActors(text, characters = []) {
  const words = tokensOf(text)
  const found = []
  const push = name => {
    const clean = String(name || '').trim()
    if (!clean || blockedToken(clean.split(/\s+/)[0]) || clean.split(/\s+/).some(blockedToken)) return
    if (sheetedName(clean, characters)) return
    if (found.some(item => foldName(item) === foldName(clean))) return
    found.push(clean)
  }
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index].word
    if (!/^\p{Lu}/u.test(word) || blockedToken(word)) continue
    const parts = [word]
    let cursor = index
    while (cursor + 1 < words.length) {
      const next = words[cursor + 1]
      const gap = String(text).slice(words[cursor].index + words[cursor].word.length, next.index)
      if (!/^\s+$/u.test(gap) || !/^\p{Lu}/u.test(next.word) || blockedToken(next.word)) break
      parts.push(next.word)
      cursor += 1
    }
    const name = parts.join(' ')
    const before = String(text).slice(Math.max(0, words[index].index - 48), words[index].index)
    const after = words[cursor + 1]?.word || ''
    const atSentenceStart = !String(text).slice(0, words[index].index).trim() || /[.!?。！？]\s*$/u.test(String(text).slice(0, words[index].index))
    const follows = /^\p{Ll}/u.test(after) && foldName(after).length >= 3 && !isFunctionWord(after) && !NOT_NAME.has(foldName(after))
    const acts = (atSentenceStart && (follows || ACTOR_NEXT.test(after))) || OBJECT_BEFORE.test(before) || BODY_BEFORE.test(before)
    if (acts) push(name)
    index = cursor
  }
  return found
}

/** One warning per unsourced name, with the scene indexes and an optional near-match. */
export function nameWithoutSheetWarnings(project) {
  const characters = project?.filmSheet?.characters || []
  const ignored = new Set((project?.ignoredNames || []).map(foldName))
  const grouped = new Map()
  ;(project?.shots || []).forEach((shot, index) => {
    const text = [shot?.action, shot?.what].filter(Boolean).join(' ')
    const order = shot?.order || index + 1
    unsheetedActors(text, characters).forEach(name => {
      if (ignored.has(foldName(name))) return
      const row = grouped.get(foldName(name)) || { name, scenes: [], shotId: shot.id || shot.shot_id || '' }
      if (!row.scenes.includes(order)) row.scenes.push(order)
      grouped.set(foldName(name), row)
    })
  })
  return [...grouped.values()].map(row => {
    const didYouMean = suggestionFor(row.name, characters)
    const scenes = row.scenes.join(', ')
    return {
      code: 'name_without_sheet',
      name: row.name,
      scenes: row.scenes,
      ...(didYouMean ? { did_you_mean: didYouMean } : {}),
      shotId: row.shotId,
      order: row.scenes[0],
      message: `${row.name} is named in the story and has no character sheet.`,
      fix: didYouMean
        ? `Did you mean ${didYouMean}? Create a sheet for ${row.name}, or ignore it if it is not a name. Scenes ${scenes}.`
        : `Create a sheet for ${row.name}, or ignore it if it is not a name. Scenes ${scenes}.`,
      fixId: 'create-sheet',
      action: warningAction('name_without_sheet')
    }
  })
}
