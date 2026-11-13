import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProdServer, legacyRedirectTarget } from '../server/prod-server.mjs'
import { createVisitServer } from '../server/index.mjs'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

test('production server serves the site at root and keeps old /shotboard links', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-prod-'))
  mkdirSync(join(directory, '_nuxt'))
  mkdirSync(join(directory, 'signin'))
  writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Home</title>')
  writeFileSync(join(directory, '200.html'), '<!doctype html><title>Studio shell</title>')
  writeFileSync(join(directory, 'signin', 'index.html'), '<!doctype html><p>Opening the studio.</p>')
  writeFileSync(join(directory, '_nuxt', 'entry.abc123.js'), 'export const ready = true')
  const server = createProdServer({ staticRoot: directory })
  const base = await listen(server)
  try {
    const health = await fetch(`${base}/healthz`)
    assert.equal(health.status, 200)
    assert.match(health.headers.get('content-type'), /^text\/plain/)
    assert.equal(await health.text(), 'ok')

    const root = await fetch(`${base}/`)
    assert.equal(root.status, 200)
    assert.match(root.headers.get('content-type'), /^text\/html/)
    assert.match(await root.text(), /<title>Home<\/title>/)

    const asset = await fetch(`${base}/_nuxt/entry.abc123.js`)
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('content-type'), /^text\/javascript/)
    assert.match(asset.headers.get('cache-control'), /max-age=31536000/)
    assert.match(asset.headers.get('cache-control'), /immutable/)
    assert.match(await asset.text(), /ready/)

    const moved = await fetch(`${base}/shotboard/x`, { redirect: 'manual' })
    assert.equal(moved.status, 301)
    assert.equal(moved.headers.get('location'), '/x')

    const queried = await fetch(`${base}/shotboard/faq?ref=old&x=1`, { redirect: 'manual' })
    assert.equal(queried.status, 301)
    assert.equal(queried.headers.get('location'), '/faq?ref=old&x=1')

    const prefixRoot = await fetch(`${base}/shotboard/?from=legacy`, { redirect: 'manual' })
    assert.equal(prefixRoot.status, 301)
    assert.equal(prefixRoot.headers.get('location'), '/?from=legacy')

    const fallback = await fetch(`${base}/a-route-that-was-never-prerendered`)
    assert.equal(fallback.status, 200)
    assert.match(fallback.headers.get('content-type'), /^text\/html/)
    assert.match(await fallback.text(), /<title>Studio shell<\/title>/)

    const signin = await fetch(`${base}/signin`, { redirect: 'manual' })
    assert.equal(signin.status, 301)
    assert.equal(signin.headers.get('location'), '/studio')

    const studio = await fetch(`${base}/dashboard/ai-video/home?project=saved`, { redirect: 'manual' })
    assert.equal(studio.status, 301)
    assert.equal(studio.headers.get('location'), '/studio?project=saved')

    const localeStudio = await fetch(`${base}/ja/dashboard/ai-video/home`, { redirect: 'manual' })
    assert.equal(localeStudio.status, 301)
    assert.equal(localeStudio.headers.get('location'), '/studio')

    const localeDesktop = await fetch(`${base}/de/desktop`, { redirect: 'manual' })
    assert.equal(localeDesktop.status, 301)
    assert.equal(localeDesktop.headers.get('location'), '/studio')

    const desktop = await fetch(`${base}/desktop?from=app`, { redirect: 'manual' })
    assert.equal(desktop.status, 301)
    assert.equal(desktop.headers.get('location'), '/studio?from=app')

    const retired = await fetch(`${base}/pricing`, { redirect: 'manual' })
    assert.equal(retired.status, 301)
    assert.equal(retired.headers.get('location'), '/studio')

    const missingAsset = await fetch(`${base}/_nuxt/missing.js`)
    assert.equal(missingAsset.status, 404)
  } finally {
    server.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('npm start applies the same legacy redirects as production', async () => {
  assert.equal(legacyRedirectTarget('/shotboard/studio'), '/studio')
  assert.equal(legacyRedirectTarget('/tr/terms'), '/terms')
  assert.equal(legacyRedirectTarget('/ru'), '/')
  assert.equal(legacyRedirectTarget('/studio'), '')
  const server = createVisitServer({ store: {}, staticRoot: mkdtempSync(join(tmpdir(), 'moovicut-start-')) })
  const base = await listen(server)
  try {
    const moved = await fetch(`${base}/shotboard/faq?ref=old`, { redirect: 'manual' })
    assert.equal(moved.status, 301)
    assert.equal(moved.headers.get('location'), '/faq?ref=old')
    const home = await fetch(`${base}/dashboard/ai-video/home`, { redirect: 'manual' })
    assert.equal(home.status, 301)
    assert.equal(home.headers.get('location'), '/studio')
    const oldDesktop = await fetch(`${base}/shotboard/desktop`, { redirect: 'manual' })
    assert.equal(oldDesktop.status, 301)
    assert.equal(oldDesktop.headers.get('location'), '/studio')
  } finally {
    server.close()
  }
})

test('PWA manifest start_url, scope, and icons are at the site root', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
  assert.equal(manifest.id, '/')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.ok(manifest.icons.length >= 4)
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\/[^/].+\.png$/)
    assert.equal(existsSync(`public${icon.src}`), true, icon.src)
  }
  assert.doesNotMatch(JSON.stringify(manifest), /shotboard/)
  assert.match(readFileSync('railway.json', 'utf8'), /NUXT_APP_BASE_URL=\//)
  assert.match(readFileSync('railway.json', 'utf8'), /node server\/prod-server\.mjs/)
  assert.match(readFileSync('nuxt.config.ts', 'utf8'), /NUXT_APP_BASE_URL \|\| '\/'/)
})
