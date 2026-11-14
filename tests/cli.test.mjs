import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createStoryboard } from '../app/utils/prompt-engine.js'
const cli = fileURLToPath(new URL('../cli/moovicut.mjs', import.meta.url))
function run(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => resolve({ code, stdout, stderr }))
    if (input == null) child.stdin.end()
    else { child.stdin.write(input); child.stdin.end() }
  })
}
test('CLI capabilities disclose local prompt planning, not remote video generation', async () => {
  const result = await run(['--capabilities'])
  assert.equal(result.code, 0)
  const capabilities = JSON.parse(result.stdout)
  assert.equal(capabilities.video_generation, false)
  assert.equal(capabilities.maxShots,null)
  assert.match(capabilities.coreFeatures,/free/)
})
test('CLI creates an explicit shot count and exports a valid Google document', async () => {
  const result = await run(['--premise', 'A lighthouse keeper repairs a failing beacon before a boat reaches the rocks.', '--model', 'google', '--shots', '4'])
  assert.equal(result.code, 0)
  const project = JSON.parse(result.stdout)
  assert.equal(project.schema, 'shotboard.v1')
  assert.equal(project.target_model, 'google')
  assert.equal(project.shots.length, 4)
})
test('CLI reads stdin, preserves the prompt through moving, and supports undo metadata', async () => {
  const project = createStoryboard({ premise: 'An astronomer hears a response from an abandoned observatory.', count: 3 })
  const original = project.shots[0]
  const result = await run(['--move', original.id, '--direction', '1'], JSON.stringify(project))
  assert.equal(result.code, 0)
  const moved = JSON.parse(result.stdout)
  assert.equal(moved.shots[1].id, original.id)
  assert.equal(moved.shots[1].action, original.action)
  assert.equal(moved.shots[1].id, 'shot-01')
})
test('CLI rejects missing files, invalid models, missing shots and empty input without a traceback', async () => {
  for (const args of [['--premise', 'valid premise for a film', '--model', 'unknown'], ['--delete', 'missing-shot'], ['--input', 'no-such-moovicut-file.json']]) {
    const result = await run(args)
    assert.notEqual(result.code, 0)
    assert.ok(result.stderr.trim())
    assert.equal(result.stderr.includes('    at '), false)
  }
  const result = await run(['--delete', 'shot-1'], '{bad json')
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /JSON|Unexpected/)
})
