import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')

test('the output map opens AGENTS.md and answers every shape with its request body', () => {
  const md = read('AGENTS.md')
  assert.equal(read('public/agents.md'), md) // the pair stays byte-identical
  const boardAt = md.indexOf('## Default board')
  const section = md.slice(md.indexOf('## Start from the output you want'), boardAt)
  assert.ok(section.length > 400 && md.slice(0, boardAt).includes(section), 'section sits before Default board')
  for (const shape of [
    '"premise"', '"scenes"', 'scenario', '"input": "prose"', '"mode": "ad"',
    '"mode": "series"', '"mode": "explainer"', 'shotboard.compact.v1', 'regenerateShot'
  ]) assert.ok(section.includes(shape), `missing shape entry: ${shape}`)
  assert.match(section, /refused body names the field/, 'repair discipline')
  assert.match(section, /the same body answers identically on `\/mcp` and `\/a2a`/, 'surface parity promised')
})

test('llms.txt points weak agents at the output map first', () => {
  const llms = read('public/llms.txt')
  const mapAt = llms.indexOf('[Output map]')
  const guideAt = llms.indexOf('[Full agent guide]')
  assert.ok(mapAt > -1 && guideAt > -1 && mapAt - guideAt < 120, 'Output map bullet right after the guide link')
  assert.match(llms.slice(mapAt, mapAt + 120), /start there/i)
})
