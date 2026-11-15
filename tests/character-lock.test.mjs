import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, refreshProjectPrompts, splitShotByAction, SHORT_PROMPT_MAX } from '../app/utils/prompt-engine.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { exportAgentBoard, importAgentBoard } from '../app/utils/agent-board.js'
import { characterPacket, characterPacketMarkdown } from '../app/utils/character-packet.js'
import { lockLineFor } from '../app/utils/character-lock.js'
import { FRAMING_TERMS } from '../app/utils/framing.js'

const places = [
  { name: 'Street', description: 'a wet street' },
  { name: 'Roof', description: 'a dark roof' }
]

function scenarioBoard(characters, scenes, extra = {}) {
  return createStoryboard({
    style: 'cinema',
    genre: 'drama',
    scenario: { characters, places, scenes },
    ...extra
  })
}

const rui = { name: 'Rui', look: 'neighbour in his 50s, grey stubble, heavy eyebrows', outfit: 'navy peacoat and a rust-red scarf' }
const lena = { name: 'Lena', look: 'young baker, flour on her cheeks', outfit: 'cream apron' }
const maya = { name: 'Maya', look: 'early 30s, short black pixie cut, gold hoop earrings', outfit: 'oatmeal merino sweater and a charcoal wool coat' }
const kira = { name: 'Kira', look: '17, sharp silver undercut, amber eyes', outfit: 'black flight jacket with a torn red lining, scuffed combat boots' }
const oro = { name: 'Oro', look: 'older mentor, long white hair tied back, thin scar', outfit: 'ash-grey hakama, wrapped forearms' }

function lineFor(prompt, name) {
  return prompt.split('\n').find(item => item.startsWith(`${name} —`) || item.startsWith(`${name}.`))
}

test('bench lock lines are identical across shots and stay under 700 characters', () => {
  const bakery = scenarioBoard([lena, rui], [
    { who: 'Lena', where: 'Street', what: 'She opens the shutter', duration: 3 },
    { who: 'Rui', where: 'Street', what: 'He knocks on the window', duration: 3 },
    { who: 'Lena and Rui', where: 'Street', what: 'She hands him a pastry', duration: 4 },
    { who: 'Rui', where: 'Street', what: 'He waits in the rain', duration: 3 },
    { who: 'Lena and Rui', where: 'Street', what: 'He offers an umbrella', duration: 4 }
  ])
  const ruiLine = 'Rui — neighbour in his 50s, grey stubble, heavy eyebrows, navy peacoat and a rust-red scarf.'
  const ruiShots = bakery.shots.filter(shot => /Rui/.test(shot.who))
  ruiShots.forEach(shot => assert.equal(lineFor(shot.prompt, 'Rui'), ruiLine))
  assert.equal(lineFor(bakery.shots[0].prompt, 'Rui'), undefined)
  assert.match(bakery.shots[0].prompt, /Lena — young baker, flour on her cheeks, cream apron\./)
  const rain = scenarioBoard([kira, oro], [
    { who: 'Kira', where: 'Roof', what: 'She steps to the edge', duration: 3 },
    { who: 'Kira', where: 'Roof', what: 'She looks down', duration: 3 },
    { who: 'Oro', where: 'Street', what: 'He watches from the alley', duration: 3 },
    { who: 'Kira', where: 'Street', what: 'She lands in the alley', duration: 4 },
    { who: 'Kira and Oro', where: 'Street', what: 'He steadies her', duration: 4 }
  ])
  const kiraLine = lineFor(rain.shots[0].prompt, 'Kira')
  assert.match(kiraLine, /sharp silver undercut/)
  assert.match(kiraLine, /amber eyes/)
  assert.match(kiraLine, /black flight jacket with a torn red lining/)
  assert.equal((kiraLine.match(/black flight jacket/g) || []).length, 1)
  rain.shots.filter(shot => /Kira/.test(shot.who)).forEach(shot => assert.equal(lineFor(shot.prompt, 'Kira'), kiraLine))
  const oroLine = lineFor(rain.shots[2].prompt, 'Oro')
  assert.match(oroLine, /long white hair tied back/)
  assert.match(oroLine, /ash-grey hakama/)
  assert.equal((oroLine.match(/long white hair/g) || []).length, 1)
  const mayaBoard = scenarioBoard([maya, { name: 'Jun', look: 'late 20s, neat black hair', outfit: 'indigo work jacket' }], [
    { who: 'Maya', where: 'Street', what: 'She waits under the awning', duration: 3 },
    { who: 'Maya', where: 'Street', what: 'She turns toward the door', duration: 3 },
    { who: 'Jun', where: 'Street', what: 'He crosses the street', duration: 3 },
    { who: 'Maya', where: 'Street', what: 'She lifts a hand', duration: 3 },
    { who: 'Maya and Jun', where: 'Street', what: 'They share the umbrella', duration: 4 }
  ])
  const mayaLine = lineFor(mayaBoard.shots[0].prompt, 'Maya')
  assert.match(mayaLine, /short black pixie cut/)
  assert.match(mayaLine, /oatmeal merino sweater and a charcoal wool coat/)
  mayaBoard.shots.filter(shot => /Maya/.test(shot.who)).forEach(shot => assert.equal(lineFor(shot.prompt, 'Maya'), mayaLine))
  const boards = [bakery, rain, mayaBoard]
  boards.forEach(board => board.shots.forEach(shot => assert.ok(shot.prompt.length <= SHORT_PROMPT_MAX, shot.prompt.length)))
  const detailed = scenarioBoard([lena, rui], bakery.shots.map(shot => ({ who: shot.who, where: shot.where, what: shot.what, duration: shot.duration })), { promptStyle: 'detailed' })
  detailed.shots.filter(shot => /Rui/.test(shot.who)).forEach(shot => assert.ok(shot.prompt.includes(ruiLine)))
})

test('an edited lock line is pasted byte for byte and is not shortened', () => {
  const board = scenarioBoard([rui], [
    { who: 'Rui', where: 'Street', what: 'He knocks on the window', duration: 3 },
    { who: 'Rui', where: 'Street', what: 'He waits in the rain', duration: 3 }
  ])
  board.filmSheet.characters[0].lockLine = 'Rui — FIXED LOCK LINE.'
  board.filmSheet.characters[0].lockEdited = true
  board.shots[0].action = 'He crosses the square. '.repeat(80)
  board.shots[0].what = board.shots[0].action
  const next = refreshProjectPrompts(board)
  next.shots.forEach(shot => assert.ok(shot.prompt.includes('Rui — FIXED LOCK LINE.')))
  assert.equal(next.shots[0].prompt.split('Rui — FIXED LOCK LINE.').length - 1, 1)
  assert.equal((next.shots[0].prompt.match(/crosses the square/g) || []).length, 80)
  assert.ok(next.shots[1].prompt.length <= SHORT_PROMPT_MAX)
  const detailed = refreshProjectPrompts({ ...next, promptStyle: 'detailed' })
  assert.ok(detailed.shots[1].prompt.includes('Rui — FIXED LOCK LINE.'))
})

test('a declared wardrobe change carries forward and the identity stays fixed', () => {
  const board = scenarioBoard([rui], [
    { who: 'Rui', where: 'Street', what: 'He buttons his coat', duration: 3 },
    { who: 'Rui', where: 'Street', what: 'He steps inside', duration: 3 },
    { who: 'Rui', where: 'Street', what: 'He takes off the coat', duration: 3 },
    { who: 'Rui', where: 'Street', what: 'He sits by the window', duration: 3 }
  ])
  board.filmSheet.characters[0].states = [{ fromOrder: 3, change: 'coat removed' }]
  const next = refreshProjectPrompts(board)
  const early = lineFor(next.shots[0].prompt, 'Rui')
  const later = lineFor(next.shots[2].prompt, 'Rui')
  assert.equal(early, lineFor(next.shots[1].prompt, 'Rui'))
  assert.match(early, /navy peacoat/)
  assert.equal(later, lineFor(next.shots[3].prompt, 'Rui'))
  assert.match(later, /coat removed/)
  assert.doesNotMatch(later, /peacoat/)
  assert.ok(early.includes('neighbour in his 50s, grey stubble, heavy eyebrows'))
  assert.ok(later.includes('neighbour in his 50s, grey stubble, heavy eyebrows'))
  assert.equal(assessProject(next).some(item => item.code === 'missing_lock'), false)
  const undeclared = scenarioBoard([rui], [{ who: 'Rui', where: 'Street', what: 'He takes off the coat', duration: 3 }])
  assert.ok(assessProject(undeclared).some(item => item.code === 'undeclared_wardrobe' && item.fixId === 'declare-wardrobe' && item.phrase === 'coat removed'))
})

test('the continuity check flags a missing lock, a contradiction, a duplicate, and an unknown name', () => {
  const board = scenarioBoard([maya], [{ who: 'Maya', where: 'Street', what: 'She waits under the awning', duration: 3 }])
  const lock = lineFor(board.shots[0].prompt, 'Maya')
  board.shots[0].prompt = 'Style: quiet.\nAction: She waits.'
  board.shots[0].what = 'She flips her long blonde hair'
  board.shots[0].action = board.shots[0].what
  const missing = assessProject(board)
  assert.ok(missing.some(item => item.code === 'missing_lock' && item.fixId === 'insert-lock'))
  assert.ok(missing.some(item => item.code === 'conflicting_trait' && /blonde/.test(item.message)))
  board.shots[0].prompt = 'Kira — black flight jacket, scuffed combat boots, black flight jacket with a torn red lining.'
  board.shots[0].what = 'She waits'
  board.shots[0].action = 'She waits'
  const duplicated = assessProject(board)
  assert.ok(duplicated.some(item => item.code === 'duplicated_trait' && item.fixId === 'dedupe-traits'))
  assert.ok(duplicated.some(item => item.code === 'unknown_character' && item.name === 'Kira' && item.fixId === 'add-character'))
  assert.equal(lockLineFor(maya, 1).includes('short black pixie cut'), true)
})

test('several actions split into one shot each, and framing terms are English', () => {
  const board = scenarioBoard([lena], [
    { who: 'Lena', where: 'Street', what: 'She pours a latte. She runs to the door.', duration: 6 }
  ])
  const warning = assessProject(board).find(item => item.code === 'several_actions')
  assert.equal(warning.fixId, 'split-shot')
  const split = splitShotByAction(board, board.shots[0].id)
  assert.equal(split.shots.length, 2)
  assert.match(split.shots[0].action, /pours a latte/)
  assert.match(split.shots[1].action, /runs to the door/)
  assert.doesNotMatch(split.shots[0].action, /runs to the door/)
  split.shots.forEach(shot => assert.equal(lineFor(shot.prompt, 'Lena'), lineFor(split.shots[0].prompt, 'Lena')))
  const framed = createStoryboard({
    premise: 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.',
    scenes: [
      { action: 'The keeper looks up.', framing: 'gros plan', duration: 3 },
      { action: 'The keeper looks down from the gallery.', framing: 'plongée', duration: 3 }
    ]
  })
  assert.match(framed.shots[0].prompt, /close-up/i)
  assert.doesNotMatch(framed.shots[0].prompt, /gros plan/)
  assert.match(framed.shots[1].prompt, /high angle/i)
  assert.doesNotMatch(framed.shots[1].prompt, /plongée/)
  framed.shots.forEach(shot => {
    assert.ok(FRAMING_TERMS.some(term => shot.prompt.toLowerCase().includes(term.label.toLowerCase())))
  })
})

test('the character packet and the agent board include the lock and the sheet', () => {
  const board = scenarioBoard([{
    ...kira,
    body: 'slim, 17',
    hair: 'sharp silver undercut',
    sheet: { front: 'Front view, silver undercut, amber eyes.', side: 'Profile with the torn lining visible.', back: 'Back of the flight jacket.', expressions: 'Set jaw, alert eyes.', palette: 'black, silver, torn red', props: 'scuffed combat boots' }
  }], [{ who: 'Kira', where: 'Roof', what: 'She steps to the edge', duration: 3 }])
  const packet = characterPacket(board)
  assert.equal(packet.schema, 'moovicut.character-packet.v1')
  assert.match(packet.characters[0].lockLine, /sharp silver undercut/)
  assert.equal(packet.characters[0].sheet.front, 'Front view, silver undercut, amber eyes.')
  assert.equal(packet.shots[0].lockLines[0], packet.characters[0].lockLine)
  assert.equal(packet.shots[0].prompt.includes(packet.characters[0].lockLine), true)
  const markdown = characterPacketMarkdown(board)
  assert.match(markdown, /Lock line/)
  assert.match(markdown, /sharp silver undercut/)
  assert.match(markdown, /Front view, silver undercut/)
  assert.match(markdown, /Shot 1/)
  const agent = exportAgentBoard(board)
  assert.match(agent.filmSheet.characters[0].lockLine, /sharp silver undercut/)
  assert.equal(agent.filmSheet.characters[0].sheet.side, 'Profile with the torn lining visible.')
  assert.equal(agent.shots[0].lockLines[0], agent.filmSheet.characters[0].lockLine)
  assert.ok(FRAMING_TERMS.some(term => term.label === agent.shots[0].framing))
  const resumed = importAgentBoard(agent)
  assert.match(resumed.shots[0].prompt, /sharp silver undercut/)
  assert.equal(resumed.filmSheet.characters[0].sheet.props, 'scuffed combat boots')
})
