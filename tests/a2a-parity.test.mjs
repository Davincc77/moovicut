import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const d = dispatchAgentRequest
const P = 'A lighthouse keeper races the dusk to repair a failing beacon.'
const HELEN = 'Helen, 31, black bob, wool coat, waits in the yard. Helen stacks bowls in the oast. Helen waves.'
const SCENARIO = {
  characters: [{ name: 'Nils', look: 'weathered face', outfit: 'oilskin coat' }],
  places: [{ name: 'Dock', description: 'a wooden dock at dusk' }],
  scenes: [{ who: ['Nils'], where: 'Dock', what: 'He coils a rope', time: 'dusk' }]
}

// the three surfaces, fed the SAME request (format agent everywhere)
const rest = req => JSON.parse(d({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify({ ...req, format: 'agent' }) }).body)
const mcp = req => {
  const r = JSON.parse(d({ method: 'POST', pathname: '/mcp', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'plan_storyboard', arguments: { ...req, format: 'agent' } } }) }).body)
  return r.result && !r.result.isError ? { ok: true, text: r.result.content[0].text } : { ok: false, text: r.result ? r.result.content[0].text : JSON.stringify(r.error) }
}
const a2a = req => {
  const r = JSON.parse(d({ method: 'POST', pathname: '/a2a', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { parts: [{ kind: 'data', data: { tool: 'plan_storyboard', args: { ...req, format: 'agent' } } }] } } }) }).body)
  if (r.result) return { ok: true, text: JSON.stringify(r.result.parts.find(part => part.kind === 'data').data), doc: r.result.parts.find(part => part.kind === 'data').data }
  return { ok: false, text: r.error.message, name: r.error.data?.error, errors: r.error.data?.errors }
}

const successes = [
  ['premise', { premise: P }],
  ['model', { premise: P, model: 'kling' }, doc => assert.equal(doc.model, 'kling')],
  ['shots', { premise: P, shots: 3 }, doc => assert.equal(doc.shots.length, 3)],
  ['duration', { premise: P, duration: 5 }, doc => assert.equal(doc.shots[0].duration, 5)],
  ['aspectRatio', { premise: P, aspectRatio: '9:16' }, doc => assert.equal(doc.aspectRatio, '9:16')],
  ['genre+style', { premise: P, genre: 'noir', style: 'cinema' }],
  ['prompt_style', { premise: P, prompt_style: 'detailed' }],
  ['promptStyle alias', { premise: P, promptStyle: 'detailed' }],
  ['promptLanguage pt', { premise: P, promptLanguage: 'pt' }],
  ['prompt_language alias', { premise: P, prompt_language: 'pt' }],
  ['continuity', { premise: P, continuity: 'strict' }],
  ['density', { premise: P, density: 'concise' }],
  ['sequenceMode', { premise: P, sequenceMode: 'varied' }],
  ['mode alias', { premise: P, mode: 'varied' }],
  ['scenario', { premise: 'A quiet evening on the dock.', scenario: SCENARIO }],
  ['input prose', { input: 'prose', prose: HELEN }, doc => assert.match(doc.shots[1].prompt, /PLACE: Oast/i), 'prose'],
  ['type alias prose', { type: 'prose', prose: HELEN }, null, 'prose'],
  ['text alias prose', { input: 'prose', text: HELEN }, null, 'prose'],
  ['splitActions false', { premise: 'The courier rings the bell and leaves the parcel at the door.', splitActions: false }],
  ['splitScenes false', { input: 'prose', prose: HELEN, splitScenes: false }, null, 'prose'],
  ['strict_sheet ok', { premise: 'A quiet evening on the dock.', strict_sheet: true, scenario: SCENARIO }],
  ['compact explicit', { premise: P, compact: true }],
  ['compact false', { premise: P, compact: false }],
  ['ad object', { ad: { product: 'vegetable-tanned sandals', benefit: 'soft on the foot', cta: 'order now' } }, doc => assert.equal(doc.shots.length, 4)],
  ['ad top fields', { mode: 'ad', premise: 'Leather sandals, vegetable-tanned hide.', product: 'vegetable-tanned leather sandals', benefit: 'soft on the foot', cta: 'order now', setting: 'a sunlit workshop' }],
  ['series top fields', { mode: 'series', premise: 'A barista and a regular.', seriesTitle: 'Counter Talk', hook: 'the same cup, three encounters', episodes: 4 }, doc => assert.equal(doc.shots.length, 12)],
  ['series object', { series: { title: 'Counter Talk', hook: 'the same cup, three encounters', episodes: ['the joke', 'the rain', 'the tip'] } }, doc => assert.equal(doc.shots.length, 9)],
  ['series character+place', { mode: 'series', premise: 'A barista and a regular.', seriesTitle: 'Counter Talk', character: 'Rui', place: 'a corner cafe', hook: 'the same cup, three encounters', episodes: 3 }],
  ['explainer object', { explainer: { topic: 'brew pour-over coffee', audience: 'beginners', steps: ['Boil water', 'Pour over the grounds', 'Wait thirty seconds'] } }],
  ['explainer top fields', { mode: 'explainer', topic: 'brew pour-over coffee', audience: 'beginners', steps: ['Boil water', 'Pour over the grounds', 'Wait thirty seconds'] }],
  ['storyboard repost', { premise: P, storyboard: rest({ premise: P }), prompt: 'A CUSTOM REWRITE OF THIS SHOT', overwritePrompt: true }],
  ['schema compact resume', { schema: 'shotboard.compact.v1', title: 'Empty sheet', premise: 'A quiet room with nobody in it yet.', model: 'grok', aspectRatio: '16:9', mode: 'scenario', filmSheet: { characters: [], places: [] }, shots: [{ id: 'shot-01', order: 1, duration: 3, who: '', where: '', what: 'The room stays empty.', prompt: 'KEEP', promptEdited: true }] }, doc => assert.match(doc.shots[0].prompt, /KEEP/)],
  ['scenes in scenario', { premise: 'A quiet evening on the dock.', scenario: { ...SCENARIO, scenes: [{ who: ['Nils'], where: 'Dock', what: 'He coils a rope' }, { who: ['Nils'], where: 'Dock', what: 'He lights a pipe' }] } }]
]

const refusals = [
  ['scenes misplaced', { premise: 'A quiet evening on the dock.', characters: SCENARIO.characters, scenes: SCENARIO.scenes }, 'misplaced_scenario_fields'],
  ['strictSheet alias refus', { premise: 'A quiet evening on the dock.', strictSheet: true, scenario: { characters: [{ name: 'Nils' }], places: [{ name: 'Dock' }], scenes: [{ who: ['Nils'], where: 'Dock', what: 'He looks at the sea' }] } }, 'invalid_scenario'],
  ['bad style family', { premise: P, style: 'noir' }, 'invalid_preset'],
  ['premise too short', { premise: 'Gulls.' }, 'invalid_premise'],
  ['text without prose', { text: HELEN }, 'invalid_premise'],
  ['bad prompt language', { premise: P, promptLanguage: 'zh-Hans' }, 'invalid_prompt_language'],
  ['series without title', { mode: 'series', premise: 'A barista and a regular.', character: 'Rui', place: 'a corner cafe', hook: 'the same cup, three encounters', episodes: 3 }, 'invalid_series'],
  ['explainer without steps', { mode: 'explainer', premise: 'How to brew pour-over coffee' }, 'invalid_explainer'],
  ['bad model', { premise: P, model: 'veo3' }, 'invalid_model']
]

for (const [label, req, effect, kind] of successes) {
  if (kind === 'prose') continue // pinned by its own documented-shape test below
  test(`parity: ${label} answers the same bytes on REST, MCP, and A2A`, () => {
    const R = rest(req)
    const M = mcp(req)
    const A = a2a(req)
    assert.ok(!R.error, `REST: ${R.message}`)
    assert.ok(M.ok, `MCP: ${M.text}`)
    assert.ok(A.ok, `A2A: ${A.text}`)
    assert.equal(A.text, M.text)
    assert.equal(A.text, JSON.stringify(R))
    if (effect) effect(A.doc)
  })
}

for (const [label, req, name] of refusals) {
  test(`parity: ${label} refuses with the same named error on all three`, () => {
    const R = rest(req)
    const M = mcp(req)
    const A = a2a(req)
    assert.equal(R.error, name, `REST error: ${R.error} ${R.message}`)
    assert.equal(A.name, name)
    assert.equal(A.text, R.message)
    let mcpMessage = M.text
    try { const doc = JSON.parse(M.text); if (doc && doc.message) mcpMessage = doc.message } catch { /* plain text */ }
    assert.equal(mcpMessage, R.message, `MCP message differs: ${String(M.text).slice(0, 120)}`)
    if (Array.isArray(R.errors)) assert.deepEqual(A.errors, R.errors)
  })
}

// the prose path is documented as full-project on REST and compact on the tool
// surfaces; what must be identical is the tool byte AND the planned prompts
test('prose answers the same bytes on MCP and A2A, and REST carries the same prompts in its full project', () => {
  const proseCases = successes.filter(([, , , kind]) => kind === 'prose')
  assert.ok(proseCases.length >= 4)
  for (const [label, req] of proseCases) {
    const M = mcp(req)
    const A = a2a(req)
    assert.ok(M.ok && A.ok, `${label}: ${M.text || A.text}`)
    assert.equal(A.text, M.text, label)
    const R = rest(req)
    assert.ok(!R.error, `${label} REST: ${R.message}`)
    assert.equal(R.schema, 'shotboard.v1', label)
    assert.deepEqual((R.shots || []).map(shot => shot.prompt), A.doc.shots.map(shot => shot.prompt), `${label} prompts`)
  }
})

// aliases must not be second-class: an alias answers like its canonical field
test('aliases return the same board as their canonical spelling', () => {
  assert.equal(mcp({ premise: P, promptStyle: 'detailed' }).text, mcp({ premise: P, prompt_style: 'detailed' }).text)
  assert.equal(mcp({ premise: P, prompt_language: 'pt' }).text, mcp({ premise: P, promptLanguage: 'pt' }).text)
  assert.equal(mcp({ premise: P, mode: 'varied' }).text, mcp({ premise: P, sequenceMode: 'varied' }).text)
  assert.equal(a2a({ type: 'prose', prose: HELEN }).text, a2a({ input: 'prose', prose: HELEN }).text)
  assert.equal(a2a({ input: 'prose', text: HELEN }).text, a2a({ input: 'prose', prose: HELEN }).text)
  const board = { premise: P, project: rest({ premise: P, compact: false }) }
  const shotId = board.project.shots[1].id
  assert.equal(mcp({ ...board, shotId }).text, mcp({ ...board, regenerateShot: shotId }).text)
})

// every documented field is exercised somewhere in this file
test('the parity corpus covers every field of plan_storyboard', () => {
  const tools = JSON.parse(d({ method: 'POST', pathname: '/mcp', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }).body)
  const keys = Object.keys(tools.result.tools[0].inputSchema.properties)
  const covered = new Set()
  for (const [, req] of [...successes, ...refusals]) for (const key of Object.keys(req)) covered.add(key)
  for (const key of ['project', 'regenerateShot', 'overwritePrompt', 'shotId']) covered.add(key) // alias test above
  covered.add('format') // the harness itself sends format agent on every case
  const missed = keys.filter(key => !covered.has(key))
  assert.deepEqual(missed, [], `fields without a parity case: ${missed.join(', ')}`)
})
