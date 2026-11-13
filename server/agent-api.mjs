import { createStoryboard, validateProject, canonicalModel } from '../app/utils/prompt-engine.js'
import { studioUrl } from '../app/utils/studio-link.js'
import { cleanText } from '../app/utils/text.js'

export const RATE_LIMIT = Object.freeze({ limit: 30, windowMs: 60_000 })
export const STORYBOARD_BODY_LIMIT = 32 * 1024
export const MCP_BODY_LIMIT = 128 * 1024
export const MAX_API_SHOTS = 48
const SITE = 'https://moovicut.studio'

export function createRateLimiter({ limit = RATE_LIMIT.limit, windowMs = RATE_LIMIT.windowMs } = {}) {
  const buckets = new Map()
  return {
    allow(ip) {
      const key = String(ip || 'unknown').slice(0, 80)
      const now = Date.now()
      const recent = (buckets.get(key) || []).filter(time => now - time < windowMs)
      if (recent.length >= limit) {
        buckets.set(key, recent)
        return false
      }
      recent.push(now)
      buckets.set(key, recent)
      return true
    }
  }
}

export function clientAddress(headers = {}, fallback = '') {
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim().slice(0, 80)
  return String(fallback || '').slice(0, 80)
}

export function isLimitedPath(pathname) {
  return pathname === '/mcp' || pathname.startsWith('/api/')
}

export function isAgentPath(pathname) {
  return pathname === '/mcp' || pathname === '/openapi.json' || pathname.startsWith('/api/v1/')
}

function json(status, body, extra = {}) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, accept',
      ...extra
    },
    body: body == null ? '' : JSON.stringify(body)
  }
}

function storyboardOptions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new Error('Send a JSON object.')
    error.status = 400
    error.code = 'invalid_body'
    throw error
  }
  const premise = cleanText(input.premise)
  if (premise.length < 8) {
    const error = new Error('The premise must be at least 8 characters.')
    error.status = 400
    error.code = 'invalid_premise'
    throw error
  }
  if (premise.length > 6000) {
    const error = new Error('Keep the premise under 6,000 characters.')
    error.status = 400
    error.code = 'invalid_premise'
    throw error
  }
  const model = canonicalModel(input.model || 'grok')
  if (!model) {
    const error = new Error('The model must be "grok" or "google".')
    error.status = 400
    error.code = 'invalid_model'
    throw error
  }
  const scenes = Array.isArray(input.scenes) ? input.scenes : null
  if (scenes && scenes.length > MAX_API_SHOTS) {
    const error = new Error(`A storyboard can include at most ${MAX_API_SHOTS} scenes.`)
    error.status = 400
    error.code = 'invalid_scenes'
    throw error
  }
  if (scenes && scenes.some(scene => !scene || typeof scene !== 'object' || Array.isArray(scene))) {
    const error = new Error('Each scene must be an object.')
    error.status = 400
    error.code = 'invalid_scenes'
    throw error
  }
  const requested = input.shots ?? input.count
  const count = scenes?.length ? scenes.length : (requested == null || requested === '' ? 5 : Math.floor(Number(requested)))
  if (!Number.isFinite(count) || count < 1 || count > MAX_API_SHOTS) {
    const error = new Error(`Shots must be a whole number from 1 to ${MAX_API_SHOTS}.`)
    error.status = 400
    error.code = 'invalid_shots'
    throw error
  }
  const durationValue = input.duration
  const duration = durationValue == null || durationValue === '' ? 3 : Number(durationValue)
  if (!Number.isFinite(duration) || duration < 2 || duration > 15) {
    const error = new Error('Duration must be from 2 to 15 seconds.')
    error.status = 400
    error.code = 'invalid_duration'
    throw error
  }
  const sequenceMode = input.sequenceMode || input.mode || 'continuous'
  if (sequenceMode !== 'continuous' && sequenceMode !== 'varied') {
    const error = new Error('Mode must be "continuous" or "varied".')
    error.status = 400
    error.code = 'invalid_mode'
    throw error
  }
  const continuity = input.continuity || input.continuityStrength
  if (continuity != null && continuity !== 'standard' && continuity !== 'strict') {
    const error = new Error('Continuity must be "standard" or "strict".')
    error.status = 400
    error.code = 'invalid_continuity'
    throw error
  }
  const density = input.density || input.promptDensity
  if (density != null && density !== 'standard' && density !== 'concise') {
    const error = new Error('Density must be "standard" or "concise".')
    error.status = 400
    error.code = 'invalid_density'
    throw error
  }
  return {
    premise,
    model,
    count,
    duration,
    sequenceMode: sequenceMode || undefined,
    continuityStrength: continuity || undefined,
    density: density || undefined,
    aspectRatio: input.aspectRatio,
    genre: typeof input.genre === 'string' ? input.genre : undefined,
    style: typeof input.style === 'string' ? input.style : undefined,
    scenes: scenes || undefined
  }
}

export function compactStoryboard(project, link) {
  return {
    title: project.title,
    premise: project.premise,
    model: project.model,
    aspectRatio: project.aspectRatio,
    studioUrl: link,
    shots: project.shots.map(shot => ({
      order: shot.order,
      duration: shot.duration_seconds || shot.duration,
      prompt: shot.prompt
    }))
  }
}

function fullStoryboard(project, link) {
  return { ...project, studioUrl: link }
}

export function planFromInput(input, { origin = SITE, compact = false } = {}) {
  const options = storyboardOptions(input)
  const project = createStoryboard(options)
  const link = studioUrl(origin, {
    premise: project.premise,
    model: project.model,
    shots: project.shots.length,
    sequenceMode: project.sequenceMode,
    continuityStrength: project.continuityStrength,
    density: project.promptDensity,
    aspectRatio: project.aspectRatio,
    genre: project.genre,
    style: project.style,
    duration: project.duration,
    stepByStep: Boolean(options.scenes?.length),
    scenes: options.scenes
  })
  return compact ? compactStoryboard(project, link) : fullStoryboard(project, link)
}

function wantsCompact(input, searchParams) {
  if (input?.compact === true || input?.compact === 1 || input?.compact === '1' || input?.compact === 'true') return true
  const query = searchParams?.get?.('compact')
  return query === '1' || query === 'true'
}

const SCENE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', description: 'Scene beat or action. beat and description are accepted aliases.' },
    beat: { type: 'string' },
    description: { type: 'string' },
    duration: { type: 'integer', minimum: 2, maximum: 15, description: 'Seconds for this scene. Defaults to 3.' },
    framing: { type: 'string' },
    camera: { type: 'string' },
    lighting: { type: 'string' },
    mood: { type: 'string', description: 'Alias of lighting.' },
    notes: { type: 'string' }
  }
}

const STORYBOARD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['premise'],
  properties: {
    premise: { type: 'string', minLength: 8, maxLength: 6000 },
    model: { type: 'string', enum: ['grok', 'google'], default: 'grok' },
    shots: { type: 'integer', minimum: 1, maximum: MAX_API_SHOTS, default: 5, description: 'Scene count. Ignored when scenes is a non-empty array. Default 5.' },
    mode: { type: 'string', enum: ['continuous', 'varied'], description: 'Alias of sequenceMode.' },
    sequenceMode: { type: 'string', enum: ['continuous', 'varied'] },
    continuity: { type: 'string', enum: ['standard', 'strict'], default: 'standard' },
    density: { type: 'string', enum: ['standard', 'concise'], default: 'standard', description: 'Concise keeps one short continuity line. Standard includes the shared sheet once. Strict still repeats the sheet verbatim.' },
    aspectRatio: { type: 'string', enum: ['9:16', '1:1', '4:5', '16:9'], default: '16:9' },
    genre: { type: 'string' },
    style: { type: 'string', description: 'Fun, Normal, Spicy, or a visual style id such as cinematic or illustrative.' },
    duration: { type: 'integer', minimum: 2, maximum: 15, default: 3, description: 'Seconds per scene when a scene does not set its own duration. Default 3.' },
    compact: { type: 'boolean', default: false, description: 'Return title, premise, model, aspectRatio, studioUrl, and shots of order, duration, and prompt.' },
    scenes: {
      type: 'array',
      maxItems: MAX_API_SHOTS,
      description: 'Optional per-scene overrides. When present, the board length is scenes.length instead of the default 5.',
      items: SCENE_SCHEMA
    }
  }
}

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Moovicut',
      version: '1.0.0',
      summary: 'Free deterministic storyboard planning. No API key, no account, no stored premises.',
      description: 'Moovicut plans editable storyboards. It does not render video and it does not save the premise. The default board is 5 scenes × 3 seconds (15 seconds total). Pass shots and duration, or a scenes array, for a custom scene-by-scene board. Humans can do the same in /studio Step-by-step mode. studioUrl is a /studio#board= link the browser can open without a server lookup.'
    },
    servers: [{ url: SITE }],
    paths: {
      '/api/v1/storyboard': {
        post: {
          operationId: 'planStoryboard',
          summary: 'Plan a deterministic storyboard',
          description: 'Default: 5 scenes of 3 seconds. Set shots, duration, or scenes to customize. compact=true, or the compact query, returns the low-token payload. Nothing is stored.',
          parameters: [{
            name: 'compact',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['1', 'true'] },
            description: 'Same as body compact:true.'
          }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StoryboardRequest' } } }
          },
          responses: {
            '200': {
              description: 'A storyboard. Compact responses omit internal fields.',
              content: { 'application/json': { schema: { oneOf: [{ $ref: '#/components/schemas/CompactStoryboard' }, { $ref: '#/components/schemas/FullStoryboard' }] } } }
            },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '413': { description: 'Payload too large', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '429': { description: 'Rate limited (30 requests per minute per IP)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
          }
        }
      },
      '/mcp': {
        get: {
          operationId: 'mcpInfo',
          summary: 'MCP endpoint info',
          responses: { '200': { description: 'Stateless MCP endpoint' } }
        },
        post: {
          operationId: 'mcpRpc',
          summary: 'Stateless MCP JSON-RPC',
          description: 'Methods: initialize, tools/list, tools/call. Tools: plan_storyboard, export_prompts, validate_storyboard. No API key. 30 requests per minute per IP.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'JSON-RPC result' }, '202': { description: 'Notification accepted' }, '429': { description: 'Rate limited' } }
        }
      },
      '/openapi.json': {
        get: {
          operationId: 'openApi',
          summary: 'This document',
          responses: { '200': { description: 'OpenAPI 3.1 document' } }
        }
      }
    },
    components: {
      schemas: {
        StoryboardRequest: STORYBOARD_SCHEMA,
        SceneOverride: SCENE_SCHEMA,
        CompactShot: {
          type: 'object',
          required: ['order', 'duration', 'prompt'],
          properties: {
            order: { type: 'integer' },
            duration: { type: 'integer' },
            prompt: { type: 'string' }
          }
        },
        CompactStoryboard: {
          type: 'object',
          required: ['title', 'premise', 'model', 'aspectRatio', 'studioUrl', 'shots'],
          properties: {
            title: { type: 'string' },
            premise: { type: 'string' },
            model: { type: 'string' },
            aspectRatio: { type: 'string' },
            studioUrl: { type: 'string', description: 'Hash link to /studio. The board is in the fragment and is not sent to the server on open.' },
            shots: { type: 'array', items: { $ref: '#/components/schemas/CompactShot' } }
          }
        },
        FullStoryboard: { type: 'object', description: 'shotboard.v1 project plus studioUrl.' },
        Error: {
          type: 'object',
          properties: { error: { type: 'string' }, message: { type: 'string' } }
        }
      }
    }
  }
}

const TOOLS = [
  {
    name: 'plan_storyboard',
    description: 'Plan a deterministic storyboard. Default is 5 scenes × 3s (15s total). Pass shots/duration or a scenes array (action, duration, camera, framing, lighting, notes) for a custom board. Returns a compact payload and a /studio# link. Nothing is stored.',
    inputSchema: STORYBOARD_SCHEMA
  },
  {
    name: 'export_prompts',
    description: 'Return shot prompts for a premise or for an existing shots array. Default planning is 5 scenes × 3s.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        premise: { type: 'string' },
        model: { type: 'string', enum: ['grok', 'google'], default: 'grok' },
        shots: { type: 'integer', minimum: 1, maximum: MAX_API_SHOTS, default: 5 },
        duration: { type: 'integer', minimum: 2, maximum: 15, default: 3 },
        mode: { type: 'string', enum: ['continuous', 'varied'] },
        sequenceMode: { type: 'string', enum: ['continuous', 'varied'] },
        continuity: { type: 'string', enum: ['standard', 'strict'] },
        density: { type: 'string', enum: ['standard', 'concise'] },
        aspectRatio: { type: 'string' },
        genre: { type: 'string' },
        style: { type: 'string' },
        scenes: { type: 'array', maxItems: MAX_API_SHOTS, items: SCENE_SCHEMA },
        storyboard: { type: 'object', description: 'Optional shotboard.v1 document. When shots exist, their prompts are returned as-is.' }
      }
    }
  },
  {
    name: 'validate_storyboard',
    description: 'Validate a shotboard.v1 document. Returns ok and the shot count, or an error message. Does not store the document.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        storyboard: { type: 'object' },
        project: { type: 'object' }
      }
    }
  }
]

function toolResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError }
}

function callTool(name, args, origin) {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
  if (name === 'plan_storyboard') {
    const planned = planFromInput(input, { origin, compact: input.compact !== false })
    return toolResult(JSON.stringify(planned))
  }
  if (name === 'export_prompts') {
    if (input.storyboard && Array.isArray(input.storyboard.shots) && input.storyboard.shots.length && !input.premise) {
      const prompts = input.storyboard.shots.map((shot, index) => ({ order: index + 1, prompt: String(shot.prompt || '') }))
      return toolResult(JSON.stringify({ shots: prompts }))
    }
    const planned = planFromInput({ ...input, compact: true }, { origin, compact: true })
    return toolResult(JSON.stringify({ shots: planned.shots.map(shot => ({ order: shot.order, prompt: shot.prompt })) }))
  }
  if (name === 'validate_storyboard') {
    const document = input.storyboard || input.project || input
    try {
      const validated = validateProject(document)
      return toolResult(JSON.stringify({ ok: true, shots: validated.project.shots.length, model: validated.project.model }))
    } catch (error) {
      return toolResult(JSON.stringify({ ok: false, message: error.message }), true)
    }
  }
  const error = new Error(`Unknown tool: ${name}`)
  error.status = 400
  error.code = 'unknown_tool'
  throw error
}

function rpcResult(id, result) {
  return json(200, { jsonrpc: '2.0', id, result })
}

function rpcError(id, code, message) {
  return json(200, { jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

function mcp(body, origin) {
  let message
  try { message = JSON.parse(body || '') } catch {
    return rpcError(null, -32700, 'Parse error')
  }
  if (!message || typeof message !== 'object' || Array.isArray(message)) return rpcError(null, -32600, 'Invalid request')
  const { id, method, params } = message
  if (message.jsonrpc !== '2.0' || typeof method !== 'string') return rpcError(id ?? null, -32600, 'Invalid request')
  if (id == null && (method === 'notifications/initialized' || method.startsWith('notifications/'))) return json(202, null)
  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: params?.protocolVersion || '2025-03-26',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'moovicut', version: '1.0.0' },
      instructions: 'Free storyboard planning. No API key and no stored premises. Default board: 5 scenes × 3s (15s). Pass shots, duration, or scenes for a custom board. Moovicut does not render video.'
    })
  }
  if (method === 'tools/list') return rpcResult(id, { tools: TOOLS })
  if (method === 'tools/call') {
    const name = params?.name
    const args = typeof params?.arguments === 'string' ? safeJson(params.arguments) : params?.arguments
    if (!TOOLS.some(tool => tool.name === name)) return rpcError(id, -32602, 'Unknown tool')
    try {
      return rpcResult(id, callTool(name, args, origin))
    } catch (error) {
      return rpcResult(id, toolResult(error.message, true))
    }
  }
  if (method === 'ping') return rpcResult(id, {})
  return rpcError(id, -32601, 'Method not found')
}

function safeJson(value) {
  try { return JSON.parse(value) } catch { return {} }
}

export function mcpInfo(origin = SITE) {
  return {
    name: 'moovicut',
    protocol: 'mcp',
    transport: 'stateless-http',
    url: `${origin}/mcp`,
    authentication: 'none',
    rateLimit: `${RATE_LIMIT.limit} requests per minute per IP`,
    storage: 'none',
    video: false,
    defaults: { shots: 5, duration: 3, totalSeconds: 15 },
    tools: TOOLS.map(tool => ({ name: tool.name, description: tool.description }))
  }
}

export function dispatchAgentRequest({ method = 'GET', pathname = '/', searchParams, headers = {}, body = '', origin = SITE, limiter, ip = '' } = {}) {
  if (!isAgentPath(pathname)) return null
  const verb = String(method || 'GET').toUpperCase()
  if (verb === 'OPTIONS') return json(204, null)
  if (limiter && verb !== 'OPTIONS' && !limiter.allow(ip || clientAddress(headers))) {
    return json(429, { error: 'rate_limited', message: 'Too many requests from this address. Try again in a minute.' }, { 'retry-after': '60' })
  }
  if (pathname === '/openapi.json') {
    if (verb !== 'GET' && verb !== 'HEAD') return json(405, { error: 'method_not_allowed' }, { allow: 'GET, HEAD, OPTIONS' })
    return json(200, openApiDocument())
  }
  if (pathname === '/mcp' && verb === 'GET') return json(200, mcpInfo(origin))
  if (pathname === '/mcp' && verb === 'POST') {
    if (Buffer.byteLength(body || '') > MCP_BODY_LIMIT) return json(413, { error: 'payload_too_large', message: 'The MCP body is over 128 KB.' })
    return mcp(body, origin)
  }
  if (pathname === '/api/v1/storyboard') {
    if (verb !== 'POST') return json(405, { error: 'method_not_allowed' }, { allow: 'POST, OPTIONS' })
    if (Buffer.byteLength(body || '') > STORYBOARD_BODY_LIMIT) return json(413, { error: 'payload_too_large', message: 'The storyboard body is over 32 KB.' })
    let input
    try { input = JSON.parse(body || '') } catch { return json(400, { error: 'invalid_json', message: 'Send valid JSON.' }) }
    try {
      const planned = planFromInput(input, { origin, compact: wantsCompact(input, searchParams) })
      return json(200, planned)
    } catch (error) {
      const status = error.status || 400
      return json(status, { error: error.code || 'invalid_request', message: error.message })
    }
  }
  return json(404, { error: 'not_found' })
}

export function readLimitedBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let failed = false
    const fail = () => {
      if (failed) return
      failed = true
      const error = new Error('payload_too_large')
      error.status = 413
      reject(error)
      request.resume()
    }
    if (Number(request.headers?.['content-length']) > limit) { fail(); return }
    request.on('data', chunk => {
      size += chunk.length
      if (size > limit) { fail(); return }
      if (!failed) chunks.push(chunk)
    })
    request.on('end', () => { if (!failed) resolve(Buffer.concat(chunks).toString('utf8')) })
    request.on('error', error => { if (!failed) reject(error) })
  })
}

export async function handleAgentHttp(request, response, { pathname, searchParams, origin, limiter, bodyLimit }) {
  const verb = request.method || 'GET'
  let body = ''
  if (verb !== 'GET' && verb !== 'HEAD' && verb !== 'OPTIONS') {
    try { body = await readLimitedBody(request, bodyLimit || (pathname === '/mcp' ? MCP_BODY_LIMIT : STORYBOARD_BODY_LIMIT)) }
    catch (error) {
      const payload = json(error.status || 413, { error: 'payload_too_large', message: 'The request body is too large.' })
      response.writeHead(payload.status, payload.headers)
      response.end(payload.body)
      return true
    }
  }
  const result = dispatchAgentRequest({
    method: verb,
    pathname,
    searchParams,
    headers: request.headers,
    body,
    origin,
    limiter,
    ip: clientAddress(request.headers, request.socket?.remoteAddress)
  })
  if (!result) return false
  response.writeHead(result.status, result.headers)
  response.end(verb === 'HEAD' || result.status === 204 ? undefined : result.body)
  return true
}

export function publicOrigin(headers = {}, fallback = SITE) {
  const host = String(headers.host || '')
  if (!/^[\w.:[\]-]+$/.test(host)) return fallback
  const forwarded = String(headers['x-forwarded-proto'] || '')
  if (forwarded === 'http' || forwarded === 'https') return `${forwarded}://${host}`
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return `http://${host}`
  return `https://${host}`
}
