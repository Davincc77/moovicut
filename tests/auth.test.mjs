import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { legacyRedirectTarget } from '../server/prod-server.mjs'

test('retired account addresses point at the local studio', () => {
  for (const path of ['/login', '/signin', '/auth/login', '/auth/callback', '/auth/signin']) {
    assert.equal(legacyRedirectTarget(path), '/studio', path)
  }
  assert.equal(existsRetired(), false)
})

function existsRetired() {
  return ['app/pages/login.vue', 'app/pages/signin.vue', 'app/components/StudioRedirect.vue'].some(file => {
    try { readFileSync(file); return true } catch { return false }
  })
}
