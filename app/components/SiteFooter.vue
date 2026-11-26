<script setup>
import { joinAppPath } from '~/utils/urls.js'
import { SOCIAL_X_URL } from '~/config/social.js'
const appBaseURL = useRuntimeConfig().app.baseURL
const pageHref = name => joinAppPath(appBaseURL, name)
const visitTotal = ref(null)
const { t, locale } = useI18n()
const visitLabel = computed(() => {
  if (visitTotal.value == null) return ''
  const count = new Intl.NumberFormat(locale.value).format(visitTotal.value)
  return visitTotal.value === 1 ? t('{count} visit', { count }) : t('{count} visits', { count })
})
function showVisits(total) { if (Number.isInteger(total) && total >= 0) visitTotal.value = total }
function onVisits(event) { showVisits(event.detail) }
onMounted(() => {
  window.addEventListener('moovicut-visits', onVisits)
  if (Number.isInteger(window.__moovicutVisits)) showVisits(window.__moovicutVisits)
})
onBeforeUnmount(() => window.removeEventListener('moovicut-visits', onVisits))
</script>
<template>
 <footer class="site-footer">
  <div class="footer-inner">
   <nav class="footer-bar" :aria-label="$t('Footer')"><p>© 2026 Moovicut</p><a :href="pageHref('playground')">{{ $t('Studio') }}</a><a :href="pageHref('story')">{{ $t('Short story') }}</a><a :href="pageHref('long')">{{ $t('Author') }}</a><a :href="pageHref('faq')">{{ $t('FAQ') }}</a><a :href="pageHref('agents')">{{ $t('Agents') }}</a><a :href="pageHref('credits')">{{ $t('Credits') }}</a><a :href="pageHref('privacy')">{{ $t('Privacy') }}</a><a :href="pageHref('terms')">{{ $t('Terms') }}</a><a :href="pageHref('content-policy')">{{ $t('Content policy') }}</a><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener">{{ $t('Tips') }}</a><span class="footer-tip-note">{{ $t('Tips pay for hosting and keep Moovicut free.') }}</span><a v-if="SOCIAL_X_URL" :href="SOCIAL_X_URL" target="_blank" rel="noopener">{{ $t("Follow on X (it's free!)") }}</a><a href="https://github.com/Davincc77/moovicut" target="_blank" rel="noopener" :aria-label="$t('Moovicut on GitHub')">GitHub</a><p v-if="visitLabel" class="footer-visits">{{ visitLabel }}</p></nav><p class="footer-disclaimer">{{ $t('Moovicut is an independent storyboard and prompt tool. It is not affiliated with, endorsed by, or sponsored by xAI, Grok, Google, OpenAI, DeepSeek, or any other AI company.') }}</p>
  </div>
 </footer>
</template>
