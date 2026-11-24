// Header phone : le motmarque + les actions doivent POUVOIR se compresser.
// Nuxt 4.7 (lightningcss, ordre de regles different) a revele que le flex
// dependait d'un ecrasement accidentel par d'anciens moteurs : sans
// min-width:0, le .header-inner depassait de 156px sur iPhone 13 (546/390).
// Ce guard sert aussi de filet anti-regression si une future CSS casse le
// shrink du header.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createProdServer } from '../server/prod-server.mjs'
import { chromium } from 'playwright'

const server = createProdServer({ staticRoot: new URL('../.output/public/', import.meta.url).pathname })
const port = 3432
const origin = await new Promise((res, rej) => {
  server.once('error', rej)
  server.listen(port, () => res(`http://localhost:${port}`))
})
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  for (const path of ['/', '/studio', '/long']) {
    await page.goto(origin + path + '?lang=en', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#main-content')
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: (() => { const h = document.querySelector('.site-header, .studio-shell header, .studio-shell'); return h ? Math.round(h.getBoundingClientRect().width) : -1 })()
    }))
    assert.ok(m.overflow <= 1, `${path}: le document deborde de ${m.overflow}px (header ${m.header} pour vw 390)`)
  }
  const langs = await page.evaluate(() => null)
  void langs
} finally {
  await browser.close()
  await new Promise(res => server.close(res))
}
void spawnSync; void spawn
