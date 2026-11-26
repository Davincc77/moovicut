/** Short story = 600..8000 characters. Below that the text is an idea: the Studio's job.
 *  /story refuses it (with a hand-off), the API prose path plans it but says so. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STORY_MIN_CHARS, SCENARIO_MAX_CHARS, storyLength } from '../app/utils/scenario.js'
import { storyToBoard, storyErrorFor } from '../app/utils/story-provenance.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const SENTENCE = 'A baker in Lisbon discovers her sourdough starter glows at midnight. '
const idea = 'A noir detective chases a suspect through a rain-soaked neon city at night.'
function storyOf(length) {
  let text = ''
  while (text.length < length) text += SENTENCE
  return text.slice(0, length).trimEnd() + (text.slice(0, length).endsWith('.') ? '' : '.')
}

function plan(body) {
  const response = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify(body) })
  return { status: response.status, body: JSON.parse(response.body) }
}

test('the minimum is 600 and the maximum stays 8000', () => {
  assert.equal(STORY_MIN_CHARS, 600)
  assert.equal(SCENARIO_MAX_CHARS, 8000)
})

test('storyLength classifies short / ok / long on collapsed whitespace', () => {
  assert.equal(storyLength('').status, 'short')
  assert.equal(storyLength(idea).status, 'short')
  assert.equal(storyLength('x'.repeat(599)).status, 'short')
  assert.equal(storyLength('x'.repeat(600)).status, 'ok')
  assert.equal(storyLength('x'.repeat(8000)).status, 'ok')
  assert.equal(storyLength('x'.repeat(8001)).status, 'long')
  // padding cannot buy length: 700 spaces and newlines count as one
  const padded = idea + ' '.repeat(400) + '\n'.repeat(400)
  assert.equal(storyLength(padded).status, 'short')
  assert.equal(storyLength(padded).length, idea.length)
})

test('storyToBoard enforces the range only when asked, so other callers keep working', () => {
  assert.ok(storyToBoard(idea).board.shots.length >= 1)
  assert.throws(() => storyToBoard(idea, { enforceMin: true }), error => error.code === 'story_too_short')
  assert.throws(() => storyToBoard(storyOf(8100), { enforceMin: true }), error => error.code === 'story_too_long')
  assert.ok(storyToBoard(storyOf(700), { enforceMin: true }).board.shots.length >= 1)
})

test('the human message points to the Studio for an idea and to the Author project for a book', () => {
  assert.match(storyErrorFor({ code: 'story_too_short', message: 'x' }), /idea/i)
  assert.match(storyErrorFor({ code: 'story_too_long', message: 'x' }), /8,000/)
})

test('API prose path: under 600 characters still plans (200) and carries a short_story warning', () => {
  const short = plan({ input: 'prose', prose: idea })
  assert.equal(short.status, 200, short.body.message)
  const warning = (short.body.warnings || []).find(item => item.code === 'short_story')
  assert.ok(warning, 'short_story warning present')
  assert.equal(warning.action, 'none')
  assert.match(warning.message, /600/)
  assert.match(warning.fix, /premise/)
})

test('API prose path: 600+ characters carries no short_story warning', () => {
  const full = plan({ input: 'prose', prose: storyOf(700) })
  assert.equal(full.status, 200, full.body.message)
  assert.equal((full.body.warnings || []).some(item => item.code === 'short_story'), false)
})

test('API premise path is untouched: an idea is 8..6000 and never gets short_story', () => {
  const premise = plan({ premise: idea })
  assert.equal(premise.status, 200, premise.body.message)
  assert.equal((premise.body.warnings || []).some(item => item.code === 'short_story'), false)
  assert.equal(plan({ premise: 'tiny' }).body.error, 'invalid_premise')
})

test('API prose path: hard limits unchanged (8 and 8000 still refuse)', () => {
  assert.equal(plan({ input: 'prose', prose: 'tiny' }).body.error, 'invalid_prose')
  assert.equal(plan({ input: 'prose', prose: 'x'.repeat(8001) }).body.error, 'invalid_prose')
})

test('agent docs and OpenAPI say what the warning means; doc pairs stay byte-equal', () => {
  const agents = readFileSync('AGENTS.md', 'utf8')
  const skill = readFileSync('SKILL.md', 'utf8')
  assert.equal(readFileSync('public/agents.md', 'utf8'), agents)
  assert.equal(readFileSync('public/SKILL.md', 'utf8'), skill)
  assert.match(agents, /short_story/)
  assert.match(skill, /short_story/)
  const openapi = JSON.parse(dispatchAgentRequest({ method: 'GET', pathname: '/openapi.json' }).body)
  assert.match(JSON.stringify(openapi), /short_story/)
})

test('/story has no maxlength truncation and shows the range', () => {
  const page = readFileSync('app/pages/story.vue', 'utf8')
  assert.doesNotMatch(page, /maxlength="8000"/)
  assert.match(page, /storyLength/)
  assert.match(page, /enforceMin: true/)
  assert.doesNotMatch(page, /at least 40 characters/)
})
