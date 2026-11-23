/**
 * home-preview — the instant board under the hero composer (design borrow,
 * 24-11: « instant board, then refine »). Pure, deterministic, and local:
 * it runs the SAME engine the studio uses, in this browser, on this device.
 * No fetch, no API, nothing about the idea leaves the tab. That is the one
 * upgrade our architecture has over the mockup that inspired this: their
 * demo calls the server; ours cannot even.
 */
import { createStoryboard } from './prompt-engine.js'

const MIN_CHARS = 8
const MAX_CARDS = 4

export function buildPreview(premise, model) {
  const text = String(premise || '').trim()
  if (text.length < MIN_CHARS) return { ok: false, reason: 'too_short', shots: [], total: 0 }
  let project = null
  try {
    project = createStoryboard({ premise: text, model: model || 'grok' })
  } catch {
    return { ok: false, reason: 'unplannable', shots: [], total: 0 }
  }
  const all = Array.isArray(project?.shots) ? project.shots : []
  if (!all.length) return { ok: false, reason: 'unplannable', shots: [], total: 0 }
  const shots = all.slice(0, MAX_CARDS).map(shot => ({
    order: shot.order,
    line: String(shot.action || shot.title || '').slice(0, 110),
    tag: [shot.framing, shot.duration ? `${shot.duration}s` : ''].filter(Boolean).join(' · '),
    prompt: String(shot.prompt || '')
  }))
  return { ok: true, reason: '', shots, total: all.length, more: Math.max(0, all.length - MAX_CARDS) }
}
