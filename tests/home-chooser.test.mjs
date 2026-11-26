/** The home asks the project first (idea / story / book); the old home is the Studio playground. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(file, 'utf8')
const home = read('app/pages/index.vue')
const playground = read('app/pages/playground.vue')

test('home: one question, three doors in size order, each to its own page', () => {
  assert.match(home, /\$t\('What are you making\?'\)/)
  const targets = [...home.matchAll(/\bto: '(\/[a-z]+)'/g)].map(match => match[1])
  assert.deepEqual(targets, ['/playground', '/story', '/long'])
  for (const title of ['I have an idea', 'I have a story', 'I’m writing a book']) assert.ok(home.includes(`t('${title}')`), title)
  assert.match(home, /class="mode-ruler"/)
})

test('home: thresholds come from the constants /story enforces, never retyped', () => {
  assert.match(home, /STORY_MIN_CHARS/)
  assert.match(home, /SCENARIO_MAX_CHARS/)
  assert.doesNotMatch(home, /\b600\b|8,000|8000/)
})

test('home no longer hosts the composer; the playground keeps it, with the way out', () => {
  assert.doesNotMatch(home, /hero-premise|premise-composer|genre-grid/)
  assert.match(playground, /id="hero-premise"/)
  assert.match(playground, /class="genre-grid"|genre-grid/)
  assert.match(playground, /I have an idea — Moovicut/)
  assert.match(playground, /to="\/studio"[^>]*>\{\{ \$t\('Already working on a project\? Open the Studio'\) \}\}/)
  assert.match(playground, /id="wrong-door-title"/)
  assert.match(playground, /to="\/story"/)
  assert.match(playground, /to="\/long"/)
})

test('home keeps the visit-count promise and the not-a-renderer promise', () => {
  assert.match(home, /no personal data and no third-party analytics/)
  assert.match(home, /It does not render a clip/)
})

test('sitemap and prerender list every mode page, playground included', () => {
  const sitemap = read('public/sitemap.xml')
  for (const route of ['playground', 'story', 'long', 'studio']) assert.match(sitemap, new RegExp(`https://moovicut\\.studio/${route}</loc>`), route)
  const config = read('nuxt.config.ts')
  for (const route of ["'/playground'", "'/story'", "'/long'"]) assert.ok(config.includes(route), route)
})

test('the home e2e is wired in CI and in test:studio', () => {
  assert.match(read('.github/workflows/ci.yml'), /node tests\/home-chooser\.e2e\.mjs/)
  assert.match(JSON.parse(read('package.json')).scripts['test:studio'], /node tests\/home-chooser\.e2e\.mjs/)
})
