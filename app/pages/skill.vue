<script setup>
import skill from '../../SKILL.md?raw'
import { socialPreviewSeo } from '~/utils/social-preview.js'
const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const { t } = useI18n()
useSeoMeta({
  title: computed(() => t('Agent skill — Moovicut')),
  ogTitle: computed(() => t('Agent skill — Moovicut')),
  description: computed(() => t('This page is the agent skill. The raw Markdown file is served at /SKILL.md.')),
  ...socialPreview
})
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs">
  <div class="page-intro"><p class="eyebrow">SKILL</p><h1>{{ $t('Agent skill — Moovicut') }}</h1><p>{{ $t('This page is the agent skill. The raw Markdown file is served at /SKILL.md.') }} <a href="/SKILL.md">{{ $t('Raw skill') }}</a></p></div>
  <pre class="readme-source">{{ skill }}</pre>
 </div></main><SiteFooter /></div>
</template>
