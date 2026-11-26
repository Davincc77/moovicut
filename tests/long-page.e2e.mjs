/** /long : page Moovicut Long — rendu, formulaire waitlist contre le vrai store. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extname, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'
import { createWaitlistStore } from '../server/waitlist.mjs'

const { chromium } = playwright
const root = new URL('../.output/public/', import.meta.url)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

const waitlistFile = join(mkdtempSync(join(tmpdir(), 'long-e2e-')), 'long-waitlist.json')
const waitlist = createWaitlistStore({ filePath: waitlistFile, perMinute: 5 })

function fileFor (urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0])
  const relative = normalize(clean).replace(/^(\.\.[/\\])+/, '')
  const path = join(root.pathname, relative)
  return extname(path) ? path : join(path, 'index.html')
}

const server = createServer(async (request, response) => {
  if (request.url === '/api/long/waitlist' && request.method === 'POST') {
    let text = ''
    for await (const chunk of request) text += chunk
    const parsed = waitlist.parseBody(text)
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    if (parsed.status) { response.writeHead(parsed.status, headers); response.end(JSON.stringify({ error: 'invalid_json' })); return }
    const result = await waitlist.add(parsed.email, parsed.website)
    response.writeHead(result.ok ? 200 : result.status, headers)
    response.end(JSON.stringify(result.ok ? { ok: true, duplicate: result.duplicate } : { error: result.status === 429 ? 'rate_limited' : 'invalid_email' }))
    return
  }
  try {
    const body = await readFile(fileFor(request.url))
    response.writeHead(200, { 'content-type': types[extname(fileFor(request.url))] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ bypassCSP: true })
  await page.goto(`${base}/long/`, { waitUntil: 'networkidle' })

  const h1 = await page.locator('h1').first().innerText()
  assert.match(h1, /whole novel/i, `h1: ${h1}`)
  assert.ok((await page.locator('text=How it works').count()) >= 1)
  assert.ok((await page.locator('text=Early access').count()) >= 1)

  // empty submit -> named reason, focus back on the field, and NOT a byte on the wire
  let waitlistCalls = 0
  page.on('request', r => { if (r.url().endsWith('/api/long/waitlist')) waitlistCalls++ })
  await page.click('button[type=submit]')
  await page.waitForSelector('p[role=alert]', { timeout: 5000 })
  assert.equal((await page.locator('p[role=alert]').innerText()).trim(), 'Enter your email first.')
  assert.equal(waitlistCalls, 0, 'the client-side gate must not reach the server')
  assert.ok(await page.evaluate(() => document.activeElement?.id === 'long-email'), 'focus goes back to the field')

  // invalid email -> inline error, store untouched
  await page.fill('#long-email', 'not-an-email')
  await page.click('button[type=submit]')
  await page.waitForSelector('p[role=alert]', { timeout: 5000 })
  const err = await page.locator('p[role=alert]').innerText()
  assert.match(err, /email/i, `error: ${err}`)
  assert.equal(waitlist.total(), 0)

  // valid email -> confirmation + store contains it
  await page.fill('#long-email', 'writer@example.com')
  await page.click('button[type=submit]')
  await page.waitForSelector('p.long-ok', { timeout: 5000 })
  const ok = await page.locator('p.long-ok').innerText()
  assert.match(ok, /on the list/i, `ok: ${ok}`)
  assert.deepEqual(waitlist.total(), 1)
  const raw = JSON.parse(await readFile(waitlistFile, 'utf8'))
  assert.deepEqual(raw.emails, ['writer@example.com'])

  // link to the free demo exists
  assert.ok((await page.locator('a:has-text("free story demo")').count()) >= 1)

  // PT locale serves too
  const pt = await browser.newPage({ bypassCSP: true })
  await pt.goto(`${base}/long/?lang=pt`, { waitUntil: 'networkidle' })
  const h1pt = await pt.locator('h1').first().innerText()
  assert.match(h1pt, /romance|romance|romanc|roman/i, `pt h1: ${h1pt}`)
  await pt.close()
} finally {
  await browser.close()
  server.close()
}
console.log('long-page e2e ok')
