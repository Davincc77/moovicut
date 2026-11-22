/** Contrat d'intégrité : sha256 auto-certifiant sur chaque payload de succès.
 *  La forme canonique est REIMPLÉMENTÉE ici (indépendante du serveur) pour détecter toute dérive. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
const hash = payload => {
  const copy = { ...payload }
  const claimed = copy.sha256
  delete copy.sha256
  for (const key of ['id', 'createdAt', 'updatedAt']) delete copy[key]
  return { claimed, recomputed: createHash('sha256').update(canonical(copy), 'utf8').digest('hex') }
}

const post = (pathname, body) => {
  const r = dispatchAgentRequest({ method: 'POST', pathname, body: JSON.stringify(body) })
  return { status: r.status, payload: JSON.parse(r.body) }
}
const get = pathname => {
  const r = dispatchAgentRequest({ method: 'GET', pathname })
  return { status: r.status, payload: JSON.parse(r.body) }
}

const IDEA = { premise: 'A courier sprints across a failing bridge while a pursuit closes.', model: 'grok' }

test('REST plan: payload auto-certifié, re-calcul indépendant', () => {
  const { status, payload } = post('/api/v1/storyboard', IDEA)
  assert.equal(status, 200)
  assert.match(payload.sha256, /^[0-9a-f]{64}$/)
  const { claimed, recomputed } = hash(payload)
  assert.equal(claimed, recomputed)
})

test('MCP plan_storyboard: même contrat dans le texte du tool result', () => {
  const r = dispatchAgentRequest({ method: 'POST', pathname: '/mcp', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'plan_storyboard', arguments: { ...IDEA, compact: true } } }) })
  const payload = JSON.parse(JSON.parse(r.body).result.content[0].text)
  const { claimed, recomputed } = hash(payload)
  assert.equal(claimed, recomputed)
})

test('A2A message/send: sha256 re-calculable dans la partie data', () => {
  const r = dispatchAgentRequest({ method: 'POST', pathname: '/a2a', body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text: JSON.stringify({ premise: IDEA.premise, model: 'grok' }) }] } } }) })
  const body = JSON.parse(r.body)
  const payload = body.result.parts.find(p => p.kind === 'data').data
  const { claimed, recomputed } = hash(payload)
  assert.equal(claimed, recomputed)
})

test('déterminisme: mêmes octets de requête -> même sha', () => {
  const a = post('/api/v1/storyboard', IDEA).payload.sha256
  const b = post('/api/v1/storyboard', IDEA).payload.sha256
  assert.equal(a, b)
})

test('sha256 présent uniquement sur les succès: erreur sans sha', () => {
  const bad = post('/api/v1/storyboard', { nope: true }).payload
  assert.ok(bad.error)
  assert.equal(bad.sha256, undefined)
})

test('unicode intact dans le canonique (emoji dans premise)', () => {
  const { payload } = post('/api/v1/storyboard', { ...IDEA, premise: 'Un archiviste 🎬 entend un tiroir s’ouvrir. — café « corrompu »' })
  const { claimed, recomputed } = hash(payload)
  assert.equal(claimed, recomputed)
})

test('export_prompts et validate_storyboard portent le contrat', () => {
  const plan = post('/api/v1/storyboard', { ...IDEA, compact: true }).payload
  const exported = dispatchAgentRequest({ method: 'POST', pathname: '/mcp', body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'export_prompts', arguments: { storyboard: plan } } }) })
  const exportPayload = JSON.parse(JSON.parse(exported.body).result.content[0].text)
  assert.equal(hash(exportPayload).claimed, hash(exportPayload).recomputed)
  const validated = dispatchAgentRequest({ method: 'POST', pathname: '/mcp', body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'validate_storyboard', arguments: { storyboard: plan } } }) })
  const vPayload = JSON.parse(JSON.parse(validated.body).result.content[0].text)
  assert.equal(hash(vPayload).claimed, hash(vPayload).recomputed)
})

test('manifest: GET /api/v1/manifest auto-certifié et complet', () => {
  const { status, payload } = get('/api/v1/manifest')
  assert.equal(status, 200)
  assert.equal(payload.name, 'moovicut')
  assert.deepEqual(payload.tools, ['plan_storyboard', 'export_prompts', 'validate_storyboard'])
  for (const need of ['/api/v1/storyboard', '/api/v1/manifest', '/mcp', '/a2a', '/.well-known/agent-card.json']) {
    assert.ok(payload.surfaces.some(s => s.path === need), `surface manquante: ${need}`)
  }
  assert.match(payload.integrity.algorithm, /canonicalJson/i)
  assert.equal(hash(payload).claimed, hash(payload).recomputed)
  const again = get('/api/v1/manifest').payload
  assert.equal(again.sha256, payload.sha256, 'le manifest doit être stable (aucune horodatage)')
})
