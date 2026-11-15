/** Locale resolution and catalog lookup. English keys are the source of truth. */

export const STORAGE_KEY = 'moovicut.language'

export const LOCALES = Object.freeze([
  { code: 'en', htmlLang: 'en', native: 'English' },
  { code: 'zh-Hans', htmlLang: 'zh-Hans', native: '中文' },
  { code: 'pt', htmlLang: 'pt', native: 'Português' },
  { code: 'ja', htmlLang: 'ja', native: '日本語' },
  { code: 'fr', htmlLang: 'fr', native: 'Français' },
  { code: 'de', htmlLang: 'de', native: 'Deutsch' },
  { code: 'lb', htmlLang: 'lb', native: 'Lëtzebuergesch' },
  { code: 'it', htmlLang: 'it', native: 'Italiano' }
])

const CODES = new Set(LOCALES.map(item => item.code))

export function isLocale(value) {
  return CODES.has(String(value || ''))
}

export function htmlLang(code) {
  return LOCALES.find(item => item.code === code)?.htmlLang || 'en'
}

/** Best catalog for a BCP 47 tag. Traditional Chinese is not offered, so it does not match. */
export function matchLanguageTag(tag) {
  const value = String(tag || '').trim().toLowerCase().replace(/_/g, '-')
  if (!value) return ''
  if (value === 'zh-hans' || value.startsWith('zh-hans-') || value === 'zh-cn' || value.startsWith('zh-cn-') || value === 'zh-sg' || value.startsWith('zh-sg-') || value === 'zh') return 'zh-Hans'
  if (value.startsWith('pt')) return 'pt'
  if (value.startsWith('ja')) return 'ja'
  if (value.startsWith('fr')) return 'fr'
  if (value.startsWith('de')) return 'de'
  if (value.startsWith('lb')) return 'lb'
  if (value.startsWith('it')) return 'it'
  if (value.startsWith('en')) return 'en'
  return ''
}

export function matchNavigator(languages) {
  const list = Array.isArray(languages) ? languages : [languages]
  for (const tag of list) {
    const code = matchLanguageTag(tag)
    if (code) return code
  }
  return 'en'
}

/** Query wins, then a stored choice, then the browser languages, then English. */
export function resolveLocale({ query, stored, navigatorLanguages } = {}) {
  if (isLocale(query)) return String(query)
  if (isLocale(stored)) return String(stored)
  return matchNavigator(navigatorLanguages)
}

function applyParams(template, params) {
  return String(template).replace(/\{([A-Za-z]+)\}/g, (token, name) => (
    params && params[name] != null ? String(params[name]) : token
  ))
}

function compilePatterns(catalog) {
  return Object.keys(catalog)
    .filter(key => key.includes('{'))
    .map(key => {
      const names = []
      const body = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{([A-Za-z]+)\\\}/g, (_, name) => {
        names.push(name)
        return '([\\s\\S]+?)'
      })
      return { key, names, regex: new RegExp(`^${body}$`) }
    })
    .sort((left, right) => right.key.length - left.key.length)
}

export function createI18n(catalogs) {
  const english = catalogs.en || {}
  const patterns = new Map(Object.entries(catalogs).map(([code, catalog]) => [code, compilePatterns(catalog)]))
  function lookup(locale, message) {
    const catalog = catalogs[locale] || english
    if (Object.prototype.hasOwnProperty.call(catalog, message)) return catalog[message]
    if (locale !== 'en' && Object.prototype.hasOwnProperty.call(english, message)) return english[message]
    const list = patterns.get(locale) || patterns.get('en') || []
    for (const pattern of list) {
      const match = pattern.regex.exec(message)
      if (!match) continue
      const params = {}
      pattern.names.forEach((name, index) => { params[name] = match[index + 1] })
      const template = Object.prototype.hasOwnProperty.call(catalog, pattern.key) ? catalog[pattern.key] : english[pattern.key]
      if (template) return applyParams(template, params)
    }
    return message
  }
  function translate(locale, message, params) {
    const text = message == null ? '' : String(message)
    if (!text) return ''
    const code = isLocale(locale) ? locale : 'en'
    if (params) {
      const catalog = catalogs[code] || english
      const template = Object.prototype.hasOwnProperty.call(catalog, text)
        ? catalog[text]
        : (Object.prototype.hasOwnProperty.call(english, text) ? english[text] : text)
      return applyParams(template, params)
    }
    return lookup(code, text)
  }
  return { translate }
}

export function hreflangEntries({ origin = 'https://moovicut.studio', path = '/', search = '' } = {}) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  params.delete('lang')
  const base = params.toString()
  const normalized = path === '/' ? '/' : `/${String(path || '/').replace(/^\/+|\/+$/g, '')}`
  function href(code) {
    const next = new URLSearchParams(base)
    if (code !== 'en') next.set('lang', code)
    const query = next.toString()
    return `${origin}${normalized}${query ? `?${query}` : ''}`
  }
  return [
    { rel: 'alternate', hreflang: 'x-default', href: href('en') },
    ...LOCALES.map(item => ({ rel: 'alternate', hreflang: item.htmlLang, href: href(item.code) }))
  ]
}

const ALLOWED_TAGS = /^(?:code|strong|em|a|br)$/i

/** Catalog HTML may use code, strong, em, a, and br. Anything else is escaped. */
export function trustedCatalogHtml(value) {
  return String(value || '').replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (tag, name) => (
    ALLOWED_TAGS.test(name) ? tag : tag.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  ))
}
