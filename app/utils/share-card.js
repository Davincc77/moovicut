/** Plain lines for a locally drawn storyboard card. Nothing is uploaded. */
export function shareCardLines(project = {}) {
  const shots = Array.isArray(project.shots) ? project.shots : []
  const lines = ['Moovicut', project.title || 'Storyboard']
  shots.forEach((shot, index) => {
    lines.push(`${String(index + 1).padStart(2, '0')}  ${shot.stage || 'Shot'} · ${shot.title || 'Untitled'}`)
    if (shot.action) lines.push(shot.action)
    if (shot.camera) lines.push(shot.camera)
  })
  return lines
}

export function wrapShareLine(text, maxChars = 62) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, 6)
}

/** Draw the shot list on a canvas in this browser and return a PNG blob. */
export function drawShareCard(project) {
  const width = 1080
  const margin = 56
  const maxChars = 62
  const blocks = shareCardLines(project).flatMap(line => wrapShareLine(line, maxChars))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = margin * 2 + blocks.length * 36
  const context = canvas.getContext('2d')
  context.fillStyle = '#0a0a0a'
  context.fillRect(0, 0, canvas.width, canvas.height)
  blocks.forEach((line, index) => {
    const title = index < 2 || /^\d{2}\s/.test(line)
    context.fillStyle = title ? '#f0b429' : '#eae7df'
    context.font = title ? '600 28px Inter, sans-serif' : '22px Inter, sans-serif'
    context.fillText(line, margin, margin + 28 + index * 36)
  })
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'))
}
