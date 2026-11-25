import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const VISIT_LINE = 'The site keeps a simple server-side visit count (POST /api/visits) stored on a persistent volume, with no personal data and no third-party analytics. Storyboards never leave the device.'

test('no third-party analytics beacon ships anywhere', () => {
  const config = readFileSync('nuxt.config.ts', 'utf8')
  assert.doesNotMatch(config, /cloudflareinsights/)
  assert.doesNotMatch(config, /beacon\.min\.js/)
  for (const file of ['public/faq.md', 'app/pages/faq.vue', 'app/pages/index.vue', 'app/utils/prompt-engine.js']) {
    assert.ok(readFileSync(file, 'utf8').includes(VISIT_LINE), file)
  }
  const servers = ['server/prod-server.mjs', 'server/index.mjs', 'nuxt.config.ts'].map(file => readFileSync(file, 'utf8')).join('\n')
  if (/content-security-policy/i.test(servers)) {
    assert.doesNotMatch(servers, /cloudflareinsights/)
  }
})
