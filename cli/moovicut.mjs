#!/usr/bin/env node
/** Offline automation: no server, API account, or nondeterministic model call. */
import fs from 'node:fs/promises'
import { createStoryboard, serializeProject, validateProject, createPrompt, normalizeProject } from '../app/utils/prompt-engine.js'
const argv = process.argv.slice(2)
function option(name) { const index = argv.indexOf(`--${name}`); return index >= 0 ? argv[index + 1] : undefined }
function help() { return `Moovicut v1.0 — local storyboard automation\n\nThe default board is 5 scenes of 3 seconds (15s total). Pass --shots and --duration to override.\n\nGenerate:\n  moovicut --premise "A lighthouse keeper..." --model grok\n  moovicut --premise "A paper map in space..." --model google --shots 4 --duration 3\n\nRead a project from stdin or --input story.json. Output is a shotboard.v1 JSON document.\nEdit:\n  --set-title "My film"\n  --shot-id shot-02 --patch '{"camera":"Slow dolly"}'\n  --move shot-02 --direction -1\n  --delete shot-02\nOther: --capabilities --export-prompts --output story.json --density concise --continuity strict --sequence continuous --help\n\nshotboard is a deprecated alias for the moovicut command.\n` }
async function main() {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(help()); return }
  if (argv.includes('--capabilities')) { console.log(JSON.stringify({ schema: 'shotboard.v1', models: ['grok', 'google'], maxShots: null, defaultShots: 5, defaultDuration: 3, defaultTotalSeconds: 15, coreFeatures:'free; no credits, subscriptions or feature paywalls', promptFields: ['camera', 'action', 'lighting', 'style', 'continuity', 'sound'], actions: ['generate', 'edit', 'reorder', 'delete', 'export'], video_generation: false, authentication: 'none' }, null, 2)); return }
  if (option('premise')) {
    const count = Math.max(1, Math.floor(Number(option('shots')) || 5))
    return writeOutput(createStoryboard({ premise: option('premise'), model: option('model') || 'grok', count, genre: option('genre'), style: option('style'), aspectRatio: option('aspect-ratio'), duration: option('duration'), sequenceMode: option('sequence'), continuityStrength: option('continuity'), density: option('density') }))
  }
  const inputPath = option('input')
  const input = inputPath ? await fs.readFile(inputPath, 'utf8') : await readStdin()
  if (!input.trim()) throw new Error('Provide --premise or a storyboard JSON document via --input or stdin. Use --help for examples.')
  const project = normalizeProject(validateProject(JSON.parse(input)).project)
  for (const shot of project.shots) { shot.shot_id = shot.id = String(shot.shot_id || shot.id); shot.order = Number(shot.order) }
  if (option('set-title')) project.title = option('set-title')
  if (option('shot-id') && option('patch')) {
    const index = project.shots.findIndex(shot => shot.shot_id === option('shot-id'))
    if (index < 0) throw new Error(`Shot ID not found: ${option('shot-id')}`)
    const patch = JSON.parse(option('patch'))
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Patch must be an object.')
    const allowed = ['title', 'action', 'camera', 'lighting', 'continuity', 'prompt', 'framing', 'lens', 'sound', 'duration', 'duration_seconds']
    for (const field of allowed) if (typeof patch[field] === 'string') project.shots[index][field] = patch[field].slice(0, 16000)
    if (!patch.prompt) project.shots[index].prompt = createPrompt(project.shots[index], project, index)
    if (patch.duration_seconds !== undefined || patch.duration !== undefined) {
      const duration = Math.max(2, Math.min(15, Number(patch.duration_seconds ?? patch.duration) || 3))
      project.shots[index].duration = duration; project.shots[index].duration_seconds = duration
    }
  }
  if (option('move')) {
    const index = project.shots.findIndex(shot => shot.shot_id === option('move'))
    if (index < 0) throw new Error(`Shot ID not found: ${option('move')}`)
    const direction = Number(option('direction'))
    if (![1, -1].includes(direction)) throw new Error('Direction must be -1 or 1.')
    const target = Math.max(0, Math.min(project.shots.length - 1, index + direction))
    const [shot] = project.shots.splice(index, 1); project.shots.splice(target, 0, shot)
  }
  if (option('delete')) {
    if (!project.shots.some(shot => shot.shot_id === option('delete'))) throw new Error(`Shot ID not found: ${option('delete')}`)
    if (project.shots.length <= 1) throw new Error('The storyboard must retain at least one shot.')
    project.shots = project.shots.filter(shot => shot.shot_id !== option('delete'))
  }
  project.shots.forEach((shot, index) => { shot.order = index + 1; if (option('move')) shot.prompt = createPrompt(shot, project, index) })
  project.updatedAt = new Date().toISOString()
  if (option('export-prompts')) {
    const output = project.shots.map(shot => `SHOT ${String(shot.order).padStart(2, '0')}\n${shot.prompt}`).join('\n\n---\n\n')
    const file = option('output')
    if (file) { await fs.writeFile(file, output, { mode: 0o600 }); console.error(`Saved ${file}`) }
    else console.log(output)
    return
  }
  await writeOutput(project)
}
async function readStdin() { if (process.stdin.isTTY) return ''; let s = ''; for await (const chunk of process.stdin) { s += chunk; if (Buffer.byteLength(s) > 1_000_000) throw new Error('Input exceeds the 1 MB limit.') } return s }
async function writeOutput(project) {
  const output = option('export-prompts') ? project.shots.map(shot => `SHOT ${String(shot.order).padStart(2, '0')}\n${shot.prompt}`).join('\n\n---\n\n') : serializeProject(project)
  const file = option('output')
  if (file) { await fs.writeFile(file, output, { mode: 0o600 }); console.error(`Saved ${file}`) }
  else console.log(output)
}
main().catch(error => { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1 })
