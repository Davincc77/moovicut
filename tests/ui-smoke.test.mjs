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
  // Indexes belong to this document. A client navigation (Create storyboard) reuses the
  // same index for a control on the next page, including the desktop-hidden workspace button.
  const pageUrl = page.url()
  for (let index = 0; index < count; index += 1) {
    if (page.url() !== pageUrl) break
    const button = buttons.nth(index)
    if (!(await button.isVisible().catch(() => false))) continue
    if (page.url() !== pageUrl) break
    const label = ((await button.getAttribute('aria-label')) || (await button.innerText()) || `button ${index}`).replace(/\s+/g, ' ').trim()
    if (page.url() !== pageUrl) break
    if (!(await button.isVisible().catch(() => false))) continue
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
      if (page.url() !== pageUrl) break
      if (!(await button.isVisible().catch(() => false))) continue
      throw new Error(`"${label}" did not respond: ${error.message.split('\n')[0]}`)
    }
    if (page.url() !== pageUrl) break
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

const STEP_LABELS = {
  en: ['1. Idea', '2. Characters', '3. Places and style', '4. Shots', '5. Check', '6. Generate'],
  pt: ['1. Ideia', '2. Personagens', '3. Lugares e estilo', '4. Planos', '5. Verificar', '6. Gerar']
}

async function openGuidedStudio(page, lang) {
  await page.goto(`${origin}/studio${lang}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.removeItem('moovicut.studio.experience')
    localStorage.removeItem('moovicut.wizard.v1')
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#wizard-idea')
}

async function checkSimpleGuide(page, lang) {
  const code = lang.includes('pt') ? 'pt' : 'en'
  await openGuidedStudio(page, lang)
  await page.waitForSelector('.wizard-steps button')
  const steps = page.locator('.wizard-steps button')
  assert.equal(await steps.count(), 6)
  for (let index = 0; index < 6; index += 1) {
    assert.equal((await steps.nth(index).innerText()).replace(/\s+/g, ' ').trim(), STEP_LABELS[code][index])
  }
  await page.locator('#wizard-idea').fill('Fog rolls across an empty city street at dusk.')
  await page.getByRole('button', { name: /^(Next|Seguinte)(?::|$)/ }).click()
  await page.waitForSelector('#wizard-no-character')
  const skip = page.locator('#wizard-no-character')
  await skip.scrollIntoViewIfNeeded()
  const box = await skip.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(box && box.width >= 120 && box.height >= 40, 'No character button is not visible')
  assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 2, 'No character button is off the side of the screen')
  assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 2, 'No character button is outside the viewport')
  assert.equal((await skip.innerText()).trim(), code === 'pt' ? 'Sem personagem' : 'No character')
  await skip.click()
  assert.equal(await skip.getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: /^(Next|Seguinte)(?::|$)/ }).click()
  await page.waitForFunction(() => /^3\./.test(document.getElementById('wizard-step-heading')?.textContent || ''))
  assert.equal(await page.getByText(/Add at least one character|Adicione pelo menos uma personagem/).count(), 0)
  await page.locator('#place-1-name').fill('Empty city')
  await page.locator('#place-1-description').fill('a wide empty street')
  await page.locator('#wizard-light').selectOption('dusk')
  await page.locator('#wizard-mood').selectOption('quiet')
  await page.getByRole('button', { name: /^(Next|Seguinte)(?::|$)/ }).click()
  await page.waitForSelector('#shot-1-action')
  await page.locator('#shot-1-place').selectOption({ index: 1 })
  await page.locator('#shot-1-action').fill('Fog rolls across the empty street')
  await page.locator('#shot-1-framing').selectOption('wide')
  await page.getByRole('button', { name: /^(Next|Seguinte)(?::|$)/ }).click()
  await page.getByRole('button', { name: /^(Next|Seguinte)(?::|$)/ }).click()
  await page.getByRole('button', { name: /^(Generate prompts|Gerar os prompts)$/ }).click()
  await page.waitForSelector('.wizard-shot pre')
  const prompt = await page.locator('.wizard-shot pre').first().innerText()
  assert.match(prompt, /Fog rolls across the empty street/)
  assert.match(prompt, /Empty city/)
  assert.doesNotMatch(prompt, / — |People:|SUBJECT:|Add at least one character/)
}

async function imageOverflows(page) {
  return page.evaluate(() => {
    const viewW = window.innerWidth
    const viewH = window.innerHeight
    const panel = document.querySelector('.modal-panel')
    const limit = panel ? panel.getBoundingClientRect() : null
    return [...document.querySelectorAll('img, svg')].flatMap(element => {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return []
      const box = element.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) return []
      const inDialog = Boolean(element.closest('.modal-panel'))
      const widerThanView = box.width > viewW + 2
      const tallerThanView = box.height > viewH + 2
      const outsideDialog = inDialog && limit && (box.width > limit.width + 2 || box.height > limit.height + 2)
      if (!widerThanView && !tallerThanView && !outsideDialog) return []
      return [{ tag: element.tagName, w: Math.round(box.width), h: Math.round(box.height), alt: element.getAttribute('alt') || element.getAttribute('aria-label') || '' }]
    })
  })
}

async function openWorkspaceTarget(page, kind) {
  const sidebar = page.locator('aside.workspace-sidebar')
  if (await sidebar.isVisible().catch(() => false)) {
    const name = kind === 'storyboard' ? /^storyboard$/i : /my projects|meus projetos/i
    await sidebar.getByRole('button', { name }).click()
    return
  }
  await page.locator('.workspace-menu-button').click()
  const menu = page.locator('#mobile-workspace-menu')
  await menu.waitFor({ state: 'visible' })
  const name = kind === 'storyboard' ? /storyboard/i : /my projects|meus projetos/i
  await menu.getByRole('button', { name }).click()
}

async function checkSidebarImages(page, lang) {
  await page.goto(`${origin}/${lang}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#main-content')
  assert.deepEqual(await imageOverflows(page), [], `homepage images overflow ${lang || 'en'}`)
  await page.goto(`${origin}/studio${lang}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#main-content')
  const sidebar = page.locator('aside.workspace-sidebar')
  if (await sidebar.isVisible().catch(() => false)) {
    const labels = await sidebar.locator('a, button').evaluateAll(elements => elements.map(element => (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim()))
    assert.ok(labels.some(label => /storyboard/i.test(label)), 'sidebar is missing Storyboard')
    assert.ok(labels.some(label => /my projects|meus projetos/i.test(label)), 'sidebar is missing My Projects')
    for (const label of labels) {
      const control = sidebar.getByRole('link', { name: label }).or(sidebar.getByRole('button', { name: label }))
      await control.first().click()
      await page.waitForTimeout(200)
      assert.deepEqual(await imageOverflows(page), [], `sidebar "${label}" image overflow`)
      if (await page.locator('.modal-panel').count()) await page.keyboard.press('Escape')
      if (!page.url().includes('/studio')) {
        await page.goto(`${origin}/studio${lang}`, { waitUntil: 'domcontentloaded' })
      }
    }
  }
  await openWorkspaceTarget(page, 'storyboard')
  await page.waitForSelector('.modal-panel .shot-thumbnail img')
  const thumb = await page.locator('.modal-panel .shot-thumbnail img').first().boundingBox()
  const panel = await page.locator('.modal-panel').boundingBox()
  assert.ok(thumb && panel && thumb.width <= panel.width + 2 && thumb.height <= panel.height + 2 && thumb.height <= 180 + 2, 'storyboard still is larger than the dialog')
  assert.deepEqual(await imageOverflows(page), [], 'storyboard dialog image overflow')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('.modal-panel'))
  await openWorkspaceTarget(page, 'projects')
  await page.waitForSelector('.modal-panel')
  assert.equal(await page.locator('.modal-panel .shot-thumbnail').count(), 0)
  assert.deepEqual(await imageOverflows(page), [], 'my projects dialog image overflow')
  await page.keyboard.press('Escape')
}

async function checkAdvancedNoCharacter(page, lang) {
  const code = lang.includes('pt') ? 'pt' : 'en'
  await page.goto(`${origin}/studio${lang}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /^(Advanced mode|Modo avançado)$/ }).click()
  const skip = page.locator('#advanced-no-character')
  await skip.waitFor({ state: 'visible' })
  await skip.scrollIntoViewIfNeeded()
  const box = await skip.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(box && box.width >= 120 && box.height >= 40, 'advanced No character button is not visible')
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 2 && box.y + box.height <= viewport.height + 2)
  assert.equal((await skip.innerText()).trim(), code === 'pt' ? 'Sem personagem' : 'No character')
  await skip.click()
  assert.equal(await skip.getAttribute('aria-pressed'), 'true')
  await page.locator('#studio-idea').fill('Fog rolls across an empty city street at dusk.')
  await page.locator('.studio-generate').click()
  await page.waitForSelector('textarea[aria-label^="Prompt"]')
  const prompts = await page.locator('textarea[aria-label^="Prompt"]').evaluateAll(elements => elements.map(element => element.value).join('\n'))
  assert.ok(prompts.length > 40, 'advanced no-character prompts were empty')
  assert.doesNotMatch(prompts, / — |People:|SUBJECT:|Same character:|Same wardrobe:|frame of Fog/)
}

async function assertNoThemeToggle(page, label) {
  assert.equal(await page.locator('.theme-toggle').count(), 0, `${label} rendered a theme toggle`)
  assert.equal(await page.getByRole('button', { name: /dark mode|modo escuro/i }).count(), 0, `${label} rendered a dark mode control`)
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('moovicut-dark')), false, `${label} applied a saved darkMode preference`)
}

async function checkStudio(page, lang) {
  await openGuidedStudio(page, lang)
  await assertNoThemeToggle(page, 'studio')
  await page.locator('#wizard-idea').fill('Short')
  await page.getByRole('button', { name: /^(Next|Seguinte)(?::|$)/ }).click()
  const focused = await page.evaluate(() => document.activeElement?.id || '')
  const errors = await page.locator('.wizard-error').count()
  assert.ok(focused === 'wizard-idea' || errors > 0, 'Next did not show the missing idea')
  await page.getByRole('button', { name: /my projects|meus projetos/i }).first().click()
  await page.waitForSelector('.modal-panel')
  const background = await page.locator('.modal-panel').evaluate(element => getComputedStyle(element).backgroundColor)
  assert.notEqual(background, 'rgba(0, 0, 0, 0)')
  assert.deepEqual(await imageOverflows(page), [], 'library dialog image overflow')
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
    await english.addInitScript(() => {
      localStorage.setItem('shotboard.preferences.v1', JSON.stringify({ autoSave: true, darkMode: true, notifications: false, emailUpdates: false }))
    })
    const errors = []
    english.on('pageerror', error => errors.push(String(error)))
    english.on('console', message => { if (message.type() === 'error' && !IGNORED.test(message.text())) errors.push(message.text()) })
    const moved = await english.goto(origin + '/en', { waitUntil: 'domcontentloaded' })
    assert.equal(new URL(english.url()).pathname, '/')
    assert.ok(!moved || moved.status() < 400)
    await english.waitForSelector('#main-content')
    await assertNoThemeToggle(english, '/en')
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
        for (const lang of ['?lang=en', '?lang=pt']) {
        const context = await browser.newContext(viewport.context)
        await context.addInitScript(() => {
          localStorage.setItem('shotboard.preferences.v1', JSON.stringify({ autoSave: true, darkMode: true, notifications: false, emailUpdates: false }))
        })
        const page = await context.newPage()
        const problems = []
        page.on('pageerror', error => problems.push(String(error)))
        page.on('console', message => { if (message.type() === 'error' && !IGNORED.test(message.text())) problems.push(message.text()) })
        for (const path of PATHS) {
          await page.goto(origin + path + lang, { waitUntil: 'domcontentloaded' })
          await page.waitForSelector('#main-content')
          await assertNoThemeToggle(page, `${viewport.name} ${path} ${lang}`)
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
          assert.ok(overflow <= 1, `${viewport.name} ${path} ${lang} overflows by ${overflow}px`)
          if (path === '/studio') {
            await checkSimpleGuide(page, lang)
            await checkAdvancedNoCharacter(page, lang)
            await checkSidebarImages(page, lang)
            if (viewport.name === 'desktop') await checkStudio(page, lang)
          }
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
