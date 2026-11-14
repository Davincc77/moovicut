import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, regenerateOneShot } from '../app/utils/prompt-engine.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const premise = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'

test('a default board has no risk warnings', () => {
  const board = createStoryboard({ premise })
  assert.deepEqual(assessProject(board), [])
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ premise, compact: true })
  })
  const body = JSON.parse(response.body)
  assert.deepEqual(Object.keys(body).sort(), ['aspectRatio', 'model', 'premise', 'shots', 'studioUrl', 'title'])
})

test('risk checks warn and never block', () => {
  const board = createStoryboard({
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small cafe' }],
      scenes: [
        { who: 'Léa', where: 'Café', what: 'She pours a latte and then she runs', duration: 3 },
        { who: 'Léa', where: 'Café', what: 'A title card reads hello' },
        { who: 'Léa', where: 'Café', what: 'A crowd fills the room' },
        { who: 'Léa and Marc and Noor', where: 'Station', what: 'They wait' },
        { who: 'Léa', where: 'Café', what: 'She looks up', camera: 'push' }
      ]
    }
  })
  board.shots[4].camera = 'Slow push-in and a pull-back'
  const warnings = assessProject(board)
  const codes = warnings.map(item => item.code)
  assert.ok(codes.includes('too_many_actions'))
  assert.ok(codes.includes('on_screen_text'))
  assert.ok(codes.includes('crowd'))
  assert.ok(codes.includes('too_many_characters'))
  assert.ok(codes.includes('unresolved_character'))
  assert.ok(codes.includes('unresolved_place'))
  assert.ok(codes.includes('conflicting_camera'))
  assert.ok(warnings.every(item => item.fix && item.shotId))
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({
      premise: 'A short cafe story for the board.',
      scenario: {
        characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
        places: [{ name: 'Café', description: 'a small cafe' }],
        scenes: [{ who: 'Léa', where: 'Café', what: 'A crowd fills the cafe' }]
      },
      compact: true
    })
  })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.warnings[0].code, 'crowd')
})

test('regenerating one shot leaves the others and an edited prompt untouched', () => {
  const board = createStoryboard({ premise, shots: 3 })
  const original = board.shots.map(shot => shot.prompt)
  board.shots[1].prompt = 'KEEP THIS LINE'
  board.shots[1].promptEdited = true
  const skipped = regenerateOneShot(board, 'shot-02')
  assert.equal(skipped.skipped, true)
  assert.equal(skipped.project.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(skipped.project.shots[0].prompt, original[0])
  assert.equal(skipped.project.shots[2].prompt, original[2])
  const rebuilt = regenerateOneShot(board, board.shots[0].id, { overwrite: true })
  assert.equal(rebuilt.skipped, false)
  assert.equal(rebuilt.project.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(rebuilt.project.shots[2].prompt, original[2])
  assert.match(rebuilt.project.shots[0].prompt, /Idea:/)

  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify({ project: board, regenerateShot: 'shot-02', compact: true })
  })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.equal(body.kept, true)
  assert.equal(body.shots[1].prompt, 'KEEP THIS LINE')
  assert.equal(body.shots[0].prompt, original[0])
})
