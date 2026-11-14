import { createStoryboard, validateProject, canonicalModel, looksLikeScenario, listPresets, parseScenario, regenerateOneShot } from '../app/utils/prompt-engine.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { AGENT_BOARD_SCHEMA, exportAgentBoard, importAgentBoard } from '../app/utils/agent-board.js'
import { publicProfile } from '../app/utils/model-profiles.js'
import { detectProse } from '../app/utils/prose-detect.js'
import { SCENARIO_MAX_CHARS } from '../app/utils/scenario.js'
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

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const value = headers[name] ?? headers[String(name).toLowerCase()]
  if (Array.isArray(value)) return value.join(',')
  return typeof value === 'string' ? value : ''
}

function normalizeAddress(value) {
  return String(value || '').trim().replace(/^::ffff:/i, '').slice(0, 80)
}

/**
 * Railway's proxy appends the connecting client to X-Forwarded-For.
 * The rightmost entry is that hop. A leading entry is client-supplied and is ignored.
 */
export function clientAddress(headers = {}, fallback = '') {
  const parts = headerValue(headers, 'x-forwarded-for').split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length) return normalizeAddress(parts[parts.length - 1])
  const socket = normalizeAddress(fallback)
  if (socket) return socket
  const real = headerValue(headers, 'x-real-ip').split(',')[0]
  return normalizeAddress(real)
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

function fail(message, code) {
  const error = new Error(message)
  error.status = 400
  error.code = code
  throw error
}

function optionalDensity(input) {
  const density = input.density || input.promptDensity
  if (density != null && density !== 'standard' && density !== 'concise') fail('Density must be "standard" or "concise".', 'invalid_density')
  return density || undefined
}

function optionalDuration(input) {
  const durationValue = input.duration
  const duration = durationValue == null || durationValue === '' ? 3 : Number(durationValue)
  if (!Number.isFinite(duration) || duration < 2 || duration > 15) fail('Duration must be from 2 to 15 seconds.', 'invalid_duration')
  return duration
}

function presetOptions(input, model, mode) {
  return {
    mode,
    sequenceMode: mode,
    model,
    premise: typeof input.premise === 'string' ? input.premise : '',
    duration: optionalDuration(input),
    density: optionalDensity(input),
    aspectRatio: input.aspectRatio,
    genre: typeof input.genre === 'string' ? input.genre : undefined,
    style: typeof input.style === 'string' ? input.style : undefined,
    overwritePrompt: input.overwritePrompt === true,
    ad: input.ad,
    series: input.series,
    explainer: input.explainer,
    steps: input.steps,
    product: input.product,
    benefit: input.benefit,
    cta: input.cta,
    setting: input.setting,
    hook: input.hook,
    episodes: input.episodes,
    seriesTitle: input.seriesTitle,
    character: input.character,
    place: input.place,
    topic: input.topic,
    audience: input.audience
  }
}

function storyboardOptions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Send a JSON object.', 'invalid_body')
  if (input.input === 'prose' || input.type === 'prose') return { prose: true, raw: input }
  const model = canonicalModel(input.model || 'grok')
  if (!model) fail('The model must be grok, google, sora, kling, runway, luma, wan, or generic.', 'invalid_model')
  const explicit = String(input.mode || input.sequenceMode || '')
  if (explicit === 'ad' || input.ad || (!explicit && input.product && input.benefit)) return presetOptions(input, model, 'ad')
  if (explicit === 'series' || input.series) return presetOptions(input, model, 'series')
  if (explicit === 'explainer' || input.explainer || (input.steps && !explicit)) return presetOptions(input, model, 'explainer')
  const scenarioSource = input.scenario != null
    ? input.scenario
    : (input.mode === 'scenario' || input.sequenceMode === 'scenario' || looksLikeScenario(input.premise) ? input.premise : null)
  if (scenarioSource != null) {
    if (typeof scenarioSource === 'string' && scenarioSource.length > SCENARIO_MAX_CHARS) fail('Keep the scenario under 8,000 characters so it stays easy to paste and generate.', 'invalid_scenario')
    const explicit = input.scenario != null && typeof input.premise === 'string' && !looksLikeScenario(input.premise) ? cleanText(input.premise) : ''
    if (explicit.length > 6000) fail('Keep the premise under 6,000 characters.', 'invalid_premise')
    return {
      premise: explicit,
      scenario: scenarioSource,
      sequenceMode: 'scenario',
      model,
      duration: optionalDuration(input),
      density: optionalDensity(input),
      aspectRatio: input.aspectRatio,
      genre: typeof input.genre === 'string' ? input.genre : undefined,
      style: typeof input.style === 'string' ? input.style : undefined,
      overwritePrompt: input.overwritePrompt === true
    }
  }
  const premise = cleanText(input.premise)
  if (premise.length < 8) fail('The premise must be at least 8 characters.', 'invalid_premise')
  if (premise.length > 6000) fail('Keep the premise under 6,000 characters.', 'invalid_premise')
  const scenes = Array.isArray(input.scenes) ? input.scenes : null
  if (scenes && scenes.length > MAX_API_SHOTS) fail(`A storyboard can include at most ${MAX_API_SHOTS} scenes.`, 'invalid_scenes')
  if (scenes && scenes.some(scene => !scene || typeof scene !== 'object' || Array.isArray(scene))) fail('Each scene must be an object.', 'invalid_scenes')
  const requested = input.shots ?? input.count
  const count = scenes?.length ? scenes.length : (requested == null || requested === '' ? 5 : Math.floor(Number(requested)))
  if (!Number.isFinite(count) || count < 1 || count > MAX_API_SHOTS) fail(`Shots must be a whole number from 1 to ${MAX_API_SHOTS}.`, 'invalid_shots')
  const sequenceMode = input.sequenceMode || input.mode || 'continuous'
  if (sequenceMode !== 'continuous' && sequenceMode !== 'varied') fail('Mode must be "continuous", "varied", "scenario", "ad", "series", or "explainer".', 'invalid_mode')
  const continuity = input.continuity || input.continuityStrength
  if (continuity != null && continuity !== 'standard' && continuity !== 'strict') fail('Continuity must be "standard" or "strict".', 'invalid_continuity')
  return {
    premise,
    model,
    count,
    duration: optionalDuration(input),
    sequenceMode: sequenceMode || undefined,
    continuityStrength: continuity || undefined,
    density: optionalDensity(input),
    aspectRatio: input.aspectRatio,
    genre: typeof input.genre === 'string' ? input.genre : undefined,
    style: typeof input.style === 'string' ? input.style : undefined,
    scenes: scenes || undefined,
    overwritePrompt: input.overwritePrompt === true
  }
}

export function compactStoryboard(project, link) {
  const body = {
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
  if (project.sequenceMode === 'scenario') {
    if (project.sequences?.length) body.sequences = project.sequences.map(sequence => ({ order: sequence.order, duration: sequence.duration, shotIds: sequence.shotIds }))
    if (project.scenarioBudget) body.budget = { length: project.scenarioBudget.length, suggested: project.scenarioBudget.suggested, status: project.scenarioBudget.status }
    if (project.preset) body.preset = { style: project.preset.family, genre: project.preset.genre }
  }
  return body
}

function boardLink(origin, project, options) {
  const scenario = project.sequenceMode === 'scenario' && project.filmSheet ? {
    characters: project.filmSheet.characters,
    places: project.filmSheet.places,
    light: project.filmSheet.light,
    mood: project.filmSheet.mood,
    scenes: project.shots.map(shot => {
      const scene = { who: shot.who, where: shot.where, what: shot.what || shot.action, duration: shot.duration }
      if (shot.cam) scene.camera = shot.cam
      if (shot.light) scene.light = shot.light
      if (shot.mood) scene.mood = shot.mood
      if (shot.promptEdited) scene.prompt = shot.prompt
      return scene
    })
  } : undefined
  return studioUrl(origin, {
    premise: project.premise,
    model: project.model,
    shots: project.shots.length,
    sequenceMode: project.sequenceMode,
    continuityStrength: project.continuityStrength,
    density: project.promptDensity,
    aspectRatio: project.aspectRatio,
    genre: project.preset?.genre || project.genre,
    style: project.preset?.family || options.style || project.style,
    duration: project.duration,
    stepByStep: Boolean(options.scenes?.length),
    scenes: options.scenes,
    scenario,
    preset: project.preset ? { family: project.preset.family, genre: project.preset.genre } : undefined
  })
}

function planProse(input, { origin, compact }) {
  const text = String(input.prose || input.text || input.premise || '')
  if (text.trim().length < 8) fail('Add at least 8 characters of story text.', 'invalid_prose')
  if (text.length > SCENARIO_MAX_CHARS) fail('Keep the story under 8,000 characters so it stays easy to paste and generate.', 'invalid_prose')
  const detected = detectProse(text)
  const parsed = parseScenario(detected.scenario)
  const detection = {
    input: 'prose',
    language: detected.language,
    confidence: detected.confidence,
    warnings: detected.warnings,
    scenario: detected.scenario
  }
  if (!parsed.ok) return { ...detection, errors: parsed.errors }
  const project = createStoryboard({
    scenario: detected.scenario,
    model: input.model,
    aspectRatio: input.aspectRatio,
    style: input.style,
    genre: input.genre,
    duration: input.duration,
    overwritePrompt: input.overwritePrompt === true
  })
  const link = boardLink(origin, project, { style: input.style })
  const board = compact ? compactStoryboard(project, link) : { ...project, studioUrl: link }
  return attachWarnings({ ...board, ...detection }, project)
}

function fullStoryboard(project, link) {
  return { ...project, studioUrl: link, modelProfile: publicProfile(project.model) }
}

function attachWarnings(body, project) {
  const warnings = assessProject(project)
  if (warnings.length) body.warnings = warnings
  return body
}

function planRegenerate(input, { origin, compact }) {
  const source = input.project || input.storyboard
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail('Send the storyboard to regenerate in project.', 'invalid_shot')
  const project = validateProject(source).project
  const shotId = input.regenerateShot || input.shotId
  if (!shotId) fail('Send regenerateShot with the shot id to rebuild.', 'invalid_shot')
  const result = regenerateOneShot(project, shotId, {
    overwrite: input.overwritePrompt === true,
    prompt: typeof input.prompt === 'string' ? input.prompt : undefined
  })
  const link = boardLink(origin, result.project, {})
  const body = compact ? compactStoryboard(result.project, link) : { ...result.project, studioUrl: link }
  body.regenerated = result.skipped ? null : result.shotId
  if (result.skipped) body.kept = true
  return attachWarnings(body, result.project)
}

function agentBody(project, link) {
  return { ...exportAgentBoard(project), studioUrl: link }
}
export function planFromInput(input, { origin = SITE, compact = false } = {}) {
  if (input && typeof input === 'object' && !Array.isArray(input) && input.schema === AGENT_BOARD_SCHEMA) {
    const project = importAgentBoard(input, { overwritePrompt: input.overwritePrompt === true })
    const link = boardLink(origin, project, {})
    if (input.regenerateShot || input.shotId) return planRegenerate({ ...input, project }, { origin, compact })
    return agentBody(project, link)
  }
  if (input && typeof input === 'object' && !Array.isArray(input) && (input.regenerateShot || input.shotId) && (input.project || input.storyboard)) {
    return planRegenerate(input, { origin, compact })
  }
  const options = storyboardOptions(input)
  if (options.prose) return planProse(options.raw, { origin, compact })
  const project = createStoryboard(options)
  const link = boardLink(origin, project, options)
  if (input?.format === 'agent') return agentBody(project, link)
  const body = compact ? compactStoryboard(project, link) : fullStoryboard(project, link)
  return attachWarnings(body, project)
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
    model: { type: 'string', enum: ['grok', 'google', 'sora', 'kling', 'runway', 'luma', 'wan', 'generic'], default: 'grok', description: 'Target video model. Shot length, aspect, prompt form, and risk warnings follow that model’s documented profile. grok and google keep their existing labeled prompts. veo is accepted as google.' },
    shots: { type: 'integer', minimum: 1, maximum: MAX_API_SHOTS, default: 5, description: 'Scene count. Ignored when scenes is a non-empty array. Default 5.' },
    mode: { type: 'string', enum: ['continuous', 'varied', 'scenario', 'ad', 'series', 'explainer'], description: 'Alias of sequenceMode. scenario reads the scenario field or a structured premise. ad, series, and explainer are light presets on the same film sheet. A prompt marked promptEdited is kept.' },
    sequenceMode: { type: 'string', enum: ['continuous', 'varied', 'scenario', 'ad', 'series', 'explainer'] },
    continuity: { type: 'string', enum: ['standard', 'strict'], default: 'standard' },
    density: { type: 'string', enum: ['standard', 'concise'], default: 'standard', description: 'Concise keeps one short continuity line. Standard includes the shared sheet once. Strict still repeats the sheet verbatim.' },
    aspectRatio: { type: 'string', enum: ['9:16', '1:1', '4:5', '16:9'], default: '16:9' },
    genre: { type: 'string', description: `Story genre, or a style-preset genre. Preset families: ${listPresets().map(family => `${family.id} (${family.genres.map(genre => genre.id).join(', ')})`).join('; ')}. Default preset when a scenario omits both is cinema / drama.` },
    style: { type: 'string', description: 'Fun, Normal, Spicy, a visual style id such as cinematic or illustrative, or a preset family: anime, cinema, documentary. manga is an alias of anime. An unknown family is 400. A named family locks that preset into every mode, including a plain premise.' },
    scenario: {
      description: 'Structured scenario. When present, it sets the scene count and wins over scenes. Text form uses CHARACTERS, PLACES, and SCENES blocks. Cap 8,000 characters.',
      oneOf: [{ type: 'string', maxLength: 8000 }, { type: 'object', additionalProperties: true }]
    },
    input: { type: 'string', enum: ['prose'], description: 'Set to prose to detect characters, places, and scenes from free text. Ordinary premises are not auto-detected.' },
    type: { type: 'string', enum: ['prose'], description: 'Alias of input.' },
    prose: { type: 'string', maxLength: 8000, description: 'Free-text story used when input is prose.' },
    text: { type: 'string', maxLength: 8000, description: 'Alias of prose.' },
    overwritePrompt: { type: 'boolean', default: false, description: 'When false or omitted, a hand-edited prompt (promptEdited) is kept, including when a shotboard.compact.v1 board is posted back. When true, those prompts are regenerated.' },
    format: { type: 'string', enum: ['agent'], description: 'Return shotboard.compact.v1 for every mode: title, premise, model, aspect, mode, style, genre, film sheet, and shots. The default compact plan response stays the short payload.' },
    schema: { type: 'string', enum: ['shotboard.compact.v1'], description: 'Send a shotboard.compact.v1 document back to resume it. Prompts marked promptEdited stay as written unless overwritePrompt is true, which regenerates them.' },
    regenerateShot: { type: 'string', description: 'Shot id to rebuild. Send project or storyboard with it. Other shots stay unchanged. A hand-edited prompt is kept unless overwritePrompt is true.' },
    shotId: { type: 'string', description: 'Alias of regenerateShot.' },
    project: { type: 'object', additionalProperties: true, description: 'Existing shotboard.v1 used with regenerateShot.' },
    storyboard: { type: 'object', additionalProperties: true, description: 'Alias of project.' },
    prompt: { type: 'string', description: 'When sent with regenerateShot and without overwritePrompt, this text is stored and marked as edited.' },
    ad: { type: 'object', additionalProperties: true, description: 'Product spot. product, benefit, and optional cta become hook, hero, proof, and pack shot. The product stays on the film sheet. Default aspect is 9:16. Shot length snaps to the selected model.' },
    product: { type: 'string', description: 'Product name for mode ad. Alias of ad.product.' },
    benefit: { type: 'string', description: 'One benefit for mode ad. Alias of ad.benefit.' },
    cta: { type: 'string', description: 'Optional spoken call to action for mode ad. No on-screen lettering is written into the shot.' },
    setting: { type: 'string', description: 'Optional place for mode ad.' },
    series: { type: 'object', additionalProperties: true, description: 'Social short series. title, hook, and 3 to 8 episodes share one film sheet. Default aspect is 9:16. Each episode is three shots.' },
    seriesTitle: { type: 'string', description: 'Series title. Alias of series.title.' },
    hook: { type: 'string', description: 'One-sentence series hook. Alias of series.hook.' },
    episodes: { description: 'Episode count from 3 to 8, or one line per episode.', oneOf: [{ type: 'integer', minimum: 3, maximum: 8 }, { type: 'array', items: { type: 'string' } }, { type: 'string' }] },
    character: { description: 'Shared series character. A string name, or name, look, and outfit.', oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] },
    place: { description: 'Shared series place. A string name, or name and description.', oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] },
    explainer: { type: 'object', additionalProperties: true, description: 'Tutorial. topic, optional audience, and a numbered steps list. Each line is one shot. Duration snaps to the selected model.' },
    topic: { type: 'string', description: 'Explainer topic. Alias of explainer.topic.' },
    audience: { type: 'string', description: 'Optional explainer audience. Stored once on the film sheet.' },
    steps: { description: 'Numbered explainer steps. A string, or an array of strings or { text, prompt } objects. Each step is one shot.', oneOf: [{ type: 'string' }, { type: 'array', items: {} }] },
    duration: { type: 'integer', minimum: 2, maximum: 15, default: 3, description: 'Seconds per scene when a scene does not set its own duration. Default 3. Preset modes snap this length to the selected model profile.' },
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
      description: 'Moovicut plans editable storyboards. It does not render video and it does not save the premise. The default board is 5 scenes × 3 seconds (15 seconds total). Pass shots and duration, or a scenes array, for a custom scene-by-scene board. Humans can do the same in /studio Step-by-step mode. mode ad, series, and explainer are light presets on the same film sheet. A shot marked promptEdited is kept unless overwritePrompt is true. Duration snaps to the selected model profile. studioUrl is a /studio#board= link the browser can open without a server lookup.'
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
            shots: { type: 'array', items: { $ref: '#/components/schemas/CompactShot' } },
            warnings: { type: 'array', description: 'Present only when a shot has a pre-generation risk. Warnings never block the board.', items: { type: 'object', additionalProperties: true } },
            regenerated: { type: 'string', description: 'Shot id rebuilt by regenerateShot. Null when an edited prompt was kept.' }
          }
        },
        FullStoryboard: { type: 'object', description: 'shotboard.v1 project plus studioUrl.' },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Every validation problem in this response.' }
          }
        }
      }
    }
  }
}

const TOOLS = [
  {
    name: 'plan_storyboard',
    description: 'Plan a deterministic storyboard. Default is 5 scenes × 3s (15s total). Pass shots/duration, a scenes array, a scenario, mode ad, series, or explainer, input "prose", format "agent", or a model: grok, google, sora, kling, runway, luma, wan, or generic. A prompt marked promptEdited is kept. Returns a compact payload and a /studio# link. Nothing is stored.',
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
        model: { type: 'string', enum: ['grok', 'google', 'sora', 'kling', 'runway', 'luma', 'wan', 'generic'], default: 'grok' },
        shots: { type: 'integer', minimum: 1, maximum: MAX_API_SHOTS, default: 5 },
        duration: { type: 'integer', minimum: 2, maximum: 15, default: 3 },
        mode: { type: 'string', enum: ['continuous', 'varied', 'scenario', 'ad', 'series', 'explainer'] },
        sequenceMode: { type: 'string', enum: ['continuous', 'varied', 'scenario', 'ad', 'series', 'explainer'] },
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
      const text = Array.isArray(error.errors) ? JSON.stringify({ message: error.message, errors: error.errors }) : error.message
      return rpcResult(id, toolResult(text, true))
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
      const body = { error: error.code || 'invalid_request', message: error.message }
      if (Array.isArray(error.errors) && error.errors.length) body.errors = error.errors
      return json(status, body)
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
