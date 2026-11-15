/** Zero-token continuity check. Warnings never block a board. */
import { findByName, foldName } from './scenario.js'
import { charactersInShot, conflictingTrait, lockLineFor, repeatedTraits, wardrobeChangeNote } from './character-lock.js'
import { promptHasFraming } from './framing.js'
import { splitActionText } from './action-split.js'

function warning(shot, code, message, fix, extra = {}) {
  return { shotId: shot.id || shot.shot_id, order: shot.order, code, message, fix, ...extra }
}

function outsideText(shot, locks) {
  let prompt = String(shot.prompt || '')
  locks.forEach(line => { prompt = prompt.split(line).join(' ') })
  return [prompt, shot.action, shot.what, shot.notes].filter(Boolean).join('\n')
}

export function continuityWarnings(shot, project = {}) {
  const warnings = []
  const order = shot.order || 1
  const cast = charactersInShot(shot, project)
  const locks = cast.map(character => ({ character, line: lockLineFor(character, order) })).filter(item => item.line)
  const prompt = String(shot.prompt || '')
  locks.forEach(({ character, line }) => {
    if (prompt.includes(line)) return
    const state = (character.states || []).find(item => item.fromOrder <= order && item.change && line.includes(item.change))
    if (state && !prompt.includes(state.change)) {
      warnings.push(warning(
        shot,
        'wardrobe_state',
        `${character.name} changed wardrobe at shot ${state.fromOrder} (${state.change}), and this prompt dropped that change.`,
        'Put the carried lock line back into this prompt.',
        { fixId: 'insert-lock', name: character.name }
      ))
      return
    }
    warnings.push(warning(
      shot,
      'missing_lock',
      `${character.name} is in this shot without the exact lock line.`,
      'Paste the lock line into this prompt.',
      { fixId: 'insert-lock', name: character.name }
    ))
  })
  const outside = outsideText(shot, locks.map(item => item.line))
  locks.forEach(({ character, line }) => {
    const conflict = conflictingTrait(line, outside)
    if (!conflict) return
    warnings.push(warning(
      shot,
      'conflicting_trait',
      `${character.name}: “${conflict.phrase}” contradicts the lock (${conflict.kind}).`,
      `Use ${conflict.replacement} from the character sheet.`,
      { fixId: 'drop-conflict', name: character.name, phrase: conflict.phrase, replacement: conflict.replacement }
    ))
  })
  prompt.split('\n').forEach(line => {
    repeatedTraits(line).forEach(trait => {
      warnings.push(warning(
        shot,
        'duplicated_trait',
        `“${trait}” is repeated in the same line.`,
        'Keep that trait once.',
        { fixId: 'dedupe-traits', phrase: trait }
      ))
    })
  })
  const known = project.filmSheet?.characters || []
  prompt.split('\n').forEach(line => {
    const named = line.match(/^([\p{L}][\p{L}'’ .-]{0,48}) — /u)
    if (!named) return
    const name = named[1].trim()
    if (!name || findByName(known, name)) return
    if (foldName(name) === 'style' || foldName(name) === 'camera') return
    warnings.push(warning(
      shot,
      'unknown_character',
      `${name} is not on the film sheet.`,
      `Add ${name} to the character sheet, or remove the name.`,
      { fixId: 'add-character', name }
    ))
  })
  cast.forEach(character => {
    const note = wardrobeChangeNote(`${shot.action || ''} ${shot.what || ''}`)
    if (!note) return
    const declared = (character.states || []).some(item => item.fromOrder <= order && foldName(item.change) === foldName(note))
    if (declared) return
    warnings.push(warning(
      shot,
      'undeclared_wardrobe',
      `${character.name} changes wardrobe here (${note}), and later shots still use the original outfit.`,
      'Declare the change so it carries forward.',
      { fixId: 'declare-wardrobe', name: character.name, phrase: note }
    ))
  })
  if (prompt && !promptHasFraming(prompt)) {
    warnings.push(warning(
      shot,
      'missing_framing',
      'This prompt has no framing term from the shot list.',
      'Add one English framing term, such as wide shot or close-up.',
      { fixId: 'apply-framing' }
    ))
  }
  const action = shot.what || shot.action || ''
  if (splitActionText(action).length >= 2) {
    const already = false
    if (!already) {
      warnings.push(warning(
        shot,
        'several_actions',
        'This shot asks for more than one action.',
        'Split it so each new shot has one action.',
        { fixId: 'split-shot' }
      ))
    }
  }
  return warnings
}
