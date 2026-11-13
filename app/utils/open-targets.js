// Grok Imagine (https://grok.com/imagine) and Google Flow
// (https://labs.google/fx/tools/flow) do not document a public query that
// prefills the image or video box. grok.com/?q= opens Grok chat, not Imagine.
// Copy the prompt, then open the tool.

export const OPEN_TARGETS = Object.freeze([
  { id: 'grok', label: 'Open in Grok Imagine', href: 'https://grok.com/imagine' },
  { id: 'google', label: 'Open in Google', href: 'https://labs.google/fx/tools/flow' }
])

export function orderedOpenTargets(seed = 0) {
  const targets = OPEN_TARGETS.map(target => ({ ...target }))
  if (Number(seed) % 2 === 1) targets.reverse()
  return targets
}

export function openTargetPlan(id) {
  const target = OPEN_TARGETS.find(item => item.id === id)
  if (!target) throw new Error('Choose Grok Imagine or Google.')
  return { ...target, copy: true, toast: 'Prompt copied' }
}

export function combinedShotPrompts(project) {
  return (project?.shots || []).map((shot, index) => `Shot ${index + 1}\n${shot.prompt || ''}`).filter(text => text.trim()).join('\n\n')
}

export async function runOpenTarget({ id, prompt, copyText, open, pauseMs = 1500 }) {
  const plan = openTargetPlan(id)
  const text = String(prompt || '').trim()
  if (!text) throw new Error('Create a prompt before opening it.')
  if (plan.copy) {
    const copied = await copyText(text, plan.toast)
    if (!copied) return { ...plan, opened: false }
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs))
  }
  open(plan.href)
  return { ...plan, opened: true }
}
