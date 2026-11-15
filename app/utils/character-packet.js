/** A packet the user can attach in another tool. No upload and no model call. */
import { asCharacter, lockLineFor, lockLinesForShot, SHEET_KEYS } from './character-lock.js'
import { promptFraming } from './framing.js'

const PACKET_SCHEMA = 'moovicut.character-packet.v1'

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

export function characterPacket(project = {}) {
  const characters = (project.filmSheet?.characters || []).map(character => {
    const person = asCharacter(character)
    return {
      name: person.name,
      lockLine: person.lockEdited ? person.lockLine : lockLineFor(person, 1),
      look: person.look,
      outfit: person.outfit,
      body: person.body,
      face: person.face,
      hair: person.hair,
      colors: person.colors,
      marks: person.marks,
      states: person.states,
      sheet: person.sheet
    }
  })
  return {
    schema: PACKET_SCHEMA,
    title: project.title || '',
    premise: project.premise || '',
    model: project.model || project.target_model || '',
    promptStyle: project.promptStyle === 'detailed' ? 'detailed' : 'short',
    note: 'Moovicut does not call an image or video API. Attach these references in the tool you already use.',
    characters,
    shots: (project.shots || []).map((shot, index) => ({
      order: shot.order || index + 1,
      who: shot.who || '',
      framing: promptFraming(shot),
      action: shot.what || shot.action || '',
      prompt: shot.prompt || '',
      lockLines: lockLinesForShot(shot, project, index)
    }))
  }
}

function sheetLines(person) {
  const labels = { front: 'Front', side: 'Side', back: 'Back', expressions: 'Expressions', palette: 'Palette', outfit: 'Outfit', props: 'Props' }
  return SHEET_KEYS.map(key => person.sheet?.[key] ? `${labels[key]}: ${person.sheet[key]}` : '').filter(Boolean)
}

export function characterPacketMarkdown(project = {}) {
  const packet = characterPacket(project)
  const lines = [
    `# ${packet.title || 'Character packet'}`,
    '',
    'Attach this with the shot prompts. Moovicut does not call an image or video API. Reference images stay in the JSON packet.',
    ''
  ]
  if (packet.premise) lines.push(packet.premise, '')
  packet.characters.forEach(person => {
    lines.push(`## ${person.name || 'Character'}`, '', 'Lock line (paste unchanged):', '', person.lockLine || `${person.name}.`, '')
    ;[['Body', person.body], ['Face', person.face], ['Hair', person.hair], ['Colors', person.colors], ['Marks', person.marks], ['Outfit', person.outfit]].forEach(([label, value]) => {
      if (value) lines.push(`- ${label}: ${value}`)
    })
    sheetLines(person).forEach(line => lines.push(`- ${line}`))
    ;(person.states || []).forEach(state => lines.push(`- From shot ${state.fromOrder}: ${state.change}`))
    ;(person.sheet?.refs || []).filter(ref => ref.name || ref.note || ref.dataUrl).forEach(ref => {
      lines.push(`- Reference (${ref.slot}): ${ref.name || 'image'}${ref.note ? ` — ${ref.note}` : ''}`)
    })
    lines.push('')
  })
  lines.push('## Shots', '')
  packet.shots.forEach(shot => {
    lines.push(`### Shot ${shot.order} — ${shot.framing}`, '', shot.prompt || shot.action || '', '')
  })
  return lines.join('\n')
}

export function characterPacketDocument(project = {}) {
  const packet = characterPacket(project)
  const people = packet.characters.map(person => {
    const facts = [['Body', person.body], ['Face', person.face], ['Hair', person.hair], ['Colors', person.colors], ['Marks', person.marks], ['Outfit', person.outfit]]
      .filter(([, value]) => value)
      .map(([label, value]) => `<p><strong>${label}.</strong> ${escapeHtml(value)}</p>`)
      .join('')
    const turn = sheetLines(person).map(line => `<p>${escapeHtml(line)}</p>`).join('')
    const states = (person.states || []).map(state => `<p>From shot ${state.fromOrder}: ${escapeHtml(state.change)}</p>`).join('')
    const refs = (person.sheet?.refs || []).filter(ref => ref.dataUrl || ref.name).map(ref => {
      const image = ref.dataUrl ? `<img alt="${escapeHtml(ref.name || `${person.name} ${ref.slot}`)}" src="${ref.dataUrl}" />` : ''
      return `<figure>${image}<figcaption>${escapeHtml(ref.slot)} ${escapeHtml(ref.name)} ${escapeHtml(ref.note)}</figcaption></figure>`
    }).join('')
    return `<section><h2>${escapeHtml(person.name)}</h2><p class="lock">${escapeHtml(person.lockLine)}</p>${facts}${turn}${states}<div class="refs">${refs}</div></section>`
  }).join('')
  const shots = packet.shots.map(shot => `<section><h3>Shot ${shot.order} — ${escapeHtml(shot.framing)}</h3><pre>${escapeHtml(shot.prompt)}</pre></section>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(packet.title || 'Character packet')}</title><style>
    body{margin:24px;font:16px/1.45 "Iowan Old Style",Palatino,"Palatino Linotype",serif;color:#1c1915;background:#f7f3ea}
    h1,h2,h3{font-family:Georgia,serif;font-weight:600}
    .lock{padding:10px 12px;border-left:3px solid #8d6a32;background:#fff}
    pre{white-space:pre-wrap;font:13px/1.4 ui-monospace,monospace}
    img{max-width:180px;height:auto}
    figure{display:inline-block;margin:8px 12px 0 0}
    @media print { body{margin:12mm;background:#fff} }
  </style></head><body><h1>${escapeHtml(packet.title || 'Character packet')}</h1><p>${escapeHtml(packet.note)}</p>${people}<h2>Shots</h2>${shots}</body></html>`
}
