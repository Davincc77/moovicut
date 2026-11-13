export const STUDIO_HANDOFF_KEY = 'shotboard.handoff.v1'

export function saveStudioHandoff(storage, { premise = '', model = '' } = {}) {
  const idea = String(premise || '').replace(/\s+/g, ' ').trim().slice(0, 6000)
  const target = model === 'google' || model === 'grok' ? model : ''
  storage?.setItem(STUDIO_HANDOFF_KEY, JSON.stringify({ premise: idea, model: target }))
  return { premise: idea, model: target }
}

export function takeStudioHandoff(storage) {
  let saved = {}
  try { saved = JSON.parse(storage?.getItem(STUDIO_HANDOFF_KEY) || '{}') } catch { saved = {} }
  storage?.removeItem(STUDIO_HANDOFF_KEY)
  const premise = typeof saved.premise === 'string' ? saved.premise.trim().slice(0, 6000) : ''
  const model = saved.model === 'google' || saved.model === 'grok' ? saved.model : ''
  return { premise, model }
}
