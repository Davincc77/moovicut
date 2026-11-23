/**
 * home-preview — the instant board under the hero composer (design borrow,
 * 24-11: « instant board, then refine »). Pure, deterministic, and local:
 * it runs the SAME engine the studio uses, in this browser, on this device.
 * No fetch, no API, nothing about the idea leaves the tab. That is the one
 * upgrade our architecture has over the mockup that inspired this: their
 * demo calls the server; ours cannot even.
 *
 * Lot F3 (23-11, dogfood « Marc »): prose — anything with two or more
 * sentences — is planned through the provenance engine, so the cards carry
 * the author's own sentences (and their details: the suitcase, the snow,
 * the dawn) instead of generic beat templates. A single-sentence premise
 * keeps the beats: that is what beats are for.
 */
import { createStoryboard } from './prompt-engine.js'
import { storyToBoard } from './story-provenance.js'

const MIN_CHARS = 8
const MAX_CARDS = 4
const CLIP = 140

function clip(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= CLIP) return text
  const window = text.slice(0, CLIP)
  const lastSpace = window.lastIndexOf(' ')
  const head = lastSpace > 60 ? window.slice(0, lastSpace) : window
  return head.replace(/[,.;:—\s]+$/, '') + '…'
}

function sentenceCount(text) {
  return (text.match(/[^.!?…]+[.!?…]+/g) || []).length
}

function tagFor(shot) {
  return [shot.framing, shot.duration ? `${shot.duration}s` : ''].filter(Boolean).join(' · ')
}

export function buildPreview(premise, model) {
  const text = String(premise || '').trim()
  if (text.length < MIN_CHARS) return { ok: false, reason: 'too_short', mode: 'none', shots: [], total: 0, more: 0 }

  if (sentenceCount(text) >= 2) {
    try {
      const { board } = storyToBoard(text, { model: model || 'grok' })
      const all = Array.isArray(board?.shots) ? board.shots : []
      const shots = all.slice(0, MAX_CARDS).map(shot => ({
        order: shot.order,
        line: clip(shot.source || shot.action || shot.title || ''),
        tag: tagFor(shot),
        kind: shot.source ? 'your-words' : 'engine',
        prompt: String(shot.prompt || '')
      }))
      if (shots.length) {
        return { ok: true, reason: '', mode: 'story', shots, total: all.length, more: Math.max(0, all.length - MAX_CARDS) }
      }
    } catch {
      // prose the provenance engine cannot plan falls back to the honest beats,
      // never to an error: the hero board is a taste, not a gate.
    }
  }

  let project = null
  try {
    project = createStoryboard({ premise: text, model: model || 'grok' })
  } catch {
    return { ok: false, reason: 'unplannable', mode: 'none', shots: [], total: 0, more: 0 }
  }
  const all = Array.isArray(project?.shots) ? project.shots : []
  if (!all.length) return { ok: false, reason: 'unplannable', mode: 'none', shots: [], total: 0, more: 0 }
  const shots = all.slice(0, MAX_CARDS).map(shot => ({
    order: shot.order,
    line: clip(shot.action || shot.title || ''),
    tag: tagFor(shot),
    kind: 'engine',
    prompt: String(shot.prompt || '')
  }))
  return { ok: true, reason: '', mode: 'beats', shots, total: all.length, more: Math.max(0, all.length - MAX_CARDS) }
}
