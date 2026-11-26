/** Three modes in the header: Studio / Short story / Author. Rendered behaviour on the built site. */
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
  } catch {
    response.writeHead(404)
    response.end('missing')
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()

const MODES = ['Studio', 'Short story', 'Author']
const modeTexts = page => page.locator('.site-nav-links .mode-switch a').allInnerTexts()
const activeTexts = page => page.locator('.site-nav-links .mode-switch a[aria-current="page"]').allInnerTexts()

try {
  // 1) desktop: three modes, the current one is marked, nothing else is
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await desktop.goto(`${base}/story`, { waitUntil: 'domcontentloaded' })
  await desktop.waitForSelector('.site-nav-links .mode-switch')
  assert.deepEqual((await modeTexts(desktop)).map(text => text.trim()), MODES, 'three modes in size order')
  assert.deepEqual((await activeTexts(desktop)).map(text => text.trim()), ['Short story'], '/story marks Short story')
  assert.equal(await desktop.locator('.site-nav-links .mode-switch a').first().evaluate(link => link.getBoundingClientRect().height >= 40), true, 'touch target >= 40px')

  await desktop.getByRole('link', { name: 'Author', exact: true }).first().click()
  await desktop.waitForURL(/\/long\/?$/)
  assert.deepEqual((await activeTexts(desktop)).map(text => text.trim()), ['Author'], 'switching moves the mark to /long')
  assert.match(await desktop.locator('main .eyebrow').first().innerText(), /Author/, 'the /long eyebrow uses the nav name')

  await desktop.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await desktop.waitForSelector('.site-nav-links .mode-switch')
  assert.deepEqual(await activeTexts(desktop), [], 'no mode is marked on the home page')

  await desktop.goto(`${base}/story`, { waitUntil: 'domcontentloaded' })
  await desktop.waitForSelector('main .eyebrow')
  assert.equal((await desktop.locator('main .eyebrow').first().innerText()).trim(), 'Short story', 'the /story eyebrow uses the nav name')

  // footer: same names, the old ambiguous label is gone
  const footerText = (await desktop.locator('footer.site-footer').innerText())
  assert.match(footerText, /Short story/)
  assert.match(footerText, /Author/)
  assert.doesNotMatch(footerText, /For authors/)

  // 2) the header never overflows: full bar from 1024px, burger below (modes first inside)
  for (const width of [768, 820, 1023, 1024, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    for (const path of ['/', '/story', '/long']) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.site-header')
      const m = await page.evaluate(() => {
        const visible = [...document.querySelectorAll('.site-header a, .site-header button, .site-header select')].filter(el => el.getClientRects().length)
        const mode = document.querySelector('.site-nav-links .mode-switch a')
        const inner = document.querySelector('.header-inner')
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          innerOverflow: inner.scrollWidth - inner.clientWidth,
          rightmost: Math.round(Math.max(...visible.map(el => el.getBoundingClientRect().right))),
          vw: document.documentElement.clientWidth,
          headerHeight: Math.round(document.querySelector('.site-header').getBoundingClientRect().height),
          fullBar: !!(document.querySelector('.site-nav-links') && document.querySelector('.site-nav-links').getClientRects().length),
          burger: !!(document.querySelector('.nav-menu-button') && document.querySelector('.nav-menu-button').getClientRects().length),
          modeHeight: mode && mode.getClientRects().length ? Math.round(mode.getBoundingClientRect().height) : 0
        }
      })
      assert.ok(m.overflow <= 1, `${width}px ${path}: document overflows by ${m.overflow}px`)
      assert.ok(m.innerOverflow <= 1, `${width}px ${path}: header content overflows by ${m.innerOverflow}px`)
      assert.ok(m.rightmost <= m.vw, `${width}px ${path}: a header control is pushed off-screen (right edge ${m.rightmost} > ${m.vw})`)
      assert.ok(m.headerHeight <= 66, `${width}px ${path}: header grew to ${m.headerHeight}px (64px + 1px border expected)`)
      assert.equal(m.fullBar, width >= 1024, `${width}px ${path}: full bar visibility`)
      assert.equal(m.burger, width < 1024, `${width}px ${path}: burger visibility`)
      if (width >= 1024) assert.ok(m.modeHeight >= 40 && m.modeHeight <= 48, `${width}px ${path}: mode link height ${m.modeHeight}`)
    }
    await page.close()
  }

  // 3) phone: the burger menu leads with the three modes
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await phone.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await phone.waitForSelector('.nav-menu-button')
  await phone.click('.nav-menu-button')
  await phone.waitForSelector('.site-nav-menu')
  const items = (await phone.locator('.site-nav-menu a').allInnerTexts()).map(text => text.trim())
  assert.deepEqual(items.slice(0, 3), MODES, `phone menu starts with the modes: ${items.join(' | ')}`)
  assert.equal(await phone.locator('.site-nav-menu .menu-sep').count(), 1, 'a separator sits between the modes and the rest')
  await phone.getByRole('link', { name: 'Short story', exact: true }).first().click()
  await phone.waitForURL(/\/story\/?$/)
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, true, 'no horizontal overflow on the phone')

  // 4) the Studio workspace dropdown offers the same three modes
  const studio = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await studio.goto(`${base}/studio`, { waitUntil: 'domcontentloaded' })
  await studio.waitForSelector('.workspace-nav-button')
  await studio.click('.workspace-nav-button')
  await studio.waitForSelector('.studio-nav-menu')
  const workspaceItems = (await studio.locator('.studio-nav-menu a').allInnerTexts()).map(text => text.trim())
  assert.deepEqual(workspaceItems.slice(0, 3), MODES, `studio dropdown starts with the modes: ${workspaceItems.join(' | ')}`)

  // 5) Portuguese labels
  const pt = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await pt.goto(`${base}/story?lang=pt`, { waitUntil: 'domcontentloaded' })
  await pt.waitForSelector('.site-nav-links .mode-switch')
  assert.deepEqual((await modeTexts(pt)).map(text => text.trim()), ['Studio', 'Conto', 'Autor'], 'pt names')
} finally {
  await browser.close()
  server.close()
}
console.log('mode switch e2e: OK')
process.exit(0)
