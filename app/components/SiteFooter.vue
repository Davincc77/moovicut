<script setup>
import { joinAppPath } from '~/utils/urls.js'
import { SOCIAL_X_URL } from '~/config/social.js'
const appBaseURL = useRuntimeConfig().app.baseURL
const pageHref = name => joinAppPath(appBaseURL, name)
const visitTotal = ref(null)
const visitLabel = computed(() => visitTotal.value == null ? '' : `${new Intl.NumberFormat('en').format(visitTotal.value)} ${visitTotal.value === 1 ? 'visit' : 'visits'}`)
function showVisits(total) { if (Number.isInteger(total) && total >= 0) visitTotal.value = total }
function onVisits(event) { showVisits(event.detail) }
onMounted(async () => {
  window.addEventListener('moovicut-visits', onVisits)
  try {
    const response = await fetch(joinAppPath(appBaseURL, 'api/visits'), { credentials: 'omit' })
    const type = response.headers.get('content-type') || ''
    if (response.ok && type.includes('application/json')) showVisits((await response.json()).total)
  } catch { /* The counter stays hidden when this host has no visit service. */ }
})
onBeforeUnmount(() => window.removeEventListener('moovicut-visits', onVisits))
</script>
<template>
 <footer class="site-footer">
  <div class="footer-inner">
   <nav class="footer-bar" aria-label="Footer"><p>© 2026 Moovicut</p><a :href="pageHref('studio')">Studio</a><a :href="pageHref('faq')">FAQ</a><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener">Tips</a><span class="footer-tip-note">Tips pay for hosting and keep Moovicut free.</span><a v-if="SOCIAL_X_URL" :href="SOCIAL_X_URL" target="_blank" rel="noopener">Follow on X (it's free!)</a><a href="https://github.com/Davincc77/Shortboard" target="_blank" rel="noopener" aria-label="Moovicut on GitHub">GitHub</a><p v-if="visitLabel" class="footer-visits">{{ visitLabel }}</p></nav><p class="footer-disclaimer">Moovicut is an independent storyboard and prompt tool. It is not affiliated with, endorsed by, or sponsored by xAI, Grok, Google, OpenAI, DeepSeek, or any other AI company.</p>
  </div>
 </footer>
</template>
