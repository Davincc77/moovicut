/**
 * The home page "Use this prompt" button must reach the visible creation pane.
 * Regression: the handoff was taken at page creation by the hidden advanced
 * panel (v-show mounts both panes), leaving the guided wizard blank.
 * Serves .output/public. Run after `npm run build`.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'

const { chromium } = playwright
const root = new URL('../.output/public/', import.meta.url)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

function fileFor(urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0])
  const relative = normalize(clean).replace(/^(\.\.[/\\])+/, '')
  const path = join(root.pathname, relative)
  return extname(path) ? path : join(path, 'index.html')
}

const server = createServer(async (request, response) => {
  try {
    const body = await readFile(fileFor(request.url))
    response.writeHead(200, { 'content-type': types[extname(fileFor(request.url))] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('missing')
  }
})

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`

const LAB = 'Scientists debate in a dark robotics lab, overhead fluorescent lighting, tense atmosphere.'
const CLIMB = 'A soldier scales a collapsing scaffold, dust and debris falling, dutch-angle camera.'

const browser = await chromium.launch()
try {
  // guided (the default experience): the wizard idea must carry the study premise
  const guided = await browser.newPage({ bypassCSP: true, viewport: { width: 1280, height: 900 } })
  await guided.addInitScript(() => { localStorage.clear(); sessionStorage.clear() })
  await guided.goto(`${base}/playground`, { waitUntil: 'domcontentloaded' })
  await guided.locator('.study-card', { hasText: 'The Lab' }).getByRole('button', { name: /Use this prompt/i }).click()
  await guided.locator('#wizard-idea').waitFor()
  await guided.waitForFunction(() => document.getElementById('wizard-idea')?.value.length > 0, null, { timeout: 5000 })
  assert.equal(await guided.locator('#wizard-idea').inputValue(), LAB, 'guided wizard prefilled')

  // a second visit with another card must re-take the handoff, not replay the first
  await guided.goto(`${base}/playground`, { waitUntil: 'domcontentloaded' })
  await guided.locator('.study-card', { hasText: 'The Climb' }).getByRole('button', { name: /Use this prompt/i }).click()
  await guided.locator('#wizard-idea').waitFor()
  await guided.waitForFunction(id => document.getElementById(id)?.value.includes('collapsing scaffold'), 'wizard-idea', { timeout: 5000 })
  assert.match(await guided.locator('#wizard-idea').inputValue(), /collapsing scaffold/, 'second handoff wins')
  await guided.close()

  // advanced experience (persisted): the panel must show the same prefill
  const advanced = await browser.newPage({ bypassCSP: true, viewport: { width: 1280, height: 900 } })
  await advanced.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('moovicut.studio.experience', 'advanced') })
  await advanced.goto(`${base}/playground`, { waitUntil: 'domcontentloaded' })
  await advanced.locator('.study-card', { hasText: 'The Lab' }).getByRole('button', { name: /Use this prompt/i }).click()
  await advanced.locator('#studio-idea').waitFor()
  await advanced.waitForFunction(() => document.getElementById('studio-idea')?.value.length > 0, null, { timeout: 5000 })
  assert.equal(await advanced.locator('#studio-idea').inputValue(), LAB, 'advanced panel prefilled')

  // hero form submit keeps its documented behaviour: premise travels too
  const hero = await browser.newPage({ bypassCSP: true, viewport: { width: 1280, height: 900 } })
  await hero.addInitScript(() => { localStorage.clear(); sessionStorage.clear() })
  await hero.goto(`${base}/playground`, { waitUntil: 'domcontentloaded' })
  await hero.locator('#hero-premise').fill(CLIMB)
  await hero.locator('.premise-composer button[type=submit]').click()
  await hero.locator('#wizard-idea').waitFor()
  await hero.waitForFunction(() => document.getElementById('wizard-idea')?.value.includes('collapsing scaffold'), null, { timeout: 5000 })
  assert.match(await hero.locator('#wizard-idea').inputValue(), /collapsing scaffold/, 'hero premise travels')
  await hero.close()
  await advanced.close()
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
console.log('studio handoff e2e: OK')
