/** /story : coller une histoire -> brouillon avec provenance -> continuer au studio. */
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

const STORY = 'A baker in Lisbon discovers her sourdough starter glows at midnight. She carries it down to the Tagus. The river answers with light.'

const browser = await chromium.launch()
const page = await browser.newPage({ bypassCSP: true, viewport: { width: 1280, height: 900 } })

// 1) page existe, bouton inactif sans texte
await page.goto(`${base}/story`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#story-input')
assert.equal(await page.locator('button:has-text("Show my draft")').isDisabled(), true, 'draft button must start disabled')

// 2) collage -> brouillon avec badges, source et couverture
await page.fill('#story-input', STORY)
await page.click('button:has-text("Show my draft")')
await page.waitForSelector('.story-shot', { timeout: 15000 })
const shots = await page.locator('.story-shot').count()
assert.ok(shots >= 1, `story shots rendered: ${shots}`)
assert.match(await page.locator('.story-coverage').innerText(), /of \d+ shots come from your story/i, 'coverage line')
assert.ok(await page.locator('.story-badge', { hasText: 'From your story' }).count() >= 1, 'extracted badge rendered')
assert.ok(await page.locator('.story-shot-source').first().innerText(), 'source sentence quoted')
assert.match(await page.locator('.story-shot-prompt').first().innerText(), /SHOT:/, 'prompt block rendered')

// 3) continuer au studio : handoff prefille le wizard
await page.click('button:has-text("Continue in the Studio")')
await page.waitForSelector('#wizard-idea', { timeout: 15000 })
assert.equal((await page.inputValue('#wizard-idea')).trim().length, STORY.length, 'wizard idea prefilled from /story handoff')

// 4) lien present depuis l'accueil
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
assert.ok(await page.locator('footer a[href$="/story/"], a[href$="/story"]').count() >= 1, 'footer links to /story')

// 5) langue : pt
await page.goto(`${base}/story?lang=pt`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#story-input')
assert.ok(await page.locator('button:has-text("Ver meu rascunho")').count() === 1, 'pt label on draft button')

await browser.close()
server.close()
console.log('story page e2e: OK')
process.exit(0)
