import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dispatchAgentRequest, openApiDocument } from '../server/agent-api.mjs'
import { createProdServer } from '../server/prod-server.mjs'
import { FRAMING_TERMS } from '../app/utils/framing.js'

const skill = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8')
const doc = openApiDocument()
const requestSchema = doc.components.schemas.StoryboardRequest

function section(name) {
  const marker = `## ${name}\n`
  const start = skill.indexOf(marker)
  assert.ok(start >= 0, name)
  const rest = skill.slice(start + marker.length)
  const next = rest.search(/\n## /)
  return next < 0 ? rest : rest.slice(0, next)
}

function codes(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map(match => match[1])
}

function walk(schema, visit) {
  if (!schema || typeof schema !== 'object') return
  visit(schema)
  for (const value of Object.values(schema.properties || {})) walk(value, visit)
  for (const key of ['items', 'additionalProperties']) walk(schema[key], visit)
  for (const key of ['oneOf', 'anyOf', 'allOf']) (schema[key] || []).forEach(child => walk(child, visit))
}

function propertyEnums() {
  const found = new Map()
  walk(requestSchema, schema => {
    for (const [name, value] of Object.entries(schema.properties || {})) {
      if (!value.enum) continue
      if (!found.has(name)) found.set(name, value.enum)
    }
  })
  return found
}

function serverErrorCodes() {
  const files = [
    'server/agent-api.mjs',
    'server/prod-server.mjs',
    'app/utils/prompt-engine.js',
    'app/utils/prompt-lang.js',
    'app/utils/presets/index.js'
  ]
  const found = new Set()
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    for (const match of source.matchAll(/'(invalid_[a-z_]+|too_many_shots|misplaced_scenario_fields|unknown_tool|rate_limited|payload_too_large|method_not_allowed|invalid_json|not_found|invalid_request)'/g)) found.add(match[1])
  }
  return found
}

test('the served skill matches the repository skill', async () => {
  assert.equal(readFileSync('public/SKILL.md', 'utf8'), skill)
  assert.match(skill, /^---\nname: moovicut\n/)
  assert.match(readFileSync('public/llms.txt', 'utf8'), /SKILL\.md/)
  assert.match(readFileSync('README.md', 'utf8'), /\/SKILL\.md/)
  assert.match(readFileSync('AGENTS.md', 'utf8'), /\/SKILL\.md/)
  assert.match(readFileSync('app/pages/agents.vue', 'utf8'), /\/SKILL\.md/)
  assert.match(doc.info.description, /\/SKILL\.md/)
  assert.doesNotMatch(readFileSync('nuxt.config.ts', 'utf8'), /de:1|lb:1/)
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-skill-'))
  writeFileSync(join(directory, 'SKILL.md'), skill)
  const server = createProdServer({ staticRoot: directory })
  const base = await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
  try {
    const response = await fetch(`${base}/SKILL.md`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /markdown/)
    assert.equal(await response.text(), skill)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('every field, enum, endpoint, and error code in the skill exists on the API', () => {
  const properties = new Set(Object.keys(requestSchema.properties))
  for (const name of codes(section('Request fields'))) assert.ok(properties.has(name), name)
  const enums = propertyEnums()
  const enumSection = section('Enums')
  for (const match of enumSection.matchAll(/### ([A-Za-z_]+)\n([^#]*)/g)) {
    const name = match[1]
    const values = codes(match[2])
    assert.deepEqual(values.slice().sort(), [...(enums.get(name) || [])].slice().sort(), name)
  }
  for (const [name, values] of enums) {
    assert.match(enumSection, new RegExp(`### ${name}\\n`), name)
    for (const value of values) assert.ok(enumSection.includes(`\`${value}\``), `${name} ${value}`)
  }
  for (const endpoint of section('Endpoints').matchAll(/`(GET|POST)` `(\/[^`]+)`/g)) {
    const path = doc.paths[endpoint[2]]
    assert.ok(path?.[endpoint[1].toLowerCase()], `${endpoint[1]} ${endpoint[2]}`)
  }
  const known = serverErrorCodes()
  const listed = [...section('Error codes').matchAll(/^- `([a-z][a-z0-9_]*)`:/gm)].map(match => match[1])
  assert.ok(listed.length > 5)
  for (const code of listed) assert.ok(known.has(code), code)
  const required = new Set()
  for (const schema of [requestSchema, doc.components.schemas.CompactStoryboard, doc.components.schemas.CompactShot]) {
    for (const name of schema.required || []) required.add(name)
    for (const branch of schema.anyOf || []) for (const name of branch.required || []) required.add(name)
  }
  for (const name of required) assert.match(skill, new RegExp(`\`${name}\``), name)
  for (const term of FRAMING_TERMS) assert.match(skill, new RegExp(`\`${term.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\``), term.label)
})

test('the skill example request plans a storyboard', () => {
  const example = skill.match(/```json\n([\s\S]*?)```/)[1]
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: example
  })
  assert.equal(response.status, 200, response.body)
  const body = JSON.parse(response.body)
  assert.equal(body.model, 'grok')
  assert.ok(body.shots.length >= 1)
  assert.ok(body.studioUrl)
})
