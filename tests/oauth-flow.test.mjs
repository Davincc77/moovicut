import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the website no longer ships a provider account flow', () => {
  assert.throws(() => readFileSync('app/composables/useAuth.js', 'utf8'))
  assert.throws(() => readFileSync('app/composables/useOauthSetup.js', 'utf8'))
  const header = readFileSync('app/components/AppHeader.vue', 'utf8')
  const workspace = readFileSync('app/components/WorkspaceHeader.vue', 'utf8')
  assert.doesNotMatch(header, /Sign In|signin-link/)
  assert.doesNotMatch(workspace, /Sign in \(optional\)/)
})
