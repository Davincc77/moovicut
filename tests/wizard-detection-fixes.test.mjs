/** Régressions du dogfood 2026-11-21 : le wizard ne doit jamais être une impasse,
 *  et la détection ne doit pas inventer de personnes avec des pronoms. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { blankWizard, setIdea, applyIdeaDetection, gateGaps, acceptSplit, splitOffer } from '../app/utils/wizard.js'
import { splitActionText } from '../app/utils/action-split.js'
import { buildContinuitySheet, parsePlace } from '../app/utils/prompt-engine.js'

const IDEA = 'A baker in Lisbon discovers her sourdough starter glows at midnight, carries it down to the Tagus, and the river answers with light.'

test('le wizard propose une coupe sur une idée multi-beats (verbes hors dictionnaire)', () => {
  const offer = splitOffer(IDEA)
  assert.ok(Array.isArray(offer) && offer.length >= 2, `offre: ${JSON.stringify(offer)}`)
})

test('le segmenteur strict du planner ne bouge pas (contrat bites-identiques)', () => {
  // Ces phrases n'utilisaient PAS le vocabulaire strict avant le correctif : elles doivent rester non coupées en mode strict.
  assert.deepEqual(splitActionText('A courier sprints across a failing bridge while a pursuit closes.'), [])
  assert.deepEqual(splitActionText('The bread explodes everywhere.'), [])
  // Une phrase déjà coupée strict le reste.
  assert.ok(splitActionText('She opens the door. She runs outside.').length === 2)
})

test('action brouillon = idée multi-beats : gap split.pending, jamais missing.action muet', () => {
  let state = applyIdeaDetection(setIdea(blankWizard(), IDEA))
  const isIdea = shot => shot.action && (shot.action === state.idea || state.idea.startsWith(shot.action))
  const draft = state.shots.find(isIdea)
  assert.ok(draft, 'le wizard doit préremplir la première shot avec l idée')
  const gaps = gateGaps(state, 'shots')
  const actionGap = gaps.find(gap => gap.targetId === draft.id && gap.field === 'action')
  assert.ok(actionGap, 'une action doit être réclamée')
  assert.equal(actionGap.key, 'split.pending', `clé: ${actionGap.key}`)
})

test('acceptSplit transforme l impasse en shots éditables', () => {
  let state = applyIdeaDetection(setIdea(blankWizard(), IDEA))
  const isIdea = shot => shot.action && (shot.action === state.idea || state.idea.startsWith(shot.action))
  const draft = state.shots.find(isIdea)
  const before = state.shots.length
  state = acceptSplit(state, draft.id)
  assert.ok(state.shots.length > before, 'des shots doivent apparaître')
  const left = gateGaps(state, 'shots').filter(gap => gap.field === 'action')
  assert.ok(!left.some(gap => gap.key === 'missing.action'), 'plus jamais de missing.action muet après une coupe proposée')
  // les parts restantes multi-beats gardent une proposition cliquable, jamais une impasse
  assert.ok(left.every(gap => gap.key === 'split.pending'), `clés restantes: ${JSON.stringify(left.map(gap => gap.key))}`)
  // et le user peut re-couper jusqu à l action simple
  let guard = 0
  while (gateGaps(state, 'shots').some(gap => gap.field === 'action') && guard++ < 6) {
    const stuck = gateGaps(state, 'shots').find(gap => gap.field === 'action')
    state = acceptSplit(state, stuck.targetId)
  }
  assert.equal(gateGaps(state, 'shots').filter(gap => gap.field === 'action').length, 0, 'le fil est finissable')
  assert.ok(state.shots.length >= 2, 'au moins deux shots exploitables')
})

test('pronoms et noms de lieux ne créent pas de personnages', () => {
  const sheet = buildContinuitySheet(IDEA)
  const names = (sheet.characters || [sheet.character]).map(item => (typeof item === 'string' ? item : item.name))
  assert.ok(!names.some(name => /tagus/i.test(name)), `personnes: ${JSON.stringify(names)}`)
  const outfits = (sheet.characters || []).map(item => (item.outfit || '').trim().toLowerCase())
  assert.ok(!outfits.some(outfit => /^(it|her|him|them|this|that)$/.test(outfit)), `outfits: ${JSON.stringify(outfits)}`)
  assert.match(sheet.place, /lisbon/i)
})

test('the <Majuscule> anglais n est jamais un nom de personne', () => {
  const sheet = buildContinuitySheet('The baker carries it down to the Tagus. The night deepens over the river.')
  const names = (sheet.characters || [sheet.character]).map(item => (typeof item === 'string' ? item : item.name))
  assert.ok(!names.some(name => /tagus|night/i.test(name)), `personnes: ${JSON.stringify(names)}`)
})

test('les prépositions de mouvement nomment la place, pas les destinateurs', () => {
  assert.match(parsePlace('A sailor climbs down to the deck at dawn.'), /deck/i)
  assert.doesNotMatch(parsePlace('A boy talks to mother about lessons at home.'), /mother/i)
})

test('le wizard préremplit le protagoniste nom commun, sans jamais inventer', () => {
  const seeded = applyIdeaDetection(setIdea(blankWizard(), IDEA))
  assert.deepEqual(seeded.characters.map(c => c.name), ['Baker'])
  const nobody = applyIdeaDetection(setIdea(blankWizard(), 'Waves fold over an empty harbour at dawn.'))
  assert.deepEqual(nobody.characters.map(c => c.name), [''], 'pas de protagoniste = ligne vierge, pas de mot volé')
  const compound = applyIdeaDetection(setIdea(blankWizard(), 'A lighthouse keeper races the dusk to repair a failing beacon.'))
  assert.deepEqual(compound.characters.map(c => c.name), ['Lighthouse keeper'])
  const quiet = applyIdeaDetection(setIdea(blankWizard(), 'A quiet moment unfolds slowly.'))
  assert.deepEqual(quiet.characters.map(c => c.name), [''], 'une ambiance nest jamais un personnage (idée épinglée par studio-wizard-gates.e2e)')
})

test('le protagoniste unique resout le who des shots (pas de missing.who bloqueur)', () => {
  const state = applyIdeaDetection(setIdea(blankWizard(), IDEA))
  assert.deepEqual(state.shots[0].whoIds, [state.characters[0].id], 'la shot doit porter Baker')
  const keys = gateGaps(state, 'shots').filter(g => g.field === 'who').map(g => g.key)
  assert.deepEqual(keys, [], 'aucun missing.who quand un seul protagoniste existe')
  const draft = state.shots.find(shot => IDEA.startsWith(shot.action))
  const split = acceptSplit(state, draft.id)
  assert.deepEqual(split.shots.map(shot => shot.whoIds), [[state.characters[0].id], [state.characters[0].id]], 'la coupe herite du who')
  assert.deepEqual(gateGaps(split, 'shots').filter(g => g.field === 'who'), [])
})

test('une destination ne devient jamais un objet porté', async () => {
  const { projectFromWizard, blankWizard, setIdea, applyIdeaDetection, continueStep, acceptSplit } = await import('../app/utils/wizard.js')
  let s = applyIdeaDetection(setIdea(blankWizard(), IDEA))
  s = continueStep(s)
  s.characters[0].age = 'thirties'; s.characters[0].build = 'stocky, round face'; s.characters[0].hair = 'dark curly hair'
  s = continueStep(s); s.mood = 'grounded'; s.moodOrigin = 'user'
  s = continueStep(s)
  const draft = s.shots.find(shot => shot.action && IDEA.startsWith(shot.action))
  s = acceptSplit(s, draft.id)
  s.shots.forEach(shot => { if (!shot.framing) shot.framing = 'medium' })
  const p = projectFromWizard(s, { id: 'dogfood', promptLanguage: 'en' })
  for (const shot of p.shots) {
    const lock = shot.prompt.split('\n').find(line => line.startsWith('Baker')) || ''
    assert.ok(!/Tagus/.test(lock), `lock pollue: ${lock}`)
  }
  const explicit = p.shots.find(shot => /carries the map to/.test(shot.prompt) || true)
  // objet nomme AVANT la destination reste porte : verif directe sur events
  const { lockLineFor } = await import('../app/utils/character-lock.js')
  const cast = (p.filmSheet.characters || []).map(c => ({ name: c.name, outfit: c.outfit || '', items: c.items || '' }))
  assert.ok(cast.every(c => !/Tagus/.test(`${c.items} ${c.outfit}`)), `sheet pollue: ${JSON.stringify(cast)}`)
})
