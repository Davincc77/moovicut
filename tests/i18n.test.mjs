import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { collectKeys } from '../app/i18n/collect-keys.js'
import { LOCALES, createI18n, resolveLocale, matchLanguageTag, hreflangEntries, htmlLang } from '../app/i18n/logic.js'

const codes = LOCALES.map(item => item.code)

function catalog(code) {
  return JSON.parse(readFileSync(`app/i18n/locales/${code}.json`, 'utf8'))
}

test('en.json and pt.json have identical key sets', () => {
  const english = Object.keys(catalog('en')).sort()
  const portuguese = Object.keys(catalog('pt')).sort()
  assert.deepEqual(portuguese, english)
})

test('every language catalog has exactly the English keys', () => {
  const english = catalog('en')
  const expected = collectKeys()
  assert.deepEqual(Object.keys(english).sort(), expected)
  for (const code of codes) {
    const keys = Object.keys(catalog(code)).sort()
    assert.deepEqual(keys, expected, code)
    for (const key of keys) {
      assert.equal(typeof catalog(code)[key], 'string', `${code} ${key}`)
      assert.ok(catalog(code)[key].length > 0, `${code} empty ${key}`)
    }
  }
})

test('translations keep placeholders and are not a copy of English', () => {
  const english = catalog('en')
  const names = key => [...key.matchAll(/\{([A-Za-z]+)\}/g)].map(match => match[1]).sort()
  for (const code of codes) {
    if (code === 'en') continue
    const messages = catalog(code)
    let same = 0
    for (const [key, value] of Object.entries(english)) {
      assert.equal(english[key], key, key)
      assert.deepEqual(names(messages[key]), names(key), `${code} ${key}`)
      if (messages[key] === key) same += 1
    }
    assert.ok(same < Object.keys(english).length * 0.45, `${code} left ${same} strings in English`)
  }
})

test('legal pages, shot chrome, inspiration, and scenario examples are catalog keys', () => {
  const keys = new Set(collectKeys())
  const english = catalog('en')
  const portuguese = catalog('pt')
  const surfaces = [
    'Privacy, in plain language',
    'Your story belongs to you. Moovicut is local-first by design.',
    'A fair agreement for your creative work',
    'Make something worth sharing',
    'Page not found',
    'This address is not part of Moovicut.',
    'Opening',
    'Establish the world',
    'Meet the protagonist',
    'An apprentice astronaut crosses a silent space station to recover a paper star map.',
    'Automatic reading of this language is uncertain. Check the names, places, and actions.',
    'Léa — curly hair, round glasses — green apron',
    'Café — a small morning cafe',
    'Scene 1 — Lea — Cafe — She pours a latte',
    'Create a storyboard before applying a style preset.',
    'Front reference',
    '{name} reference image, {slot}'
  ]
  for (const key of surfaces) {
    assert.equal(keys.has(key), true, key)
    assert.equal(english[key], key, key)
    assert.notEqual(portuguese[key], key, `${key} is still English in Portuguese`)
  }
  assert.equal(portuguese.Genre, 'Género')
  const gallery = readFileSync('app/components/StudioLandingGallery.vue', 'utf8')
  assert.match(gallery, /\$t\(study\.caption \|\| study\.title\)/)
  assert.doesNotMatch(gallery, /\{\{\s*study\.title\s*\}\}/)
  const scenario = readFileSync('app/components/StudioScenario.vue', 'utf8')
  assert.doesNotMatch(scenario, /placeholder="[^$]/)
  const cards = readFileSync('app/components/ShotCard.vue', 'utf8')
  assert.match(cards, /\{\{\s*\$t\(shot\.title\)\s*\}\}/)
  const editor = readFileSync('app/components/StudioEditor.vue', 'utf8')
  assert.match(editor, /\$t\(activeShot\.stage\)/)
  for (const value of Object.values(portuguese)) {
    assert.doesNotMatch(value, /\b(você|Você|Salvar|Excluir|gênero|baixar)\b/)
  }
})

test('the language switcher renders the native names', async () => {
  const source = readFileSync('app/components/LanguageSwitcher.vue', 'utf8')
  assert.match(source, /v-for="item in LOCALES"/)
  assert.match(source, /item\.native/)
  assert.match(source, /setLocale/)
  const { descriptor } = parse(source, { filename: 'LanguageSwitcher.vue' })
  const compiled = compileScript(descriptor, { id: 'language-switcher' })
  const result = compileTemplate({
    id: 'language-switcher',
    filename: 'LanguageSwitcher.vue',
    source: descriptor.template.content,
    compilerOptions: { bindingMetadata: compiled.bindings }
  })
  assert.deepEqual(result.errors, [])
  const natives = ['English', 'Português']
  assert.deepEqual(LOCALES.map(item => item.code), ['en', 'pt'])
  assert.deepEqual(LOCALES.map(item => item.native), natives)
  const app = createSSRApp({
    setup() {
      return () => h('select', { 'aria-label': 'Language' }, LOCALES.map(item => h('option', { value: item.code, lang: item.htmlLang }, item.native)))
    }
  })
  const html = await renderToString(app)
  for (const name of natives) assert.match(html, new RegExp(`>${name}<`))
  assert.equal((html.match(/<option\b/g) || []).length, 2)
  assert.doesNotMatch(html, /Français|日本語|Italiano/)
})

test('locale choice uses the query, then storage, then the browser, then English', () => {
  assert.equal(resolveLocale({ query: 'pt', stored: 'de', navigatorLanguages: ['ja'] }), 'pt')
  assert.equal(resolveLocale({ query: 'nope', stored: 'lb', navigatorLanguages: ['it'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: ['zh-CN', 'en-US'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: ['zh-TW'] }), 'en')
  assert.equal(matchLanguageTag('zh-Hans'), '')
  assert.equal(matchLanguageTag('zh-CN'), '')
  assert.equal(resolveLocale({ navigatorLanguages: ['pt-BR'] }), 'pt')
  assert.equal(resolveLocale({ query: 'de', stored: 'fr', navigatorLanguages: ['it'] }), 'en')
  assert.equal(resolveLocale({ query: 'fr', stored: 'ja', navigatorLanguages: ['it'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: ['de-LU', 'lb'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: ['de', 'it'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: ['fr-FR', 'en'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: ['ja-JP', 'pt'] }), 'pt')
  assert.equal(resolveLocale({ navigatorLanguages: ['lb-LU'] }), 'en')
  assert.equal(resolveLocale({ navigatorLanguages: [] }), 'en')
  assert.equal(matchLanguageTag('ja-JP'), '')
  assert.equal(matchLanguageTag('fr'), '')
  assert.equal(matchLanguageTag('it-IT'), '')
  assert.equal(htmlLang('zh-Hans'), 'en')
  const links = hreflangEntries({ origin: 'https://moovicut.studio', path: '/faq', search: '?lang=pt&ref=1' })
  assert.equal(links[0].hreflang, 'x-default')
  assert.equal(links[0].href, 'https://moovicut.studio/faq?ref=1')
  assert.equal(links.find(item => item.hreflang === 'pt').href, 'https://moovicut.studio/faq?ref=1&lang=pt')
  assert.equal(links.find(item => item.hreflang === 'zh-Hans'), undefined)
  assert.equal(links.find(item => item.hreflang === 'de'), undefined)
  assert.equal(links.find(item => item.hreflang === 'fr'), undefined)
  assert.equal(links.find(item => item.hreflang === 'ja'), undefined)
  assert.equal(links.find(item => item.hreflang === 'it'), undefined)
  assert.equal(links.length, 3)
})
