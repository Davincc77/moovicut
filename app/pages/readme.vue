<script setup>
import readme from '../../README.md?raw'
import { socialPreviewSeo } from '~/utils/social-preview.js'
const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const { t } = useI18n()
useSeoMeta({
  title: computed(() => t('Project README — Moovicut')),
  ogTitle: computed(() => t('Project README — Moovicut')),
  description: computed(() => t('This page is the repository README. The raw Markdown file is served at /README.md.')),
  ...socialPreview
})
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs">
  <div class="page-intro"><p class="eyebrow">README</p><h1>{{ $t('Project README') }}</h1><p>{{ $t('This page is the repository README. The raw Markdown file is served at /README.md.') }} <a href="/README.md">{{ $t('Raw README') }}</a></p></div>
  <pre class="readme-source">{{ readme }}</pre>
 </div></main><SiteFooter /></div>
</template>
