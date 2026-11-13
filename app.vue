<script setup>
import { socialPreviewMeta } from '~/utils/social-preview.js'
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
useHead(() => {
  const path = route.path === '/' ? '/' : String(route.path || '/').replace(/\/+$/, '') || '/'
  const url = `https://moovicut.studio${path.startsWith('/') ? path : `/${path}`}`
  const origin = runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl
  return {
    link: [{ rel: 'canonical', href: url }],
    meta: [
      { property: 'og:url', content: url },
      ...socialPreviewMeta(origin, runtimeConfig.app.baseURL)
    ]
  }
})
</script>
<template>
  <div class="shotboard-app"><NuxtLoadingIndicator color="#d4a054" :height="2" />
  <NuxtPage /></div>
</template>
