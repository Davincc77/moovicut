/** Contrat de provenance par shot : la page /story et le wizard doivent pouvoir dire,
 *  sans appel de modèle, d'où vient chaque plan : texte de l'utilisateur, extrait de sa
 *  prose, proposé par le moteur, ou édité à la main. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { shotProvenance, coverage, storyToBoard } from '../app/utils/story-provenance.js'
import { blankWizard, setIdea, applyIdeaDetection, continueStep, acceptSplit, wizardScenario, normalizeWizard, projectFromWizard } from '../app/utils/wizard.js'
import { serializeProject, validateProject } from '../app/utils/prompt-engine.js'

const STORY = 'A baker in Lisbon discovers her sourdough starter glows at midnight. She carries it down to the Tagus. The river answers with light.'

function scenarioBoard() {
  return storyToBoard(STORY).board
}

test('board scenario depuis la prose : chaque shot connait sa phrase', () => {
  const board = scenarioBoard()
  const withSource = board.shots.filter(shot => shot.source)
  assert.ok(withSource.length >= 2, `phrases portees: ${withSource.length}`)
  assert.equal(shotProvenance(board.shots.find(shot => shot.source), {}), 'extracted')
})

test('un prompt edite a la main passe a edited', () => {
  assert.equal(shotProvenance({ order: 1, action: 'She runs', source: 'She runs home.', prompt: 'x', promptEdited: true }, {}), 'edited')
})

test('shot sans source ni marque = le moteur propose', () => {
  assert.equal(shotProvenance({ order: 1, action: 'Opening tableau', source: '' }, {}), 'suggested')
})

test('l action reprise de l ideée porte est votre texte', () => {
  const state = setIdea(blankWizard(), STORY)
  assert.equal(shotProvenance({ action: state.idea, source: '' }, { idea: state.idea }), 'yours')
})

test('wizard : source survit etat -> normalize -> scenario -> projet', () => {
  let state = applyIdeaDetection(setIdea(blankWizard(), STORY))
  state = continueStep(state)
  const c = state.characters[0]
  if (c) { c.age = 'thirties'; c.build = 'stocky, round face'; c.hair = 'dark curly hair' }
  state = continueStep(state)
  state.mood = 'grounded'
  state.moodOrigin = 'user'
  state = continueStep(state)
  state.shots.forEach(shot => { if (!shot.framing) shot.framing = 'medium' })
  const persisted = normalizeWizard(JSON.parse(JSON.stringify(state)))
  assert.ok(persisted.shots.some(shot => shot.source && shot.source.length > 10), 'la source survit au roundtrip localStorage')
  const scenes = wizardScenario(persisted).scenes
  assert.ok(scenes.some(scene => scene.source), 'wizardScenario transmet source aux scenes')
  const project = projectFromWizard(persisted, { id: 'prov', promptLanguage: 'en' })
  assert.ok(project.shots.some(shot => shot.source), 'le projet porte la source')
  const serialized = JSON.parse(serializeProject(project))
  assert.ok(serialized.shots.some(shot => shot.source), 'la source survit a la serialisation')
  const back = validateProject(serialized)
  assert.ok(back.project.shots.some(shot => shot.source), 'la source survit a revalidation')
})

test('coverage : part des shots issus du texte', () => {
  const board = scenarioBoard()
  const c = coverage(board.shots, STORY)
  assert.equal(typeof c.total, 'number')
  assert.ok(c.fromText >= 2 && c.fromText <= c.total)
  assert.match(c.text, /of \d+ shots/i)
})

test('acceptSplit preserve la source quand elle existe', () => {
  let state = applyIdeaDetection(setIdea(blankWizard(), STORY))
  state = continueStep(state)
  const c2 = state.characters[0]
  if (c2) { c2.age = 'thirties'; c2.build = 'stocky'; c2.hair = 'dark curls' }
  state = continueStep(state)
  state.mood = 'grounded'; state.moodOrigin = 'user'
  state = continueStep(state)
  const parent = state.shots.find(shot => shot.source || shot.action)
  const split = acceptSplit(state, parent.id)
  if (split.shots.length > state.shots.length) {
    assert.ok(split.shots.every(shot => 'source' in shot), 'chaque part herite du champ source')
  }
})
