import { translate, translateHtml } from '~/i18n/index.js'
import { LOCALES, STORAGE_KEY, htmlLang, isLocale, resolveLocale } from '~/i18n/logic.js'

let booted = false

export function useI18n() {
  const locale = useState('moovicut-locale', () => 'en')
  const route = useRoute()
  const router = useRouter()

  function t(message, params) {
    return translate(locale.value, message, params)
  }
  function th(message, params) {
    return translateHtml(locale.value, message, params)
  }
  function remember(code) {
    if (!import.meta.client) return
    try { localStorage.setItem(STORAGE_KEY, code) } catch { /* private mode */ }
    document.documentElement.lang = htmlLang(code)
  }
  function apply(code, { persist = true } = {}) {
    const next = isLocale(code) ? code : 'en'
    locale.value = next
    if (persist) remember(next)
    else if (import.meta.client) document.documentElement.lang = htmlLang(next)
    return next
  }
  function boot() {
    if (booted || !import.meta.client) return
    booted = true
    const initial = resolveLocale({
      query: route.query.lang,
      stored: (() => { try { return localStorage.getItem(STORAGE_KEY) } catch { return '' } })(),
      navigatorLanguages: navigator.languages?.length ? [...navigator.languages] : [navigator.language]
    })
    apply(initial)
    watch(() => route.query.lang, value => {
      if (!isLocale(value) || value === locale.value) return
      apply(value)
    })
  }
  function setLocale(code) {
    const next = apply(isLocale(code) ? code : 'en')
    const query = { ...route.query }
    if (next === 'en') delete query.lang
    else query.lang = next
    return router.replace({ path: route.path, query, hash: route.hash })
  }
  return { locale, locales: LOCALES, t, th, boot, setLocale, htmlLang }
}
