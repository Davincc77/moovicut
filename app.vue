<script setup>
const route = useRoute()
useHead(() => {
  const path = route.path === '/' ? '/' : String(route.path || '/').replace(/\/+$/, '') || '/'
  const url = `https://moovicut.studio${path.startsWith('/') ? path : `/${path}`}`
  return {
    link: [{ rel: 'canonical', href: url }],
    meta: [{ property: 'og:url', content: url }]
  }
})
</script>
<template>
  <div class="moovicut-app"><NuxtLoadingIndicator color="#d4a054" :height="2" />
  <NuxtPage /></div>
</template>
