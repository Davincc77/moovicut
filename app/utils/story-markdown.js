import { cleanText } from './text.js'

function line(label, value) {
  const text = cleanText(value)
  return text ? `- ${label}: ${text}` : ''
}

/** A readable shot sheet. Prompts stay fenced so Markdown does not swallow them. */
export function storyMarkdown(project = {}) {
  const shots = Array.isArray(project.shots) ? project.shots : []
  const title = cleanText(project.title) || 'Untitled story'
  const lines = [`# ${title}`, '']
  if (project.premise) lines.push(cleanText(project.premise), '')
  const facts = [
    project.model ? `Model: ${project.model}` : '',
    project.aspectRatio ? `Aspect ratio: ${project.aspectRatio}` : '',
    project.sequenceMode ? `Sequence: ${project.sequenceMode}` : '',
    project.promptDensity ? `Density: ${project.promptDensity}` : '',
    project.continuityStrength ? `Continuity: ${project.continuityStrength}` : ''
  ].filter(Boolean)
  if (facts.length) lines.push(facts.join(' · '), '')
  const total = shots.reduce((sum, shot) => sum + (Number(shot.duration_seconds ?? shot.duration) || 0), 0)
  if (total) lines.push(`Total duration: ${total}s`, '')
  shots.forEach((shot, index) => {
    const order = shot.order || index + 1
    lines.push(`## Shot ${order} — ${cleanText(shot.title || shot.stage) || `Scene ${order}`}`, '')
    const seconds = Number(shot.duration_seconds ?? shot.duration)
    for (const entry of [
      line('Duration', Number.isFinite(seconds) && seconds > 0 ? `${seconds}s` : ''),
      line('Stage', shot.stage),
      line('Framing', shot.framing),
      line('Camera', shot.camera),
      line('Lighting', shot.lighting),
      line('Action', shot.action),
      line('Notes', shot.notes || '')
    ]) if (entry) lines.push(entry)
    if (shot.prompt) lines.push('', '```', shot.prompt, '```')
    lines.push('')
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
