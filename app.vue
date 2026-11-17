<script setup>
import { socialPreviewMeta } from '~/utils/social-preview.js'
import { hreflangEntries, htmlLang } from '~/i18n/logic.js'
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const { locale, boot } = useI18n()
boot()
useHead(() => {
  const path = route.path === '/' ? '/' : String(route.path || '/').replace(/\/+$/, '') || '/'
  const origin = 'https://moovicut.studio'
  const search = new URLSearchParams()
  Object.entries(route.query).forEach(([key, value]) => {
    if (value == null || key === 'lang') return
    search.set(key, Array.isArray(value) ? String(value[0]) : String(value))
  })
  if (locale.value !== 'en') search.set('lang', locale.value)
  const query = search.toString()
  const url = `${origin}${path}${query ? `?${query}` : ''}`
  const previewOrigin = runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl
  return {
    htmlAttrs: { lang: htmlLang(locale.value) },
    link: [
      { rel: 'canonical', href: url },
      ...hreflangEntries({ origin, path, search: route.fullPath.includes('?') ? route.fullPath.slice(route.fullPath.indexOf('?')) : '' })
    ],
    meta: [
      { property: 'og:url', content: url },
      ...socialPreviewMeta(previewOrigin, runtimeConfig.app.baseURL)
    ]
  }
})
</script>
<template>
  <div class="moovicut-app"><NuxtLoadingIndicator color="#f0b429" :height="2" />
  <NuxtPage /></div>
</template>
