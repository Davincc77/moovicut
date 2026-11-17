/**
 * Strict guide gates. Serves .output/public. Run after `npm run build`.
 * Phone 390×844, tablet portrait 820×1180, tablet landscape 1180×820, desktop 1440×900.
 * English and Portuguese.
 */
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'
import { assertStudioFits } from './studio-fit.mjs'

const { chromium } = playwright
const root = new URL('../.output/public/', import.meta.url)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' }
const shotsDir = process.env.WIZARD_SHOTS || ''
if (shotsDir) mkdirSync(shotsDir, { recursive: true })

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
    idea: 'A quiet moment unfolds slowly.',
    next: {
      characters: 'Next: Characters',
      places: 'Next: Places and style',
      shots: 'Next: Shots',
      check: 'Next: Check',
      generate: 'Next: Generate'
    },
    go: {
      idea: 'Go to Idea',
      characters: 'Go to Characters',
      places: 'Go to Places and style',
      shots: 'Go to Shots',
      check: 'Go to Check',
      generate: 'Go to Generate'
    },
    ideaError: 'Add a little more detail. The idea needs at least 8 characters.',
    nameError: 'Add a name.',
    ageError: 'Add an age.',
    placeError: 'Add a place name.',
    descError: 'Add a description of this place.',
    lightError: 'Choose a light from the list.',
    moodError: 'Choose a mood from the list.',
    shotPlaceError: 'Choose a place for this shot.',
    actionError: 'Describe one action.',
    framingError: 'Choose a framing term.',
    durationError: 'Duration must be a whole number from 2 to 15 seconds.',
    back: 'Go back',
    generate: 'Generate prompts'
  },
  pt: {
    idea: 'Um dia calmo passa devagar sem pressa.',
    next: {
      characters: 'Seguinte: Personagens',
      places: 'Seguinte: Lugares e estilo',
      shots: 'Seguinte: Planos',
      check: 'Seguinte: Verificar',
      generate: 'Seguinte: Gerar'
    },
    go: {
      idea: 'Ir para Ideia',
      characters: 'Ir para Personagens',
      places: 'Ir para Lugares e estilo',
      shots: 'Ir para Planos',
      check: 'Ir para Verificar',
      generate: 'Ir para Gerar'
    },
    ideaError: 'Acrescente um pouco mais. A ideia precisa de pelo menos 8 caracteres.',
    nameError: 'Adicione um nome.',
    ageError: 'Adicione uma idade.',
    placeError: 'Adicione o nome do lugar.',
    descError: 'Adicione uma descrição deste lugar.',
    lightError: 'Escolha uma luz da lista.',
    moodError: 'Escolha um clima da lista.',
    shotPlaceError: 'Escolha um lugar para este plano.',
    actionError: 'Descreva uma só ação.',
    framingError: 'Escolha um termo de enquadramento.',
    durationError: 'A duração tem de ser um número inteiro de 2 a 15 segundos.',
    back: 'Voltar',
    generate: 'Gerar os prompts'
  }
}

function savedOnCheck() {
  return {
    version: 1,
    step: 'check',
    maxReached: 4,
    idea: 'A quiet moment unfolds slowly.',
    model: 'grok',
    promptStyle: 'short',
    aspectRatio: '16:9',
    styleFamily: 'cinema',
    genre: 'drama',
    light: '',
    mood: '',
    noCharacter: false,
    characterIndex: 0,
    placeIndex: 0,
    shotIndex: 0,
    characters: [{ id: 'character-1', name: 'Léa', age: '', build: '', hair: '', outfit: '', colors: '', mark: '' }],
    places: [{ id: 'place-1', name: 'The setting', description: 'a place the text does not name', origin: { name: 'detected', description: 'detected' } }],
    shots: [{ id: 'shot-1', whoIds: [], placeId: 'place-1', action: 'A quiet moment unfolds slowly.', framing: 'medium', duration: 3, origin: { action: 'detected' } }],
    hasGenerated: false
  }
}

function stepButton(page, name) {
  return page.getByRole('button', { name, exact: true })
}

async function heading(page) {
  return (await page.locator('#wizard-step-heading').innerText()).replace(/\s+/g, ' ').trim()
}

async function clickNamed(page, name) {
  const button = stepButton(page, name)
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

async function assertBlockedNext(page, name, error, focusId, stepPattern, label) {
  await clickNamed(page, name)
  const alert = focusId === 'wizard-idea' ? page.locator('#wizard-idea-error') : page.locator('#wizard-gaps')
  await alert.waitFor()
  assert.match(await alert.innerText(), new RegExp(error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} message`)
  await page.waitForFunction(id => document.activeElement?.id === id, focusId)
  assert.match(await heading(page), stepPattern, `${label} stayed`)
}

async function assertStepperBlocked(page, name, stepPattern, label) {
  const button = stepButton(page, name)
  assert.equal(await button.isDisabled(), true, `${label} stepper was enabled`)
  await button.click({ force: true })
  assert.match(await heading(page), stepPattern, `${label} stepper moved`)
}

async function setDuration(page, value) {
  await page.locator('#shot-1-duration').evaluate((element, next) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(element, String(next))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await page.waitForFunction((next) => document.getElementById('shot-1-duration')?.value === String(next), value)
}

async function runGuide(page, text, viewport) {
  const key = `${text === copy.pt ? 'pt' : 'en'}-${viewport.id}`
  await page.goto(`${base}/studio/?lang=${text === copy.pt ? 'pt' : 'en'}`, { waitUntil: 'domcontentloaded' })
  await page.locator('#wizard-idea').waitFor()
  assert.match(await heading(page), /^1\./, `${key} did not open on the idea`)

  await assertBlockedNext(page, text.next.characters, text.ideaError, 'wizard-idea', /^1\./, `${key} empty idea`)
  await assertStepperBlocked(page, text.go.characters, /^1\./, `${key} empty idea`)
  await page.locator('#wizard-idea').fill('1234567')
  await assertBlockedNext(page, text.next.characters, text.ideaError, 'wizard-idea', /^1\./, `${key} short idea`)
  await assertStepperBlocked(page, text.go.characters, /^1\./, `${key} short idea`)

  await page.locator('#wizard-idea').fill(text.idea)
  await page.waitForFunction(name => {
    const button = [...document.querySelectorAll('.wizard-steps button')].find(node => node.getAttribute('aria-label') === name)
    return button && !button.disabled
  }, text.go.characters)
  assert.equal(await stepButton(page, text.go.places).isDisabled(), true, `${key} places opened from the idea`)
  await clickNamed(page, text.next.characters)
  await page.locator('#wizard-no-character').waitFor()
  assert.match(await heading(page), /^2\./, `${key} next did not open characters`)
  await clickNamed(page, text.go.idea)
  assert.match(await heading(page), /^1\./, `${key} could not return to the idea`)
  await clickNamed(page, text.go.characters)
  await page.locator('#wizard-no-character').waitFor()
  assert.match(await heading(page), /^2\./, `${key} stepper did not open characters`)

  await assertBlockedNext(page, text.next.places, text.nameError, 'character-1-name', /^2\./, `${key} empty character`)
  await assertStepperBlocked(page, text.go.places, /^2\./, `${key} empty character`)
  await page.locator('#character-1-name').fill('Léa')
  await assertBlockedNext(page, text.next.places, text.ageError, 'character-1-age', /^2\./, `${key} partial character`)
  await page.locator('#character-1-age').fill('42')
  await page.locator('#character-1-build').fill('tall')
  await page.locator('#character-1-hair').fill('black braid')
  await page.locator('#character-1-outfit').fill('wool coat')
  await page.locator('#wizard-add-character').click()
  await page.locator('#character-2-name').waitFor()
  await assertBlockedNext(page, text.next.places, text.nameError, 'character-2-name', /^2\./, `${key} second character`)
  await assertStepperBlocked(page, text.go.places, /^2\./, `${key} second character`)

  await page.locator('#wizard-no-character').click()
  assert.equal(await page.locator('#wizard-no-character').getAttribute('aria-pressed'), 'true')
  await page.waitForFunction(name => {
    const button = [...document.querySelectorAll('.wizard-steps button')].find(node => node.getAttribute('aria-label') === name)
    return button && !button.disabled
  }, text.go.places)
  assert.equal(await stepButton(page, text.go.shots).isDisabled(), true, `${key} no character opened shots`)
  assert.equal(await stepButton(page, text.go.check).isDisabled(), true, `${key} no character opened check`)
  await clickNamed(page, text.go.places)
  await page.locator('#place-1-name').waitFor()
  assert.match(await heading(page), /^3\./, `${key} stepper did not open places`)
  assert.equal(await page.locator('#place-1-name').inputValue(), 'The setting', `${key} placeholder place`)

  await assertBlockedNext(page, text.next.shots, text.placeError, 'place-1-name', /^3\./, `${key} placeholder place`)
  await assertStepperBlocked(page, text.go.shots, /^3\./, `${key} placeholder place`)
  if (shotsDir && text === copy.en) {
    await assertStudioFits(page, `${key} blocked places`)
    await page.screenshot({ path: join(shotsDir, `wizard-blocked-${viewport.id}.png`), fullPage: true })
  }
  await page.locator('#place-1-name').fill('Quay')
  await assertBlockedNext(page, text.next.shots, text.descError, 'place-1-description', /^3\./, `${key} place description`)
  await page.locator('#place-1-description').fill('a wet stone quay')
  await assertBlockedNext(page, text.next.shots, text.lightError, 'wizard-light', /^3\./, `${key} light`)
  await page.locator('#wizard-light').selectOption('dusk')
  await assertBlockedNext(page, text.next.shots, text.moodError, 'wizard-mood', /^3\./, `${key} mood`)
  await assertStepperBlocked(page, text.go.shots, /^3\./, `${key} mood`)
  await page.locator('#wizard-mood').selectOption('quiet')
  await page.waitForFunction(name => {
    const button = [...document.querySelectorAll('.wizard-steps button')].find(node => node.getAttribute('aria-label') === name)
    return button && !button.disabled
  }, text.go.shots)
  assert.equal(await stepButton(page, text.go.check).isDisabled(), true, `${key} places opened check`)
  await clickNamed(page, text.go.shots)
  await page.locator('#shot-1-action').waitFor()
  assert.match(await heading(page), /^4\./, `${key} stepper did not open shots`)
  const copied = (await page.locator('#shot-1-action').inputValue()).replace(/[.!?…]+$/u, '')
  assert.equal(copied, text.idea.replace(/[.!?…]+$/u, ''), `${key} idea was not copied into the action`)

  await assertBlockedNext(page, text.next.check, text.shotPlaceError, 'shot-1-place', /^4\./, `${key} shot place`)
  await assertStepperBlocked(page, text.go.check, /^4\./, `${key} shot place`)
  await page.locator('#shot-1-place').selectOption('place-1')
  await setDuration(page, 1)
  await assertBlockedNext(page, text.next.check, text.actionError, 'shot-1-action', /^4\./, `${key} copied action`)
  await page.locator('#shot-1-action').fill('The tide slips out')
  await clickNamed(page, text.next.check)
  await page.locator('#wizard-gaps').waitFor()
  const afterAction = await page.locator('#wizard-gaps').innerText()
  const afterFocus = await page.evaluate(() => document.activeElement?.id || '')
  if (afterFocus === 'shot-1-framing' || afterAction.includes(text.framingError)) {
    assert.match(await heading(page), /^4\./, `${key} framing`)
    await page.locator('#shot-1-framing').selectOption('wide')
    await clickNamed(page, text.next.check)
    await page.locator('#wizard-gaps').waitFor()
  }
  assert.match(await page.locator('#wizard-gaps').innerText(), new RegExp(text.durationError.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${key} duration`)
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'shot-1-duration', `${key} duration focus`)
  assert.match(await heading(page), /^4\./, `${key} duration stayed`)
  await setDuration(page, 4)
  if ((await page.locator('#shot-1-framing').inputValue()) === '') await page.locator('#shot-1-framing').selectOption('wide')
  assert.equal(await stepButton(page, text.go.check).isDisabled(), false, `${key} check stayed closed`)
  await clickNamed(page, text.next.check)
  assert.match(await heading(page), /^5\./, `${key} did not reach check`)

  await clickNamed(page, text.go.idea)
  assert.match(await heading(page), /^1\./, `${key} could not go back`)
  assert.equal(await stepButton(page, text.go.check).isDisabled(), false, `${key} completed check closed`)
  await clickNamed(page, text.go.check)
  assert.match(await heading(page), /^5\./, `${key} could not return to check`)
  await clickNamed(page, text.back)
  assert.match(await heading(page), /^4\./, `${key} back`)
  await clickNamed(page, text.next.check)
  assert.match(await heading(page), /^5\./, `${key} next back to check`)
  await clickNamed(page, text.next.generate)
  assert.match(await heading(page), /^6\./, `${key} did not reach generate`)
  await clickNamed(page, text.generate)
  await page.locator('.wizard-shot pre').first().waitFor()
  assert.match(await page.locator('.wizard-shot pre').first().innerText(), /The tide slips out/)
  assert.doesNotMatch(await page.locator('.wizard-shot pre').first().innerText(), /Léa/)
}

async function runRestore(page, text) {
  const lang = text === copy.pt ? 'pt' : 'en'
  await page.goto(`${base}/studio/?lang=${lang}`, { waitUntil: 'domcontentloaded' })
  await page.locator('#wizard-step-heading').waitFor()
  assert.match(await heading(page), /^2\./, `${lang} restored check was not clamped`)
  assert.equal(await stepButton(page, text.go.idea).isDisabled(), false, `${lang} idea closed`)
  assert.equal(await stepButton(page, text.go.characters).isDisabled(), false, `${lang} characters closed`)
  await assertStepperBlocked(page, text.go.places, /^2\./, `${lang} restored places`)
  await assertStepperBlocked(page, text.go.shots, /^2\./, `${lang} restored shots`)
  await assertStepperBlocked(page, text.go.check, /^2\./, `${lang} restored check`)
  await assertStepperBlocked(page, text.go.generate, /^2\./, `${lang} restored generate`)
  await assertBlockedNext(page, text.next.places, text.ageError, 'character-1-age', /^2\./, `${lang} restored age`)
  await clickNamed(page, text.go.idea)
  assert.match(await heading(page), /^1\./, `${lang} restored back`)
  assert.equal(await stepButton(page, text.go.characters).isDisabled(), false)
  assert.equal(await stepButton(page, text.go.places).isDisabled(), true)
}

const browser = await chromium.launch()
try {
  for (const lang of ['en', 'pt']) {
    const text = copy[lang]
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
      await page.addInitScript(() => localStorage.clear())
      await runGuide(page, text, viewport)
      await page.close()
      console.log('ok', `${lang}-${viewport.id}`)

      const restored = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
      await restored.addInitScript(raw => {
        localStorage.setItem('moovicut.wizard.v1', raw)
        localStorage.removeItem('moovicut.studio.experience')
      }, JSON.stringify(savedOnCheck()))
      await runRestore(restored, text)
      await restored.close()
      console.log('ok', `${lang}-${viewport.id}-restored`)
    }
  }
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
