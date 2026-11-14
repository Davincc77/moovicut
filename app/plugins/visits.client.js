import { joinAppPath } from '~/utils/urls.js'

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const baseURL = useRuntimeConfig().app.baseURL
  router.afterEach(to => {
    const url = joinAppPath(baseURL, 'api/visits')
    fetch(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: to.path || '/', referrer: document.referrer || '' })
    }).then(async response => {
      const type = response.headers.get('content-type') || ''
      if (!response.ok || !type.includes('application/json')) return
      const body = await response.json()
      if (typeof body.total === 'number') {
        window.__moovicutVisits = body.total
        window.dispatchEvent(new CustomEvent('moovicut-visits', { detail: body.total }))
      }
    }).catch(() => {})
  })
})
