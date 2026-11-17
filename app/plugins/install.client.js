import { joinAppPath } from '~/utils/urls.js'

/** Register the install worker in production only. Dev keeps Nuxt's own assets. */
export default defineNuxtPlugin(() => {
  if (!import.meta.client || import.meta.dev) return
  if (!('serviceWorker' in navigator)) return
  const base = useRuntimeConfig().app.baseURL || '/'
  const scope = base.endsWith('/') ? base : `${base}/`
  navigator.serviceWorker.register(joinAppPath(base, 'sw.js'), { scope }).catch(() => {})
})
