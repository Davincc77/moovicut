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
  ['Open Multilingual Wordnet', 'French, Portuguese, Italian, Japanese, and Chinese place names are lemmas from Open Multilingual Wordnet 1.4, the compilation of Francis Bond and Kyonghee Paik.'],
  ['WOLF', 'French lemmas come from WOLF, the Wordnet Libre du Français. Licence: CeCILL-C.'],
  ['OpenWN-PT', 'Portuguese lemmas come from OpenWN-PT. Licence: Creative Commons Attribution-ShareAlike.'],
  ['MultiWordNet', 'Italian lemmas come from MultiWordNet. Licence: Creative Commons Attribution 3.0.'],
  ['NICT Japanese Wordnet', 'Japanese lemmas come from the Japanese Wordnet of the National Institute of Information and Communications Technology. The licence is WordNet-style and requires attribution.'],
  ['Chinese Open Wordnet', 'Chinese lemmas come from the Chinese Open Wordnet. The licence is WordNet-style.'],
  ['OdeNet', 'German lemmas come from OdeNet 1.3 by Melanie Siegel and Francis Bond. Licence: Creative Commons Attribution-ShareAlike 4.0.']
]
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs">
  <div class="page-intro"><p class="eyebrow">{{ $t('Credits') }}</p><h1>{{ $t('Credits and licences') }}</h1><p>{{ $t('The place library is a compilation shared under CC BY-SA 4.0. Each source is named on this page.') }}</p></div>
  <section class="legal-section"><h2>{{ $t('The shipped file') }}</h2><p>{{ $t('The file app/data/place-lexicon.json is a compilation. Portuguese names come from OpenWN-PT and German names from OdeNet, both ShareAlike. The file is therefore distributed under Creative Commons Attribution-ShareAlike 4.0. If you share it or an adaptation, credit the sources and use CC BY-SA 4.0. French names from WOLF are also available under CeCILL-C.') }}</p></section>
  <section v-for="[title, body] in sources" :key="title" class="legal-section"><h2>{{ $t(title) }}</h2><p>{{ $t(body) }}</p></section>
 </div></main><SiteFooter /></div>
</template>
