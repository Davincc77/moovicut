/** / (accueil) : le board instantané sous le hero — rendu local, jamais de requête. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { extname, normalize } from 'node:path'
import assert from 'node:assert/strict'
import playwright from 'playwright'

const { chromium } = playwright
const root = new URL('../.output/public/', import.meta.url)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

function fileFor (urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0])
  const relative = normalize(clean).replace(/^(\.\.[/\\])+/, '')
  const path = join(root.pathname, relative)
  return extname(path) ? path : join(path, 'index.html')
}

const nonGet = []
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') nonGet.push(request.method + ' ' + request.url)
  try {
    const body = await readFile(fileFor(request.url))
    response.writeHead(200, { 'content-type': types[extname(fileFor(request.url))] || 'application/octet-stream' })
    response.end(body)
  } catch { response.writeHead(404); response.end('nf') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForSelector('#hero-premise', { timeout: 15000 })

// trop court : rien ne s'affiche, aucun message d'erreur
await page.fill('#hero-premise', 'hi')
await page.waitForTimeout(900)
assert.equal(await page.locator('.instant-board').count(), 0, 'une idée courte ne doit montrer ni demi-board ni erreur')

// premise réelle : le board apparaît sans aucun aller-retour serveur
nonGet.length = 0 // le compteur de visites se paie au chargement, pas pendant la saisie
const PREMISE = 'A courier sprints across a failing bridge while a pursuit closes from behind, handheld camera and hard cuts.'
await page.fill('#hero-premise', PREMISE)
await page.waitForSelector('.instant-board .board-list li', { timeout: 5000 })
const cards = await page.locator('.instant-board .board-list li').count()
assert.ok(cards >= 1 && cards <= 4, 'entre 1 et 4 cartes, jamais plus')
assert.match(await page.locator('.instant-board .board-line').first().innerText(), /\w{8,}/, 'la première carte porte une ligne')
assert.ok(await page.locator('.board-copy').first().isVisible(), 'chaque carte a son bouton copier')
assert.match(await page.locator('.board-local').innerText(), /nothing was sent/i, 'la mention locale accompagne le board')
const refine = page.locator('.board-refine')
assert.ok(await refine.isVisible(), 'le bouton refine est la sortie du board')

// changer la cible de prompt re-planifie localement
await page.selectOption('.hero-model-select', 'sora')
await page.waitForTimeout(900)
assert.equal(await page.locator('.instant-board .board-list li').count(), cards, 'le board suit le modèle, sans disparaître en miettes')

// prose de Marc : multi-phrase → ce sont SES mots, pas des battons génériques
await page.fill('#hero-premise', "My grandmother says that during the war, when she was a girl, she walked across a frozen river at night carrying one small suitcase. I would like to make a picture of her young, in the snow, at dawn.")
await page.waitForTimeout(1200)
const marc = await page.locator('.instant-board .board-line').allInnerTexts()
assert.ok(marc.some(l => /frozen river/i.test(l)) && marc.some(l => /suitcase|snow|dawn/i.test(l)), 'les détails de l’auteur traversent jusqu’aux cartes')
assert.ok(!marc.some(l => /One new detail appears|chooses a direction/i.test(l)), 'plus de battons génériques sur une prose')

// aucun POST, PUT, DELETE pendant la saisie : la planche ne quitte jamais la machine
assert.deepEqual(nonGet, [], 'le board du hero ne doit JAMAIS appeler le serveur')

await browser.close()
server.close()
console.log('home-instant-board e2e ok')
