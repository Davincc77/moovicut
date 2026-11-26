/** Three modes, one name each, everywhere: Studio / Short story / Author.
 *  Static guard on the sources (the rendered behaviour is pinned by mode-switch.e2e.mjs). */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = file => readFileSync(file, 'utf8')
const header = read('app/components/AppHeader.vue')
const footer = read('app/components/SiteFooter.vue')
const css = read('app/assets/css/main.css')

const MODES = [['/studio', 'Studio'], ['/story', 'Short story'], ['/long', 'Author']]

function modeLinks(block) {
  return [...block.matchAll(/<NuxtLink[^>]*\bto="(\/(?:studio|story|long))"[^>]*>\{\{ \$t\('([^']+)'\) \}\}<\/NuxtLink>/g)].map(match => [match[1], match[2]])
}

test('desktop nav carries the three modes in size order, inside the live .site-nav-links', () => {
  const desktop = header.slice(header.indexOf('class="site-nav-links"'), header.indexOf('</nav>', header.indexOf('class="site-nav-links"')))
  assert.match(desktop, /class="mode-switch"/)
  assert.deepEqual(modeLinks(desktop), MODES)
  assert.ok(desktop.indexOf('mode-switch') < desktop.indexOf('to="/faq"'), 'modes come before FAQ / Agents / Tips')
})

test('phone menu lists the same three modes first, then a separator, then the rest', () => {
  const menu = header.slice(header.indexOf('id="site-nav-menu"'), header.indexOf('</nav>', header.indexOf('id="site-nav-menu"')))
  assert.deepEqual(modeLinks(menu), MODES)
  assert.match(menu, /menu-sep/)
  assert.ok(menu.indexOf('menu-sep') < menu.indexOf('to="/faq"'))
})

test('the studio workspace dropdown lists the same three modes first', () => {
  const workspace = read('app/components/WorkspaceHeader.vue')
  const menu = workspace.slice(workspace.indexOf('id="studio-nav-menu"'), workspace.indexOf('</nav>', workspace.indexOf('id="studio-nav-menu"')))
  assert.deepEqual(modeLinks(menu), MODES)
  assert.ok(menu.indexOf('menu-sep') < menu.indexOf('to="/faq"'))
})

test('the footer uses the same three names (no "For authors" / bare "Moovicut Long" label)', () => {
  assert.match(footer, /\$t\('Short story'\)/)
  assert.match(footer, /\$t\('Author'\)/)
  assert.doesNotMatch(footer, /For authors/)
  assert.doesNotMatch(footer, /\$t\('Moovicut Long'\)/)
})

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) { if (!path.endsWith('locales')) walk(path, files) } else if (/\.(vue|js|ts)$/.test(path)) files.push(path)
  }
  return files
}

test('"For authors" is gone from the app: it named /story in the footer and /long in an eyebrow', () => {
  const offenders = walk('app').filter(file => /For authors/.test(read(file)))
  assert.deepEqual(offenders, [])
})

test('page eyebrows match the nav names', () => {
  assert.match(read('app/pages/story.vue'), /<p class="eyebrow">\{\{ \$t\('Short story'\) \}\}<\/p>/)
  assert.match(read('app/pages/long.vue'), /<p class="eyebrow">\{\{ \$t\('Author · Moovicut Long'\) \}\}<\/p>/)
})

test('mode switch CSS: live selector, touch target >= 40, active pill stays readable on hover', () => {
  assert.match(css, /\.site-nav-links \.mode-switch\b/)
  const link = css.match(/\.site-nav-links \.mode-switch a[^{]*\{([^}]*)\}/)
  assert.ok(link && /min-height:\s*(4\d|[5-9]\d)px/.test(link[1]), 'mode links declare min-height >= 40px')
  const active = [...css.matchAll(/\.mode-switch a\[aria-current="page"\][^{]*\{([^}]*)\}/g)].map(match => match[1]).join(' ')
  assert.match(active, /background:\s*var\(--gold\)/)
  assert.match(active, /color:\s*var\(--on-gold\)/)
  assert.match(css, /\.mode-switch a\[aria-current="page"\]:hover/, 'hover keeps the active label readable')
})

test('the new e2e is wired in CI and in test:studio', () => {
  assert.match(read('.github/workflows/ci.yml'), /node tests\/mode-switch\.e2e\.mjs/)
  assert.match(JSON.parse(read('package.json')).scripts['test:studio'], /node tests\/mode-switch\.e2e\.mjs/)
})
