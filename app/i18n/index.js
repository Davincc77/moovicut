import { createRequire } from 'node:module'

// Same JSON loading as place-lexicon.js: createRequire for Node, rewritten to a plain import by Vite.
const require = createRequire(import.meta.url)
const en = require('./locales/en.json')
const zhHans = require('./locales/zh-Hans.json')
const pt = require('./locales/pt.json')
import { createI18n, trustedCatalogHtml } from './logic.js'

const catalogs = { en, 'zh-Hans': zhHans, pt }
const i18n = createI18n(catalogs)

export function translate(locale, message, params) {
  return i18n.translate(locale, message, params)
}

export function translateHtml(locale, message, params) {
  return trustedCatalogHtml(i18n.translate(locale, message, params))
}

export { catalogs }
