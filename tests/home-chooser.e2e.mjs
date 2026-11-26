/** Home chooser on the built site: three doors, whole-card links, stacked on small screens, playground behind door 1. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'

const { chromium } = playwright
const root = new URL('../.output/public/', import.meta.url)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
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
  } catch { response.writeHead(404); response.end('missing') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
const cards = page => page.locator('.mode-card')
const rects = page => page.evaluate(() => [...document.querySelectorAll('.mode-card')].map(card => { const r = card.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left), width: Math.round(r.width) } }))
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

try {
  // 1) desktop: the question, three doors in order, links to the right pages, composer gone
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await desktop.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await desktop.waitForSelector('.mode-card')
  assert.equal((await desktop.locator('h1').innerText()).trim(), 'What are you making?')
  assert.deepEqual((await cards(desktop).locator('h2').allInnerTexts()).map(text => text.trim()), ['I have an idea', 'I have a story', 'I’m writing a book'])
  const hrefs = await cards(desktop).locator('a.mode-cta').evaluateAll(links => links.map(link => new URL(link.href).pathname.replace(/\/$/, '')))
  assert.deepEqual(hrefs, ['/playground', '/story', '/long'])
  assert.equal(await desktop.locator('#hero-premise').count(), 0, 'the composer lives in the playground now')
  const row = await rects(desktop)
  assert.equal(new Set(row.map(card => card.top)).size, 1, `three cards share one row at 1280: ${JSON.stringify(row)}`)
  const ticks = (await desktop.locator('.mode-ruler-ticks').innerText()).replace(/\s+/g, ' ')
  assert.match(ticks, /Idea · under 600 characters/)
  assert.match(ticks, /Story · 600 – 8,000/)
  assert.match(ticks, /Book · over 8,000 characters/)
  assert.ok((await overflow(desktop)) <= 1, 'no horizontal overflow at 1280')

  // 2) the whole card is the link (stretched), not only the button
  // force: the stretched ::after of the CTA sits on top of the text, which is the point; Playwright flags that as interception
await desktop.locator('.mode-card[data-mode="story"] .mode-text').click({ force: true })
  await desktop.waitForURL(/\/story\/?$/)
  assert.match(await desktop.locator('#story-count').innerText(), /0 of 600/, 'the story door opens the 600-character page')

  // 3) door 1 -> playground: composer, studio way-out, wrong-door strip, Studio marked in the header
  await desktop.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await desktop.waitForSelector('.mode-card')
  await desktop.locator('.mode-card[data-mode="studio"] a.mode-cta').click()
  await desktop.waitForURL(/\/playground\/?$/)
  await desktop.waitForSelector('#hero-premise')
  assert.deepEqual((await desktop.locator('.site-nav-links .mode-switch a[aria-current="page"]').allInnerTexts()).map(text => text.trim()), ['Studio'], 'Studio is marked on the playground')
  assert.ok(await desktop.getByRole('link', { name: /Already working on a project\? Open the Studio/ }).count() >= 1, 'way out to the full workspace')
  assert.ok(await desktop.locator('#wrong-door-title').count() === 1, 'not-the-right-size strip')
  assert.equal(await desktop.locator('.wrong-door a[href$="/story"], .wrong-door a[href$="/story/"]').count(), 1)
  assert.equal(await desktop.locator('.wrong-door a[href$="/long"], .wrong-door a[href$="/long/"]').count(), 1)
  assert.match(await desktop.title(), /I have an idea/)
  // footer: Studio goes to the playground as well
  const footerHref = await desktop.locator('footer.site-footer a', { hasText: /^Studio$/ }).first().getAttribute('href')
  assert.match(footerHref, /\/playground\/?$/)

  // 4) tablet and phone: one column, nothing overflows, touch targets
  for (const [name, width] of [['tablet', 820], ['phone', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 })
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.mode-card')
    const stack = await rects(page)
    assert.equal(new Set(stack.map(card => card.left)).size, 1, `${name}: cards share a left edge`)
    assert.deepEqual([...stack].map(card => card.top), [...stack].map(card => card.top).sort((a, b) => a - b), `${name}: stacked in order`)
    assert.ok(new Set(stack.map(card => card.top)).size === 3, `${name}: one card per row`)
    assert.ok((await overflow(page)) <= 1, `${name}: no horizontal overflow (${await overflow(page)}px)`)
    const heights = await page.locator('a.mode-cta').evaluateAll(links => links.map(link => Math.round(link.getBoundingClientRect().height)))
    assert.ok(heights.every(height => height >= 40), `${name}: CTA height ${heights}`)
    await page.close()
  }

  // 5) Portuguese
  const pt = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await pt.goto(`${base}/?lang=pt`, { waitUntil: 'domcontentloaded' })
  await pt.waitForSelector('.mode-card')
  assert.equal((await pt.locator('h1').innerText()).trim(), 'O que você está criando?')
  assert.deepEqual((await pt.locator('.mode-card h2').allInnerTexts()).map(text => text.trim()), ['Tenho uma ideia', 'Tenho uma história', 'Estou escrevendo um livro'])
} finally {
  await browser.close()
  server.close()
}
console.log('home chooser e2e: OK')
process.exit(0)
