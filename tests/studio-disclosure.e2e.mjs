/**
 * Advanced disclosure and guide fit. Serves .output/public. Run after `npm run build`.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'
import { assertStudioFits } from './studio-fit.mjs'

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
const viewports = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'tablet-portrait', width: 820, height: 1180 },
  { id: 'tablet-landscape', width: 1180, height: 820 },
  { id: 'desktop', width: 1440, height: 900 }
]
const copy = {
  en: {
    advanced: 'Advanced mode', next: 'Next: Characters', more: 'More options', inspiration: 'Inspiration',
    withCast: 'With characters', none: 'No character', empty: 'Your shots will appear here',
    projects: /My [Pp]rojects/, ideaOnce: /write an idea/gi
  },
  pt: {
    advanced: 'Modo avançado', next: 'Seguinte: Personagens', more: 'Mais opções', inspiration: 'Inspiração',
    withCast: 'Com personagens', none: 'Sem personagem', empty: 'Os planos aparecem aqui',
    projects: /Meus projetos/, ideaOnce: /escrev\w* uma ideia/gi
  }
}

async function visibleCount(page) {
  return page.locator('button, a, input, select, textarea').evaluateAll(nodes => nodes.filter(node => {
    if (node.closest('[hidden]')) return false
    const style = getComputedStyle(node)
    const box = node.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 1 && box.height > 1
  }).length)
}

const browser = await chromium.launch()
const counts = {}
try {
  for (const lang of ['en', 'pt']) {
    const text = copy[lang]
    for (const viewport of viewports) {
      const page = await browser.newPage({ bypassCSP: true, viewport: { width: viewport.width, height: viewport.height } })
      await page.addInitScript(() => localStorage.clear())
      const key = `${lang}-${viewport.id}`
      await page.goto(`${base}/studio/?lang=${lang}`, { waitUntil: 'domcontentloaded' })
      await page.locator('#wizard-idea').waitFor()
      await assertStudioFits(page, `${key} guided`)
      if (viewport.id === 'phone') {
        await page.getByText(/Step 1 of 6|Passo 1 de 6/).waitFor()
        const footer = await page.locator('.wizard-footer').boundingBox()
        const footerBottom = footer ? footer.y + footer.height : 0
        assert.ok(footer && footer.y > viewport.height * 0.55 && footerBottom <= viewport.height + 12, `${key} footer ${footer && Math.round(footer.y)}`)
      }
      await page.locator('#wizard-idea').fill('A lighthouse keeper races the dusk.')
      await page.getByRole('button', { name: text.next }).click()
      await page.locator('#wizard-no-character').waitFor()
      await page.getByRole('button', { name: text.withCast, exact: true }).waitFor()
      assert.equal(await page.locator('#wizard-no-character').innerText(), text.none)
      await assertStudioFits(page, `${key} characters`)

      await page.getByRole('button', { name: text.advanced, exact: true }).click()
      await page.locator('#studio-idea').waitFor()
      await page.getByRole('heading', { name: text.empty }).waitFor()
      assert.equal(await page.locator('#studio-more-options').getAttribute('aria-expanded'), 'false')
      assert.equal(await page.locator('#studio-inspiration').getAttribute('aria-expanded'), 'false')
      await page.locator('#studio-more-options').focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('#studio-more-options').getAttribute('aria-expanded'), 'true')
      await page.getByRole('button', { name: 'Step-by-step storyboard' }).or(page.getByRole('button', { name: 'Storyboard passo a passo' })).waitFor()
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('#studio-more-options').getAttribute('aria-expanded'), 'false')
      const gap = await page.evaluate(() => {
        const box = document.querySelector('.studio-prompt-editor')?.getBoundingClientRect()
        const area = document.querySelector('#studio-idea')?.getBoundingClientRect()
        return box && area ? box.right - area.right : 999
      })
      assert.ok(gap < 20, `${key} textarea right gap ${gap}`)
      counts[key] = await visibleCount(page)
      await assertStudioFits(page, `${key} advanced`)
      if (viewport.id === 'phone') {
        await page.getByRole('button', { name: lang === 'pt' ? /Abrir a navegação do estúdio/ : /Open workspace navigation/ }).click()
        await page.getByRole('button', { name: text.projects }).last().click()
        const sheet = page.locator('dialog.side-sheet')
        await sheet.waitFor()
        const box = await sheet.boundingBox()
        assert.ok(box && box.height >= viewport.height - 2, `${key} sheet height ${box && Math.round(box.height)}`)
        const empty = await page.locator('dialog.side-sheet .empty-state').innerText()
        assert.equal((empty.match(text.ideaOnce) || []).length, 1, empty)
        const titleFont = await sheet.locator('h2').evaluate(el => getComputedStyle(el).fontFamily)
        assert.match(titleFont, /Space Grotesk/, titleFont)
        await assertStudioFits(page, `${key} projects sheet`)
        await page.keyboard.press('Escape')
        await sheet.waitFor({ state: 'hidden' })
      }
      await page.locator('#studio-inspiration').click()
      assert.equal(await page.locator('.studio-genre-filters button').count(), 9)
      await page.getByRole('button', { name: lang === 'pt' ? 'Explorar' : 'Explore' }).click()
      await assertStudioFits(page, `${key} inspiration`)
      await page.locator('#studio-inspiration').click()

      await page.locator('#studio-idea').fill('Fog rolls across an empty city street at dusk.')
      await page.locator('#advanced-no-character').click()
      await page.locator('.studio-generate').click()
      await page.locator('.studio-preview-panel .shot-card').first().waitFor()
      await page.evaluate(() => document.querySelectorAll('.toast, .moovicut-toast').forEach(node => node.remove()))
      await assertStudioFits(page, `${key} shots`)

      if (viewport.width < 820) {
        const small = await page.locator('.studio-create-form button, .studio-preview-panel button, .wizard-footer button, .cast-segment button').evaluateAll(nodes => nodes.flatMap(node => {
          if (node.closest('[hidden]')) return []
          const style = getComputedStyle(node)
          const box = node.getBoundingClientRect()
          if (style.display === 'none' || box.width < 2 || box.height < 2) return []
          if (box.width >= 44 && box.height >= 44) return []
          return [(node.getAttribute('aria-label') || node.innerText || node.className).replace(/\s+/g, ' ').trim().slice(0, 40)]
        }))
        assert.deepEqual(small, [], `${key} tap targets ${small.join(', ')}`)
      }

      await page.close()
    }
  }
  console.log(JSON.stringify(counts, null, 2))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
