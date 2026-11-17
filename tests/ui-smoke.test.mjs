import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, devices } from 'playwright'
import { createProdServer } from '../server/prod-server.mjs'

const PATHS = ['/', '/studio', '/faq', '/agents', '/credits', '/readme', '/skill', '/privacy', '/terms', '/content-policy']
const IGNORED = /cloudflareinsights|beacon\.min|favicon|Download the Vue Devtools|Failed to register a ServiceWorker|service worker|Failed to load resource|net::ERR_|status of 429/i
let origin = 'http://127.0.0.1'

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolveListen(`http://127.0.0.1:${server.address().port}`))
  })
}

async function launch() {
  const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
  try { return await chromium.launch({ ...options, channel: 'chrome' }) } catch { return await chromium.launch(options) }
}

async function fillFields(page) {
  const fields = page.locator('input:visible, textarea:visible, select:visible')
  const count = await fields.count()
  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index)
    if (!(await field.isEnabled().catch(() => false))) continue
    const kind = await field.evaluate(element => element.tagName === 'SELECT' ? 'select' : (element.getAttribute('type') || element.tagName.toLowerCase()))
    if (kind === 'hidden' || kind === 'file' || kind === 'submit' || kind === 'button') continue
    if (kind === 'radio') {
      if (await field.isChecked()) continue
      await field.check()
      assert.equal(await field.isChecked(), true, 'radio did not select')
      continue
    }
    if (kind === 'checkbox') {
      const before = await field.isChecked()
      await field.click()
      assert.notEqual(await field.isChecked(), before, 'checkbox did not toggle')
      continue
    }
    if (kind === 'select') {
      const next = await field.evaluate(element => {
        const option = [...element.options].find(item => item.value && item.value !== element.value)
        return option ? option.value : ''
      })
      if (!next) continue
      await field.selectOption(next)
      assert.equal(await field.inputValue(), next, 'select did not change')
      continue
    }
    if (kind === 'number') {
      await field.fill('4')
      assert.equal(await field.inputValue(), '4', 'number field did not keep its value')
      continue
    }
    const sample = kind === 'search' ? 'quay' : 'A lighthouse keeper races the dusk to repair the beacon.'
    await field.fill(sample)
    const value = await field.inputValue()
    assert.equal(value.includes(kind === 'search' ? 'quay' : 'lighthouse'), true, `field did not keep typed text (${kind})`)
  }
}

async function clickButtons(page) {
  page.on('filechooser', chooser => { chooser.setFiles([]).catch(() => {}) })
  const buttons = page.locator('button')
  const count = await buttons.count()
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index)
    if (!(await button.isVisible().catch(() => false))) continue
    const label = ((await button.getAttribute('aria-label')) || (await button.innerText()) || `button ${index}`).replace(/\s+/g, ' ').trim()
    if (await button.isDisabled().catch(() => false)) {
      const cursor = await button.evaluate(element => getComputedStyle(element).cursor)
      assert.notEqual(cursor, 'wait', `disabled "${label}" still uses cursor wait`)
      assert.equal(cursor, 'not-allowed', `disabled "${label}" cursor is ${cursor}`)
      continue
    }
    try {
      await button.click({ timeout: 1500 })
    } catch (error) {
      if (await page.locator('[role="dialog"], .modal-backdrop').count()) {
        await page.keyboard.press('Escape')
        continue
      }
      throw new Error(`"${label}" did not respond: ${error.message.split('\n')[0]}`)
    }
    if (await page.locator('.modal-panel').count()) {
      const background = await page.locator('.modal-panel').first().evaluate(element => getComputedStyle(element).backgroundColor)
      assert.notEqual(background, 'rgba(0, 0, 0, 0)', `${label} opened a transparent modal`)
      const inside = page.locator('.modal-panel button')
      const insideCount = await inside.count()
      for (let inner = 0; inner < insideCount; inner += 1) {
        const item = inside.nth(inner)
        if (!(await item.isVisible().catch(() => false)) || await item.isDisabled().catch(() => true)) continue
        await item.click({ timeout: 1500 }).catch(() => {})
      }
      await page.keyboard.press('Escape')
    }
  }
}

async function checkStudio(page, lang) {
  await page.goto(`${origin}/studio${lang}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#wizard-idea')
  const theme = page.locator('.theme-toggle')
  const before = await theme.getAttribute('aria-pressed')
  await theme.click()
  assert.notEqual(await theme.getAttribute('aria-pressed'), before, 'dark mode toggle did not change')
  await page.locator('#wizard-idea').fill('Short')
  await page.getByRole('button', { name: /^(Next|Seguinte)$/ }).click()
  const focused = await page.evaluate(() => document.activeElement?.id || '')
  const errors = await page.locator('.wizard-error').count()
  assert.ok(focused === 'wizard-idea' || errors > 0, 'Next did not show the missing idea')
  await page.getByRole('button', { name: /my projects|meus projetos/i }).first().click()
  await page.waitForSelector('.modal-panel')
  const background = await page.locator('.modal-panel').evaluate(element => getComputedStyle(element).backgroundColor)
  assert.notEqual(background, 'rgba(0, 0, 0, 0)')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /export json|exportar json/i }).click()
  const file = await download
  const path = await file.path()
  const text = path ? readFileSync(path, 'utf8') : ''
  assert.doesNotMatch(text, /\[object Object\]/)
  assert.match(text, /"schema"/)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.modal-panel'))
}

async function checkLinks(page) {
  const hrefs = await page.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href') || ''))
  assert.ok(hrefs.includes('#main-content') || hrefs.some(href => href.endsWith('#main-content')))
  assert.equal(await page.locator('#main-content').count(), 1)
  const origin = new URL(page.url()).origin
  const seen = new Set()
  for (const href of hrefs) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
      assert.notEqual(href, 'javascript:void(0)')
      continue
    }
    const absolute = new URL(href, page.url())
    if (absolute.origin !== origin || seen.has(absolute.pathname)) continue
    seen.add(absolute.pathname)
    const response = await page.request.get(absolute.toString())
    assert.ok(response.status() < 400, `${absolute.pathname} returned ${response.status()}`)
  }
}

test('every page responds in English and Portuguese on desktop and a phone', { timeout: 600000 }, async () => {
  const generated = spawnSync('npx', ['nuxt', 'generate'], {
    cwd: process.cwd(),
    env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8'
  })
  if (generated.status !== 0) {
    console.error(generated.stdout)
    console.error(generated.stderr)
  }
  assert.equal(generated.status, 0, 'nuxt generate failed')
  const server = createProdServer({ staticRoot: resolve('.output/public') })
  origin = await listen(server)
  let browser
  try {
    browser = await launch()
    const english = await browser.newPage()
    const errors = []
    english.on('pageerror', error => errors.push(String(error)))
    english.on('console', message => { if (message.type() === 'error' && !IGNORED.test(message.text())) errors.push(message.text()) })
    const moved = await english.goto(origin + '/en', { waitUntil: 'domcontentloaded' })
    assert.equal(new URL(english.url()).pathname, '/')
    assert.ok(!moved || moved.status() < 400)
    await english.waitForSelector('#main-content')
    await english.evaluate(() => {
      const event = new Event('beforeinstallprompt')
      event.prompt = () => Promise.resolve()
      window.dispatchEvent(event)
    })
    const install = english.getByRole('button', { name: /install/i })
    await install.click()
    await english.close()

    const viewports = [
      { name: 'desktop', context: { viewport: { width: 1280, height: 800 } } },
      { name: 'phone', context: { ...devices['iPhone 13'] } }
    ]
    for (const viewport of viewports) {
      for (const lang of ['', '?lang=pt']) {
        const context = await browser.newContext(viewport.context)
        const page = await context.newPage()
        const problems = []
        page.on('pageerror', error => problems.push(String(error)))
        page.on('console', message => { if (message.type() === 'error' && !IGNORED.test(message.text())) problems.push(message.text()) })
        for (const path of PATHS) {
          await page.goto(origin + path + lang, { waitUntil: 'domcontentloaded' })
          await page.waitForSelector('#main-content')
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
          assert.ok(overflow <= 1, `${viewport.name} ${path} ${lang} overflows by ${overflow}px`)
          if (path === '/studio' && viewport.name === 'desktop') await checkStudio(page, lang)
          await fillFields(page)
          await clickButtons(page)
          await page.goto(origin + path + lang, { waitUntil: 'domcontentloaded' })
          await checkLinks(page)
          if (path === '/privacy' || path === '/terms' || path === '/content-policy') {
            const back = page.getByRole('link', { name: /back to the studio|voltar ao estúdio/i })
            await back.click()
            await page.waitForURL(url => new URL(url).pathname === '/studio')
          }
        }
        assert.deepEqual(problems, [], `${viewport.name} ${lang} console errors`)
        await context.close()
      }
    }
    assert.deepEqual(errors, [])
  } finally {
    if (browser) await browser.close()
    await new Promise(resolveClose => server.close(resolveClose))
  }
})
