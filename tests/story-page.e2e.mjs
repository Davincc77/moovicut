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

// An idea (one short paragraph) is the Studio's job; a story is 600..8000 characters.
const IDEA = 'A baker in Lisbon discovers her sourdough starter glows at midnight. She carries it down to the Tagus. The river answers with light.'
const STORY = IDEA + ' Marta kneels on the wet stones and lifts the jar toward the water. The glow climbs her wrists and pulls the tide in slow rings around her boots. A ferryman on the far quay lowers his lantern and watches without a word. By dawn the starter has gone quiet and the river is only a river, but the bread she bakes that morning rises faster than any loaf in the city. She never tells anyone, and every midnight afterwards she walks down to the Tagus with the jar. The ferryman still raises his lantern each time, and the river still answers.'
assert.ok(STORY.length >= 600, `STORY fixture must be a real story: ${STORY.length}`)

const browser = await chromium.launch()
const page = await browser.newPage({ bypassCSP: true, viewport: { width: 1280, height: 900 } })

// 1) page existe, bouton inactif sans texte
await page.goto(`${base}/story`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#story-input')
assert.equal(await page.locator('button:has-text("Show my draft")').isDisabled(), true, 'draft button must start disabled')

// 1b) minimum 600 : compteur, idee -> hand-off Studio, remplissage inutile, pas de troncature
const countText = async () => (await page.locator('#story-count').innerText()).replace(/\s+/g, ' ').trim()
assert.match(await countText(), /^0 of 600 characters minimum$/, 'empty counter')
assert.equal(await page.locator('.story-notice').count(), 0, 'no notice on an empty box')
await page.fill('#story-input', IDEA)
assert.match(await countText(), new RegExp(`^${IDEA.length} of 600 characters minimum$`), 'idea counter')
assert.equal(await page.locator('button:has-text("Show my draft")').isDisabled(), true, 'an idea cannot build a story draft')
assert.ok(await page.locator('.story-notice').innerText().then(text => /idea, not a story/i.test(text)), 'idea notice')
await page.fill('#story-input', IDEA + ' '.repeat(900) + '\n'.repeat(900))
assert.equal(await page.locator('button:has-text("Show my draft")').isDisabled(), true, 'padding must not buy length')
await page.fill('#story-input', IDEA)
await page.click('button:has-text("Send to the Studio")')
await page.waitForSelector('#wizard-idea', { timeout: 15000 })
assert.equal((await page.inputValue('#wizard-idea')).trim(), IDEA, 'the idea reaches the Studio untouched')
await page.goto(`${base}/story`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#story-input')
const book = ('The tide came in over the harbour wall and the gulls complained. ').repeat(130)
await page.fill('#story-input', book)
assert.ok((await page.inputValue('#story-input')).length > 8000, 'a pasted book is not silently truncated')
assert.equal(await page.locator('button:has-text("Show my draft")').isDisabled(), true, 'over 8000 cannot build')
assert.ok((await page.locator('.story-notice a[href$="/long"], .story-notice a[href$="/long/"]').count()) === 1, 'a book is sent to the Author project')
await page.fill('#story-input', '')

// 2) collage -> brouillon avec badges, source et couverture
await page.fill('#story-input', STORY)
assert.match(await countText(), /^\d+ characters$/, 'in-range counter')
assert.equal(await page.locator('.story-notice').count(), 0, 'no notice once the story is in range')
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
