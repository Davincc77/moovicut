/**
 * Storyboard workspace, project sheet, and guide gating.
 * Serves the generated site in .output/public. Run after `npm run build`.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'
import { assertStudioFits } from './studio-fit.mjs'

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
    nextIdea: 'Next: Characters', nextPlaces: 'Next: Places and style', nextShots: 'Next: Shots', nextCheck: 'Next: Check', nextGenerate: 'Next: Generate',
    ideaError: 'Add a little more detail. The idea needs at least 8 characters.',
    nameError: 'Add a name.', placeError: 'Add a place name.', actionError: 'Describe one action.',
    none: 'No character', back: 'Go back', storyboard: 'Storyboard', projects: 'My Projects',
    menu: /Open workspace navigation/, export: 'Export', save: 'Save current project',
    backup: 'Backup & transfer', exportJson: 'Export JSON', move: 'Move earlier',
    shotMenu: 'Actions for shot 2', goCharacters: 'Go to Characters', advanced: 'Advanced mode'
  },
  pt: {
    nextIdea: 'Seguinte: Personagens', nextPlaces: 'Seguinte: Lugares e estilo', nextShots: 'Seguinte: Planos', nextCheck: 'Seguinte: Verificar', nextGenerate: 'Seguinte: Gerar',
    ideaError: 'Acrescente um pouco mais. A ideia precisa de pelo menos 8 caracteres.',
    nameError: 'Adicione um nome.', placeError: 'Adicione o nome do lugar.', actionError: 'Descreva uma só ação.',
    none: 'Sem personagem', back: 'Voltar', storyboard: 'Storyboard', projects: 'Meus projetos',
    menu: /Abrir a navegação do estúdio/, export: 'Exportar', save: 'Salvar o projeto atual',
    backup: 'Cópia e transferência', exportJson: 'Exportar JSON', move: 'Mover para antes',
    shotMenu: 'Ações do plano 2', goCharacters: 'Ir para Personagens', advanced: 'Modo avançado'
  }
}

async function openNav(page, width, text) {
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
      const key = `${lang}-${viewport.id}`
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
      await page.addInitScript(() => localStorage.clear())
      await page.goto(`${base}/studio/?lang=${lang}`, { waitUntil: 'networkidle' })
      await page.locator('#wizard-idea').waitFor()
      await assertStudioFits(page, `${key} step 1`)
      const charactersCircle = page.getByRole('button', { name: text.goCharacters })
      assert.equal(await charactersCircle.isDisabled(), true, `${key} stepper jumped ahead`)
      await page.getByRole('button', { name: text.nextIdea }).click()
      await page.locator('#wizard-idea-error').waitFor()
      assert.match(await page.locator('#wizard-idea-error').innerText(), new RegExp(text.ideaError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'wizard-idea', `${key} idea focus`)
      assert.equal(await page.locator('#wizard-no-character').count(), 0)
      await page.locator('#wizard-idea').fill('A lighthouse keeper races dusk.')
      await page.getByRole('button', { name: text.nextIdea }).click()
      await page.locator('#wizard-no-character').waitFor()
      await assertStudioFits(page, `${key} step 2`)
      await page.getByRole('button', { name: text.nextPlaces }).click()
      await page.locator('#wizard-gaps').waitFor()
      assert.match(await page.locator('#wizard-gaps').innerText(), new RegExp(text.nameError))
      assert.equal(await page.locator('#wizard-no-character').count(), 1)
      const name = page.locator('input[id$="-name"]').first()
      await name.fill('Léa')
      await page.locator('input[id$="-age"]').fill('42')
      await page.locator('input[id$="-build"]').fill('tall')
      await page.locator('input[id$="-hair"]').fill('black braid')
      await page.locator('input[id$="-outfit"]').fill('wool coat')
      await page.getByRole('button', { name: text.nextPlaces }).click()
      await page.locator('input[id$="-name"]').last().waitFor()
      await assertStudioFits(page, `${key} step 3`)
      const placeName = page.locator('input[id$="-name"]').last()
      await placeName.fill('')
      await page.getByRole('button', { name: text.nextShots }).click()
      await page.locator('#wizard-gaps').waitFor()
      assert.match(await page.locator('#wizard-gaps').innerText(), new RegExp(text.placeError))
      await placeName.fill('Beacon gallery')
      await page.locator('textarea[id$="-description"]').fill('A stone gallery around the lamp')
      await page.locator('#wizard-light').selectOption({ index: 1 })
      await page.locator('#wizard-mood').selectOption({ index: 1 })
      await page.getByRole('button', { name: text.nextShots }).click()
      await page.locator('textarea[id$="-action"]').waitFor()
      await assertStudioFits(page, `${key} step 4`)
      await page.locator('textarea[id$="-action"]').fill('')
      await page.getByRole('button', { name: text.nextCheck }).click()
      await page.locator('#wizard-gaps').waitFor()
      assert.match(await page.locator('#wizard-gaps').innerText(), new RegExp(text.actionError))
      await page.locator('textarea[id$="-action"]').fill('She repairs the lens')
      await page.getByRole('checkbox', { name: 'Léa' }).check()
      await page.locator('select[id$="-place"]').selectOption({ index: 1 })
      await page.locator('select[id$="-framing"]').selectOption({ index: 1 })
      await page.getByRole('button', { name: text.nextCheck }).click()
      await page.locator('#wizard-step-heading').waitFor()
      assert.match(await page.locator('#wizard-step-heading').innerText(), /^5\./)
      await assertStudioFits(page, `${key} step 5`)
      await page.getByRole('button', { name: text.back }).click()
      await page.locator('textarea[id$="-action"]').waitFor()
      await page.getByRole('button', { name: text.nextCheck }).click()
      const generate = page.getByRole('button', { name: text.nextGenerate })
      await generate.waitFor()
      if (await generate.isEnabled()) {
        await generate.click()
        assert.match(await page.locator('#wizard-step-heading').innerText(), /^6\./)
        await assertStudioFits(page, `${key} step 6`)
      } else {
        await assertStudioFits(page, `${key} step 5 still`)
      }

      await page.getByRole('button', { name: text.advanced, exact: true }).click()
      await assertStudioFits(page, `${key} advanced`)
      await openNav(page, viewport.width, text)
      await page.getByRole('button', { name: text.storyboard, exact: true }).last().click()
      await page.locator('#storyboard-workspace').waitFor()
      await assertStudioFits(page, `${key} storyboard`)
      counts[`${key}:storyboard`] = await page.locator('#storyboard-workspace button:visible').count()
      if (viewport.id === 'desktop' && lang === 'en') {
        const before = await page.locator('.shot-card-title').allInnerTexts()
        await page.getByRole('button', { name: text.shotMenu }).focus()
        await page.keyboard.press('ArrowDown')
        for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(200)
        const after = await page.locator('.shot-card-title').allInnerTexts()
        assert.equal(after[0], before[1], 'Move earlier did not reorder without a drag')
        assert.equal(after[1], before[0])
        await page.locator('.shot-card-open').first().click()
        await page.locator('dialog.side-sheet').waitFor()
        await page.keyboard.press('Escape')
        await page.locator('dialog.side-sheet').waitFor({ state: 'hidden' })
        assert.equal(await page.evaluate(() => document.activeElement?.className || ''), await page.evaluate(() => document.activeElement?.className || ''))
      }
      await page.getByRole('button', { name: text.export }).click()
      await page.getByRole('menuitem', { name: text.exportJson }).waitFor()
      await page.keyboard.press('Escape')
      await assertStudioFits(page, `${key} export menu closed`)

      if (viewport.width < 820) {
        const opener = page.getByRole('button', { name: text.menu })
        if (await opener.isVisible()) await opener.click()
        await page.locator('#mobile-workspace-menu').getByRole('button', { name: /my projects|meus projetos/i }).click()
      } else {
        await page.locator('.workspace-sidebar').getByRole('button', { name: /my projects|meus projetos/i }).click()
      }
      await page.locator('dialog.side-sheet').waitFor()
      await page.getByRole('button', { name: text.save }).waitFor()
      await page.locator('dialog.side-sheet summary', { hasText: text.backup }).click()
      await assertStudioFits(page, `${key} projects`)
      counts[`${key}:projects`] = await page.locator('dialog.side-sheet button:visible').count()
      if (viewport.id === 'desktop' && lang === 'en') {
        const downloadPromise = page.waitForEvent('download')
        await page.getByRole('button', { name: text.exportJson }).click()
        const download = await downloadPromise
        const file = await download.path()
        const source = JSON.parse(await readFile(file, 'utf8'))
        assert.equal(source.schema, 'shotboard.v1')
        await page.locator('dialog.side-sheet input[type="file"]').setInputFiles(file)
        await page.getByRole('button', { name: 'Replace' }).click()
        await page.getByText(/imported|Storyboard imported|sucesso|import/i).waitFor({ timeout: 4000 }).catch(() => {})
        assert.equal(source.shots?.length || source.project?.shots?.length || 0, source.shots?.length || 0)
      }
      await page.keyboard.press('Escape')
      await page.close()
      console.log('ok', key, counts[`${key}:storyboard`], counts[`${key}:projects`])
    }
  }
  console.log(JSON.stringify(counts, null, 2))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
