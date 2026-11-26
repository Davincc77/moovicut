/** /story — prose humaine (rapport « Marc ») : jamais de jargon, draft affiché. */
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
const server = createServer(async (request, response) => {
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

// GRANDMOTHER est une prose sans lieu explicite et avec une subordonnée de rapport :
// c'est exactement ce qui cassait /story et volait le personnage (bug rapport Marc).
const GRANDMOTHER = 'My grandmother says that during the war, when she was a girl, she walked across a frozen river at night carrying one small suitcase. I would like to make a picture of her young, in the snow, at dawn. She says the ice groaned under every step and the wind carried the smell of smoke from the villages behind her. On the far bank a lantern waited, and she walked toward it without looking back. Years later she kept the suitcase on a shelf in the kitchen, and she still will not say what was inside. I would like the picture to show the cold, the silence, and one small figure crossing a white river. Her hands are red with cold in every frame.'
assert.ok(GRANDMOTHER.length >= 600, `fixture must be a real story: ${GRANDMOTHER.length}`)

await page.goto(`${base}/story`, { waitUntil: 'networkidle' })
await page.waitForSelector('#story-input', { timeout: 15000 })
await page.fill('#story-input', GRANDMOTHER)
await page.getByRole('button', { name: /show my draft/i }).click()
await page.waitForTimeout(1500)

// 1) aucun jargon de validateur, jamais
const alertText = await page.locator('.story-error').innerText().catch(() => '')
assert.doesNotMatch(alertText, /scenes\[|is missing where|invalid|expected/i, 'le message technique ne doit jamais fuiter')

// 2) le draft s'affiche bien
await page.waitForSelector('.story-shot', { timeout: 5000 })
const prompts = await page.locator('.story-shot-prompt').allInnerTexts()
assert.ok(prompts.length >= 1, 'au moins un prompt généré')

// 3) la ligne de verrou du personnage (« Name — detail ») ne doit JAMAIR contenir
// la subordonnée de rapport. La citation intégrale dans SHOT: est LE produit
// (provenance « from your story ») et reste permise.
for (const prompt of prompts) {
  const lock = prompt.split('\n').find(line => /—/.test(line) && !/^(SHOT|LIGHT|CAMERA|STYLE|DIALOGUE)/i.test(line)) || ''
  const name = lock.split('—')[0].trim()
  assert.doesNotMatch(name, /\b(says|knocked|that)\b/i, 'le nom verrouillé ne doit pas avaler la subordonnée')
}
assert.match(prompts.join('\n'), /grandmother/i, 'la grand-mère reste bien le sujet verrouillé des prompts')

await browser.close()
server.close()
console.log('story-human-prose e2e ok')
