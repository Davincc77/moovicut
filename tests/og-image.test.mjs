import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { socialPreviewMeta, socialPreviewSeo, socialPreviewUrl, upsertMetaTag, upsertSocialMeta } from '../app/utils/social-preview.js'

const IMAGE = 'https://moovicut.studio/og-image.png'
const OUTPUT = '.output/public'

function pngSize(file) {
  const buf = readFileSync(file)
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} is not a PNG`)
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR')
  assert.equal(buf.readUInt32BE(16), 1200, `${file} width`)
  assert.equal(buf.readUInt32BE(20), 630, `${file} height`)
  assert.equal(buf[24], 8, `${file} bit depth`)
  assert.ok(buf[25] === 2 || buf[25] === 6, `${file} color type`)
  assert.equal(buf.subarray(buf.length - 8, buf.length - 4).toString('ascii'), 'IEND')
  assert.ok(buf.length > 8000, `${file} is too small to be the preview`)
}

function metaValues(html, attr, key) {
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`, 'gi')
  return [...html.matchAll(pattern)].map(match => {
    const content = match[0].match(/\bcontent="([^"]*)"/)
    return content ? content[1] : ''
  })
}

function generatedHtml(route) {
  const relative = route === '/' ? '' : route.replace(/^\/+/, '')
  const candidates = route === '/'
    ? ['index.html']
    : [join(relative, 'index.html'), `${relative}.html`, '200.html', 'index.html']
  for (const candidate of candidates) {
    const file = join(OUTPUT, candidate)
    if (existsSync(file)) return { file, html: readFileSync(file, 'utf8') }
  }
  return { file: '', html: '' }
}

function outputHasPreview() {
  const home = join(OUTPUT, 'index.html')
  return existsSync(home) && readFileSync(home, 'utf8').includes(IMAGE)
}

test('public/og-image.png is a 1200×630 PNG', () => {
  pngSize('public/og-image.png')
})

test('social preview URL stays absolute and non-empty', () => {
  assert.equal(socialPreviewUrl('https://moovicut.studio'), IMAGE)
  assert.equal(socialPreviewUrl('https://moovicut.studio/', '/'), IMAGE)
  assert.equal(socialPreviewUrl('', ''), IMAGE)
  assert.equal(socialPreviewUrl(undefined, undefined), IMAGE)
  const seo = socialPreviewSeo('https://moovicut.studio', '/')
  for (const value of Object.values(seo)) assert.equal(String(value).trim().length > 0, true)
  assert.equal(seo.ogImage, IMAGE)
  assert.equal(seo.twitterImage, IMAGE)
  assert.equal(seo.ogImageWidth, '1200')
  assert.equal(seo.ogImageHeight, '630')
  assert.equal(seo.twitterCard, 'summary_large_image')
  assert.equal(socialPreviewMeta()[0].content, IMAGE)
})

test('page meta spreads the preview and does not publish an empty image', () => {
  const files = ['app.vue', ...readdirSync('app/pages').map(name => join('app/pages', name))]
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    if (!/useSeoMeta|useHead/.test(source)) continue
    assert.match(source, /socialPreview(?:Seo|Meta)/, file)
    assert.doesNotMatch(source, /ogImage:\s*['"]\s*['"]/, file)
    assert.doesNotMatch(source, /twitterImage:\s*['"]\s*['"]/, file)
    assert.doesNotMatch(source, /content:\s*['"]\s*['"]/, file)
  }
  assert.match(readFileSync('nuxt.config.ts', 'utf8'), /socialPreviewMeta\(siteOrigin, baseURL\)/)
  assert.match(readFileSync('nuxt.config.ts', 'utf8'), /upsertSocialMeta\(html, siteOrigin, baseURL\)/)
  assert.match(readFileSync('nuxt.config.ts', 'utf8'), /['"]\/agents['"]/)
})

test('prerender hook replaces empty social images and keeps width tags', () => {
  const broken = `<!doctype html><html><head><meta property="og:image" content=""><meta property="og:image:width" content=""><meta name="twitter:image" content=""><meta name="twitter:card" content="summary"></head><body></body></html>`
  const fixed = upsertSocialMeta(broken)
  assert.deepEqual(metaValues(fixed, 'property', 'og:image'), [IMAGE])
  assert.deepEqual(metaValues(fixed, 'property', 'og:image:width'), ['1200'])
  assert.deepEqual(metaValues(fixed, 'property', 'og:image:height'), ['630'])
  assert.equal(metaValues(fixed, 'property', 'og:image:alt').length, 1)
  assert.notEqual(metaValues(fixed, 'property', 'og:image:alt')[0], '')
  assert.deepEqual(metaValues(fixed, 'name', 'twitter:image'), [IMAGE])
  assert.deepEqual(metaValues(fixed, 'name', 'twitter:card'), ['summary_large_image'])
  const bare = upsertMetaTag('<html><head></head></html>', 'property', 'og:image', IMAGE)
  assert.match(bare, new RegExp(`<meta property="og:image" content="${IMAGE}">`))
})

test('generated HTML for /, /studio, and /agents uses the summary large image', { timeout: 240000 }, () => {
  if (!outputHasPreview()) {
    const result = spawnSync(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'generate'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, NUXT_APP_BASE_URL: '/' }
    })
    assert.equal(result.status, 0, 'nuxt generate failed')
  }
  pngSize(join(OUTPUT, 'og-image.png'))
  for (const route of ['/', '/studio', '/agents']) {
    const { file, html } = generatedHtml(route)
    assert.ok(file, `missing generated HTML for ${route}`)
    assert.ok(html.includes('<html'), file)
    assert.deepEqual(metaValues(html, 'property', 'og:image'), [IMAGE], file)
    assert.deepEqual(metaValues(html, 'property', 'og:image:width'), ['1200'], file)
    assert.deepEqual(metaValues(html, 'property', 'og:image:height'), ['630'], file)
    assert.ok(metaValues(html, 'property', 'og:image:alt')[0], file)
    assert.deepEqual(metaValues(html, 'name', 'twitter:image'), [IMAGE], file)
    assert.deepEqual(metaValues(html, 'name', 'twitter:card'), ['summary_large_image'], file)
  }
})
