import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dispatchAgentRequest, mcpInfo } from '../server/agent-api.mjs'

const parse = response => JSON.parse(response.body)
const send = params => dispatchAgentRequest({
  method: 'POST',
  pathname: '/a2a',
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'message/send', params })
})
const answer = params => {
  const envelope = parse(send(params))
  return envelope.result
}
const story = 'A lighthouse keeper races the dusk to repair a failing beacon.'

test('the A2A card ships at both well-known paths, byte-identical, and matches the MCP tools', () => {
  const cardText = readFileSync('public/.well-known/agent-card.json', 'utf8')
  assert.equal(readFileSync('public/.well-known/agent.json', 'utf8'), cardText)
  const card = JSON.parse(cardText)
  assert.equal(card.protocolVersion, '0.3')
  assert.equal(card.name, 'Moovicut')
  assert.equal(card.url, 'https://moovicut.studio/a2a')
  assert.match(card.description, /does not render video/)
  assert.match(card.description, /nothing stored/)
  assert.equal(card.capabilities.streaming, false)
  assert.equal(card.capabilities.pushNotifications, false)
  assert.deepEqual(card.skills.map(skill => skill.id), mcpInfo().tools.map(tool => tool.name))
  for (const skill of card.skills) {
    assert.match(skill.name, /\S/)
    assert.ok(skill.tags.length, skill.id)
  }
})

test('GET /a2a describes one synchronous method and no task state', () => {
  const info = parse(dispatchAgentRequest({ method: 'GET', pathname: '/a2a' }))
  assert.equal(info.protocol, 'a2a')
  assert.deepEqual(info.methods, ['message/send'])
  assert.equal(info.authentication, 'none')
  assert.equal(info.storage, 'none')
  assert.equal(info.video, false)
  assert.match(info.note, /No task state and no streaming/)
})

test('message/send with a text part returns an agent message with a board and a summary', () => {
  const doc = answer({ message: { role: 'user', parts: [{ kind: 'text', text: story }] } })
  assert.equal(doc.kind, 'message')
  assert.equal(doc.role, 'agent')
  assert.match(doc.messageId, /^moovicut-/)
  const data = doc.parts.find(part => part.kind === 'data')
  const text = doc.parts.find(part => part.kind === 'text')
  assert.ok(Array.isArray(data.data.shots) && data.data.shots.length >= 2)
  assert.match(text.text, /5 shots planned/)
  assert.match(text.text, /does not render video/)
  assert.match(JSON.stringify(doc), /studioUrl/)
})

test('message/send routes {tool, args} data parts for the three skills', () => {
  const sendTool = (tool, args) => answer({ message: { parts: [{ kind: 'data', data: { tool, args } }] } })
  const planned = sendTool('plan_storyboard', { premise: story })
  const board = planned.parts.find(part => part.kind === 'data').data
  assert.ok(Array.isArray(board.shots) && board.shots.length === 5)
  const exported = sendTool('export_prompts', { premise: 'Rui walks through the market at dawn.' })
  const prompts = exported.parts.find(part => part.kind === 'data').data
  assert.ok(prompts.shots[0].prompt.length > 0)
  const validated = sendTool('validate_storyboard', { storyboard: board })
  assert.match(validated.parts.find(part => part.kind === 'text').text, /Valid board: 5 shots\./)
})

test('unknown tools and empty messages answer with the repair vocabulary, never a silent error', () => {
  const unknown = parse(send({ message: { parts: [{ kind: 'data', data: { tool: 'render_video' } }] } }))
  assert.equal(unknown.error.code, -32602)
  assert.match(unknown.error.message, /plan_storyboard, export_prompts, validate_storyboard/)
  const empty = parse(send({ message: { parts: [] } }))
  assert.match(empty.error.message, /text part|data part/)
})

test('refused requests keep the named-error data so a weak model can repair in one turn', () => {
  const misplaced = parse(send({ message: { parts: [{ kind: 'data', data: {
    premise: 'A quiet evening on the dock.',
    characters: [{ name: 'Nils' }],
    scenes: [{ who: ['Nils'], where: 'Dock', what: 'He looks at the sea' }]
  } }] } }))
  assert.equal(misplaced.error.code, -32602)
  assert.equal(misplaced.error.data.error, 'misplaced_scenario_fields')
  assert.ok(misplaced.error.data.errors.some(item => item.field === 'scenes'))
  const named = parse(send({ message: { parts: [{ kind: 'text', text: 'Aisha unlocks her apartment door. She places her bag on the table.' }] } }))
  assert.equal(named.error.data.error, 'invalid_scenario')
  assert.match(named.error.message, /Add at least one character/)
  const invalid = parse(dispatchAgentRequest({
    method: 'POST',
    pathname: '/a2a',
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'validate_storyboard' })
  }))
  assert.equal(invalid.error.code, -32601)
})

test('streaming and task methods are answered honestly as unsupported', () => {
  const stream = parse(dispatchAgentRequest({
    method: 'POST', pathname: '/a2a',
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'message/stream', params: {} })
  }))
  assert.equal(stream.error.code, -32601)
  assert.match(stream.error.message, /Streaming is not supported/)
  const task = parse(dispatchAgentRequest({
    method: 'POST', pathname: '/a2a',
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tasks/get', params: {} })
  }))
  assert.match(task.error.message, /No task state/)
})

test('/a2a is rate limited like the other agent surfaces', () => {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/a2a',
    body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'ping' }),
    limiter: { allow: () => false },
    ip: '203.0.113.9'
  })
  assert.equal(response.status, 429)
  assert.equal(parse(response).error, 'rate_limited')
})

test('the discovery documents advertise A2A', () => {
  for (const file of ['AGENTS.md', 'public/agents.md', 'README.md', 'public/llms.txt', 'public/llms-full.txt']) {
    assert.match(readFileSync(file, 'utf8'), /\/a2a/, file)
  }
  assert.match(readFileSync('public/llms-full.txt', 'utf8'), /agent-card\.json/)
})
