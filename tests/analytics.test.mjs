import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const VISIT_LINE = 'Anonymous, cookieless visit counts via Cloudflare Web Analytics; storyboards never leave the device.'

test('every page can load the public Cloudflare analytics beacon', () => {
  const config = readFileSync('nuxt.config.ts', 'utf8')
  assert.match(config, /src: 'https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js'/)
  assert.match(config, /type: 'module'/)
  assert.match(config, /data-cf-beacon': '\{"token": "d4d43f476a9e4f7b9f3d9d8d4dd75a3b"\}'/)
  for (const file of ['public/faq.md', 'app/pages/faq.vue', 'app/pages/index.vue', 'app/utils/prompt-engine.js']) {
    assert.ok(readFileSync(file, 'utf8').includes(VISIT_LINE), file)
  }
  const servers = ['server/prod-server.mjs', 'server/index.mjs', 'nuxt.config.ts'].map(file => readFileSync(file, 'utf8')).join('\n')
  if (/content-security-policy/i.test(servers)) {
    assert.match(servers, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/)
    assert.match(servers, /connect-src[^;]*https:\/\/cloudflareinsights\.com/)
  }
})
