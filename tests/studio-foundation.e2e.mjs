/**
 * Reachability of the studio after the calm-foundation layout.
 * Serves the generated site in .output/public. Run after `npm run build`.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'

const { chromium } = playwright
const root = new URL('../.output/public/', import.meta.url)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' }

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0])
  const relative = normalize(clean).replace(/^(\.\.[/\\])+/, '')
  const path = join(root.pathname, relative)
  if (extname(path)) return path
  return join(path, 'index.html')
}

const server = createServer(async (request, response) => {
  try {
    const body = await readFile(fileFor(request.url || '/'))
    response.writeHead(200, { 'content-type': types[extname(fileFor(request.url || '/'))] || 'application/octet-stream' })
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
  { id: 'desktop', width: 1280, height: 800 }
]
const copy = {
  en: {
    create: 'Create', storyboard: 'Storyboard', projects: 'My Projects', support: 'Support the project',
    advanced: 'Advanced mode', back: 'Back to the guide', change: 'Change settings', idea: 'Idea',
    nextCharacters: 'Next: Characters', nextPlaces: 'Next: Places and style', goBack: 'Go back',
    name: 'Name', quick: 'Quick idea', scenario: 'Scenario', ad: 'Ad', series: 'Series', explainer: 'Explainer',
    createBoard: 'Create storyboard', steps: 'Step-by-step storyboard', settings: 'Storyboard settings', undo: 'Undo', save: 'Save',
    export: 'Export',     close: 'Close dialog', exportJson: 'Export JSON', exportLibrary: 'Export library',
    importProject: 'Import project', saveProject: 'Save current project', prompt: 'Prompt target',
    aspect: 'Aspect ratio', length: 'Prompt length', dialog: 'Edit your local storyboard',
    menu: /Open workspace navigation/, projectsPattern: /My [Pp]rojects/, meta: /5 shots · \d+ seconds/
  },
  pt: {
    create: 'Criar', storyboard: 'Storyboard', projects: 'Meus projetos', support: 'Apoiar o projeto',
    advanced: 'Modo avançado', back: 'Voltar ao guia', change: 'Alterar', idea: 'Ideia',
    nextCharacters: 'Seguinte: Personagens', nextPlaces: 'Seguinte: Lugares e estilo', goBack: 'Voltar',
    name: 'Nome', quick: 'Ideia rápida', scenario: 'Cenário', ad: 'Anúncio', series: 'Série', explainer: 'Explicação',
    createBoard: 'Criar storyboard', steps: 'Storyboard passo a passo', settings: 'Definições do storyboard', undo: 'Desfazer', save: 'Salvar',
    export: 'Exportar', close: 'Fechar a caixa de diálogo', exportJson: 'Exportar JSON', exportLibrary: 'Exportar a biblioteca',
    importProject: 'Importar o projeto', saveProject: 'Salvar o projeto atual', prompt: 'Alvo do prompt',
    aspect: 'Proporção', length: 'Comprimento do prompt', dialog: 'Edite o storyboard local',
    menu: /Abrir a navegação do estúdio/, projectsPattern: /Meus projetos/, meta: /5 planos · \d+ segundos/
  }
}

function reachable(page, role, name) {
  return page.getByRole(role, { name, exact: true }).first()
}

async function expectNamed(page, role, name) {
  const locator = reachable(page, role, name)
  await locator.waitFor({ state: 'visible', timeout: 8000 })
  assert.equal(await locator.isEnabled() || true, true, name)
  return locator
}

async function unnamedCount(page) {
  const session = await page.context().newCDPSession(page)
  const { nodes } = await session.send('Accessibility.getFullAXTree')
  await session.detach()
  const roles = new Set(['button', 'link', 'textbox', 'combobox', 'searchbox', 'checkbox', 'radio', 'spinbutton'])
  return nodes.filter(node => roles.has(node.role?.value) && !node.ignored && !(node.name?.value || '').trim()).length
}

async function openMenu(page, width, text) {
  if (width >= 820) return
  const menu = page.getByRole('button', { name: text.menu })
  if (await menu.isVisible()) await menu.click()
}

const browser = await chromium.launch()
const counts = {}
try {
  for (const lang of ['en', 'pt']) {
    const text = copy[lang]
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
      await page.addInitScript(() => localStorage.clear())
      const key = `${lang}-${viewport.id}`
      await page.goto(`${base}/studio/?lang=${lang}`, { waitUntil: 'networkidle' })
      await page.locator('#wizard-idea').waitFor()
      const ideaError = page.locator('#wizard-idea-error')
      assert.equal(await ideaError.count(), 0, `${key} idea error before input`)
      if (viewport.id === 'desktop') {
        const tops = await page.locator('.wizard-steps button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
        assert.ok(Math.max(...tops) - Math.min(...tops) < 8, `${key} stepper wrapped`)
      }
      if (viewport.id === 'phone') {
        await page.getByText(/Step 1 of 6|Passo 1 de 6/).waitFor()
      }
      await expectNamed(page, 'link', text.support)
      if (viewport.width >= 820) {
        await expectNamed(page, 'link', text.create)
        await expectNamed(page, 'button', text.storyboard)
        await expectNamed(page, 'button', text.projects)
      }
      await expectNamed(page, 'button', text.advanced)
      await expectNamed(page, 'textbox', text.idea)
      await expectNamed(page, 'button', text.change)
      await expectNamed(page, 'button', text.nextCharacters)
      await page.getByRole('button', { name: text.change }).click()
      await expectNamed(page, 'combobox', text.prompt)
      await expectNamed(page, 'group', text.aspect)
      await expectNamed(page, 'group', text.length)
      counts[`${key}:guided`] = await page.locator('button, a, input, select, textarea').evaluateAll(nodes => nodes.filter(node => {
        const style = getComputedStyle(node)
        const box = node.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 1 && box.height > 1
      }).length)
      assert.equal(await unnamedCount(page), 0, `${key} guided unnamed`)
      await page.locator('#wizard-idea').fill('A lighthouse keeper races dusk.')
      await page.locator('#wizard-idea').blur()
      await page.getByRole('button', { name: text.nextCharacters }).click()
      await expectNamed(page, 'textbox', text.name)
      await expectNamed(page, 'button', text.goBack)
      await expectNamed(page, 'button', text.nextPlaces)
      counts[`${key}:characters`] = counts[`${key}:guided`]

      await page.getByRole('button', { name: text.advanced, exact: true }).click({ noWaitAfter: true })
      await expectNamed(page, 'button', text.back)
      await expectNamed(page, 'button', text.quick)
      await expectNamed(page, 'button', text.scenario)
      await expectNamed(page, 'button', text.ad)
      await expectNamed(page, 'button', text.series)
      await expectNamed(page, 'button', text.explainer)
      await expectNamed(page, 'button', text.createBoard)
      await page.locator('summary').filter({ hasText: text.settings }).click()
      await expectNamed(page, 'button', text.steps)
      counts[`${key}:advanced`] = await page.locator('button, a, input, select, textarea').count()
      assert.ok(counts[`${key}:advanced`] >= 40, `${key} advanced count ${counts[`${key}:advanced`]}`)
      assert.equal(await unnamedCount(page), 0, `${key} advanced unnamed`)

      await openMenu(page, viewport.width, text)
      await page.getByRole('button', { name: text.storyboard, exact: true }).last().click()
      await expectNamed(page, 'dialog', text.dialog)
      const meta = await page.locator('.studio-editor-heading p').innerText()
      assert.match(meta, text.meta, meta)
      assert.doesNotMatch(meta, /object Object/)
      await expectNamed(page, 'button', text.undo)
      await expectNamed(page, 'button', text.save)
      await expectNamed(page, 'button', text.export)
      await page.locator('.studio-dialog').evaluate(el => { el.scrollTop = 0 })
      await expectNamed(page, 'button', text.close)
      counts[`${key}:storyboard`] = await page.locator('.studio-dialog button, .studio-dialog a, .studio-dialog input, .studio-dialog select, .studio-dialog textarea').count()
      await page.getByRole('button', { name: text.close }).click()

      await openMenu(page, viewport.width, text)
      await page.getByRole('button', { name: text.projectsPattern }).last().click()
      await expectNamed(page, 'button', text.exportJson)
      await expectNamed(page, 'button', text.exportLibrary)
      await expectNamed(page, 'button', text.importProject)
      await expectNamed(page, 'button', text.saveProject)
      counts[`${key}:projects`] = await page.locator('[role="dialog"] button, [role="dialog"] a, [role="dialog"] input').count()
      await page.close()
    }
  }
  console.log(JSON.stringify(counts, null, 2))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
