<script setup>
import { socialPreviewSeo } from '~/utils/social-preview.js'
const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const { t } = useI18n()
useSeoMeta({
  title: computed(() => t('Credits and licences — Moovicut')),
  ogTitle: computed(() => t('Credits and licences — Moovicut')),
  description: computed(() => t('The place library is a compilation shared under CC BY-SA 4.0. Each source is named on this page.')),
  ...socialPreview
})
const sources = [
  ['Princeton WordNet', 'English place names come from Princeton WordNet 3.0, Princeton University. Licence: https://wordnet.princeton.edu/license-and-commercial-use'],
  ['Open Multilingual Wordnet', 'Portuguese place names are lemmas from Open Multilingual Wordnet 1.4, the compilation of Francis Bond and Kyonghee Paik.'],
  ['OpenWN-PT', 'Portuguese lemmas come from OpenWN-PT. Licence: Creative Commons Attribution-ShareAlike.'],
  ['Video prompt profiles', 'Shot length, aspect, and prompt form for ChatGPT video, Midjourney video, MiniMax Hailuo, ByteDance Seedance, and Pika are cited in docs/model-profiles.md. A limit the provider page does not state uses the generic profile. Sora stays a separate profile.']
]
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs">
  <div class="page-intro"><p class="eyebrow">{{ $t('Credits') }}</p><h1>{{ $t('Credits and licences') }}</h1><p>{{ $t('The place library is a compilation shared under CC BY-SA 4.0. Each source is named on this page.') }}</p></div>
  <section class="legal-section"><h2>{{ $t('The shipped file') }}</h2><p>{{ $t('The file app/data/place-lexicon.json is a compilation. Portuguese names come from OpenWN-PT, which is ShareAlike. The file is therefore distributed under Creative Commons Attribution-ShareAlike 4.0. If you share it or an adaptation, credit the sources and use CC BY-SA 4.0.') }}</p></section>
  <section v-for="[title, body] in sources" :key="title" class="legal-section"><h2>{{ $t(title) }}</h2><p>{{ $t(body) }}</p></section>
 </div></main><SiteFooter /></div>
</template>
