import { canonicalAspect, canonicalDuration, canonicalModel, canonicalShotCount, DEFAULT_SHOT_COUNT, DEFAULT_SHOT_DURATION, MAX_SCENE_OVERRIDES } from './prompt-engine.js'
import { cleanText } from './text.js'

export const STUDIO_LINK_MAX = 12000
export const STUDIO_BOARD_KEY = 'board'

function text(value, max) {
  return typeof value === 'string' ? cleanText(value).slice(0, max) : ''
}

export function sanitizeScenes(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_SCENE_OVERRIDES).map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const scene = {}
    const action = text(raw.action, 2000) || text(raw.beat, 2000) || text(raw.description, 2000)
    const notes = text(raw.notes, 1000) || text(raw.note, 1000)
    const framing = text(raw.framing, 150)
    const camera = text(raw.camera, 300)
    const lighting = text(raw.lighting, 300) || text(raw.mood, 300)
    if (action) scene.action = action
    if (notes) scene.notes = notes
    if (framing) scene.framing = framing
    if (camera) scene.camera = camera
    if (lighting) scene.lighting = lighting
    if (raw.duration != null && raw.duration !== '') scene.duration = canonicalDuration(raw.duration)
    return scene
  }).filter(scene => Object.keys(scene).length)
}

export function sharePayload(options = {}) {
  const payload = {
    v: 1,
    premise: text(options.premise, 6000),
    model: canonicalModel(options.model) || 'grok',
    shots: canonicalShotCount(options.shots ?? options.count ?? DEFAULT_SHOT_COUNT),
    continuity: options.continuity === 'strict' || options.continuityStrength === 'strict' ? 'strict' : 'standard',
    density: options.density === 'concise' || options.promptDensity === 'concise' ? 'concise' : 'standard',
    aspectRatio: canonicalAspect(options.aspectRatio),
    duration: canonicalDuration(options.duration ?? DEFAULT_SHOT_DURATION)
  }
  if (options.sequenceMode === 'varied' || options.sequenceMode === 'continuous') payload.sequenceMode = options.sequenceMode
  const genre = text(options.genre, 40)
  const style = text(options.style, 40)
  if (genre) payload.genre = genre
  if (style) payload.style = style
  if (options.stepByStep) payload.stepByStep = true
  const scenes = sanitizeScenes(options.scenes)
  if (scenes.length) {
    payload.scenes = scenes
    payload.shots = scenes.length
  }
  return payload
}

export function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(String(value))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function tokenFor(payload) {
  const encoded = encodeBase64Url(JSON.stringify(payload))
  return encoded.length <= STUDIO_LINK_MAX ? encoded : ''
}

export function encodeStudioBoard(options = {}) {
  const full = sharePayload(options)
  if (full.premise.length < 8) return ''
  const withScenes = tokenFor(full)
  if (withScenes) return withScenes
  const { scenes, stepByStep, ...settings } = full
  const compact = tokenFor(settings)
  if (compact) return compact
  const slim = tokenFor({ ...settings, premise: settings.premise.slice(0, 1500) })
  return slim && sharePayload({ ...settings, premise: settings.premise.slice(0, 1500) }).premise.length >= 8 ? slim : ''
}

export function decodeStudioBoard(token) {
  const value = String(token || '')
  if (!value || value.length > STUDIO_LINK_MAX || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  let parsed
  try { parsed = JSON.parse(decodeBase64Url(value)) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.v !== 1) return null
  const payload = sharePayload(parsed)
  if (payload.premise.length < 8) return null
  return payload
}

export function boardTokenFromHash(hash) {
  const text = String(hash || '').replace(/^#/, '')
  if (!text) return ''
  const params = new URLSearchParams(text)
  return params.get(STUDIO_BOARD_KEY) || ''
}

export function studioHash(options) {
  const token = encodeStudioBoard(options)
  return token ? `#${STUDIO_BOARD_KEY}=${token}` : ''
}

export function studioUrl(origin, options) {
  const base = String(origin || 'https://moovicut.studio').replace(/\/$/, '')
  const hash = studioHash(options)
  return `${base}/studio${hash}`
}
