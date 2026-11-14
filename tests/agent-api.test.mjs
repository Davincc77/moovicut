import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProdServer } from '../server/prod-server.mjs'
import { createRateLimiter, dispatchAgentRequest, openApiDocument } from '../server/agent-api.mjs'
import { decodeStudioBoard } from '../app/utils/studio-link.js'

const premise = 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

test('OpenAPI 3.1 documents the 5 x 3s default and custom scenes', () => {
  const doc = openApiDocument()
  assert.equal(doc.openapi, '3.1.0')
  assert.equal(doc.paths['/api/v1/storyboard'].post.operationId, 'planStoryboard')
  assert.equal(doc.components.schemas.StoryboardRequest.properties.shots.default, 5)
  assert.equal(doc.components.schemas.StoryboardRequest.properties.duration.default, 3)
  assert.equal(doc.components.schemas.StoryboardRequest.properties.scenes.maxItems, 48)
  assert.match(doc.info.description, /5 scenes/)
})

test('storyboard API returns full and compact boards and a studio hash link', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-api-'))
  const server = createProdServer({ staticRoot: directory, limiter: createRateLimiter({ limit: 100 }) })
  const base = await listen(server)
  try {
    const full = await fetch(`${base}/api/v1/storyboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ premise, model: 'google' })
    })
    assert.equal(full.status, 200)
    const project = await full.json()
    assert.equal(project.schema, 'shotboard.v1')
    assert.equal(project.model, 'google')
    assert.equal(project.shots.length, 5)
    assert.equal(project.shots[0].duration, 4)
    assert.match(project.studioUrl, /\/studio#board=/)
    const linked = decodeStudioBoard(new URL(project.studioUrl).hash.slice('#board='.length) ? new URL(project.studioUrl).hash.split('board=')[1] : '')
    assert.equal(linked.premise, premise)
    assert.equal(linked.shots, 5)
    assert.equal(linked.duration, 4)

    const compact = await fetch(`${base}/api/v1/storyboard?compact=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ premise, compact: true, scenes: [
        { action: 'The keeper shoulders the lantern.', duration: 4, camera: 'Handheld', lighting: 'Warm lamp', notes: 'Wind in the mic' },
        { beat: 'The beacon flashes once.', duration: 3 }
      ] })
    })
    assert.equal(compact.status, 200)
    const short = await compact.json()
    assert.deepEqual(Object.keys(short).sort(), ['aspectRatio', 'model', 'premise', 'shots', 'studioUrl', 'title'])
    assert.equal(short.shots.length, 2)
    assert.equal(short.shots[0].duration, 4)
    assert.equal(short.shots[0].order, 1)
    assert.match(short.shots[0].prompt, /shoulders the lantern/)
    assert.match(short.shots[0].prompt, /Wind in the mic/)
    assert.equal(short.continuitySheet, undefined)
    const custom = decodeStudioBoard(new URL(short.studioUrl).hash.split('board=')[1])
    assert.equal(custom.scenes.length, 2)
    assert.equal(custom.scenes[0].action, 'The keeper shoulders the lantern.')
  } finally {
    server.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('MCP initialize, tools/list, and tools/call stay stateless and compact', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-mcp-'))
  const server = createProdServer({ staticRoot: directory, limiter: createRateLimiter({ limit: 100 }) })
  const base = await listen(server)
  const post = (body) => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  try {
    const info = await fetch(`${base}/mcp`)
    assert.equal(info.status, 200)
    const described = await info.json()
    assert.equal(described.authentication, 'none')
    assert.deepEqual(described.tools.map(tool => tool.name), ['plan_storyboard', 'export_prompts', 'validate_storyboard'])
    assert.equal(described.defaults.shots, 5)

    const spec = await fetch(`${base}/openapi.json`)
    assert.equal(spec.status, 200)
    assert.equal((await spec.json()).openapi, '3.1.0')

    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })
    const initialized = await init.json()
    assert.equal(initialized.result.serverInfo.name, 'moovicut')
    assert.equal(initialized.result.protocolVersion, '2025-03-26')
    assert.match(initialized.result.instructions, /5 scenes/)

    const listed = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()
    assert.equal(listed.result.tools.length, 3)
    assert.equal(listed.result.tools[0].inputSchema.properties.shots.default, 5)

    const planned = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'plan_storyboard', arguments: { premise } } })).json()
    const board = JSON.parse(planned.result.content[0].text)
    assert.equal(board.shots.length, 5)
    assert.equal(board.shots.every(shot => shot.duration === 3), true)
    assert.match(board.studioUrl, /#board=/)
    assert.equal(board.continuitySheet, undefined)

    const exported = await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'export_prompts', arguments: { premise, shots: 2 } } })).json()
    assert.equal(JSON.parse(exported.result.content[0].text).shots.length, 2)

    const validated = await (await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'validate_storyboard', arguments: { storyboard: { premise: 'too short', model: 'grok', shots: [] } } } })).json()
    assert.equal(validated.result.isError, true)

    const note = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    assert.equal(note.status, 202)

    const missing = await (await post({ jsonrpc: '2.0', id: 6, method: 'nope' })).json()
    assert.equal(missing.error.code, -32601)
  } finally {
    server.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('API routes rate limit by IP and reject oversized or invalid input', async () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-limit-'))
  const server = createProdServer({ staticRoot: directory, limiter })
  const base = await listen(server)
  const send = (ip) => fetch(`${base}/api/v1/storyboard`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ premise })
  })
  try {
    assert.equal((await send('203.0.113.8')).status, 200)
    assert.equal((await send('203.0.113.8')).status, 200)
    const blocked = await send('203.0.113.8')
    assert.equal(blocked.status, 429)
    assert.equal(blocked.headers.get('retry-after'), '60')
    assert.equal((await send('203.0.113.9')).status, 200)
    const bad = await fetch(`${base}/api/v1/storyboard`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.10' }, body: '{"premise":"short"}' })
    assert.equal(bad.status, 400)
    const huge = await fetch(`${base}/api/v1/storyboard`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.11' }, body: JSON.stringify({ premise: 'x'.repeat(40000) }) })
    assert.equal(huge.status, 413)
    const direct = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: '{', origin: 'https://moovicut.studio' })
    assert.equal(direct.status, 400)
    assert.equal(dispatchAgentRequest({ method: 'GET', pathname: '/studio' }), null)
  } finally {
    server.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
