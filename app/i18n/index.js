import en from './locales/en.json' with { type: 'json' }
import zhHans from './locales/zh-Hans.json' with { type: 'json' }
import pt from './locales/pt.json' with { type: 'json' }
import ja from './locales/ja.json' with { type: 'json' }
import fr from './locales/fr.json' with { type: 'json' }
import de from './locales/de.json' with { type: 'json' }
import it from './locales/it.json' with { type: 'json' }
import { createI18n, trustedCatalogHtml } from './logic.js'

const catalogs = { en, 'zh-Hans': zhHans, pt, ja, fr, de, it }
const i18n = createI18n(catalogs)

export function translate(locale, message, params) {
  return i18n.translate(locale, message, params)
}

export function translateHtml(locale, message, params) {
  return trustedCatalogHtml(i18n.translate(locale, message, params))
}

export { catalogs }
