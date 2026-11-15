<script setup>
import { socialPreviewSeo } from '~/utils/social-preview.js'
const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const items = [
  ['What is Moovicut?', 'Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.'],
  ['How does Moovicut work?', '/studio opens a six-step guide: idea, characters, places and style, shots, check, then generate. Advanced mode keeps the full editor. A premise becomes an ordered shot list on this device, with camera, action, lighting, sound, and continuity you can edit. Paste a prompt into the model you already use. Moovicut does not call that model.'],
  ['Does Moovicut render video?', 'No. It writes prompts. Nothing is rendered inside Moovicut.'],
  ['Which models does it support?', 'The home page and the studio list eight prompt targets: Grok Imagine, Google (Veo / Gemini), Sora, Kling, Runway, Luma, Wan, and a generic profile. These names are prompt targets, not included accounts or rendering.'],
  ['Is an account required?', 'No. The storyboard stays in this browser. There is no sign-in.'],
  ['Can I import or export work?', 'Yes. Projects use the shotboard.v1 JSON format. The studio can export a project or a local library backup, and it can import a compatible file. Files stay on your device.'],
  ['Is Moovicut free?', 'Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.'],
  ['Are visits counted?', 'Anonymous, cookieless visit counts via Cloudflare Web Analytics. The site also keeps a simple server-side visit count (POST /api/visits) stored on a persistent volume, with no personal data. Storyboards never leave the device.'],
  ['Can an AI agent build a storyboard?', 'Yes. The default board is 5 scenes of 3 seconds (15s total). Step-by-step mode in /studio, or a shots count or scenes array on POST /api/v1/storyboard and /mcp, builds a custom scene list. Scenario mode and input prose are on the same endpoints. A premise shaped as Name, trait, trait keeps those people and the real actions. Prose that cannot be planned returns 400 and lists what is missing. Open /agents for the endpoints. No API key and no account. Mode ad, series, and explainer are light presets on the same endpoints. The video prompt is short by default (prompt_style short or detailed). Each character has one lock line, copied unchanged into every shot they are in. A shot marked promptEdited is kept when the film sheet, prompt style, style preset, or model changes. Regenerate this shot rebuilds one prompt. Risk warnings never block the board. Quick idea, Step-by-step, continuous story, and scenario share one film sheet. format agent resumes any of them. The model can be Grok Imagine, Veo, Sora, Kling, Runway, Luma, Wan, or a generic profile. Shot length and aspect follow that model’s documented limits.'],
  ['What happens if browser storage is unavailable?', 'The studio reports the failure instead of claiming the save worked. Export JSON if you want a copy outside the browser.']
]
const { t } = useI18n()
useSeoMeta({
  title: computed(() => t('FAQ — Moovicut')),
  description: computed(() => t('Moovicut is a free, local-first storyboard and shot list. No account and no video rendering. Prompts work with Grok Imagine, Google, or any other AI image or video model.')),
  ogTitle: computed(() => t('FAQ — Moovicut')),
  ogDescription: computed(() => t('Moovicut is a free, local-first storyboard and shot list. No account and no video rendering. Prompts work with Grok Imagine, Google, or any other AI image or video model.')),
  twitterTitle: computed(() => t('FAQ — Moovicut')),
  twitterDescription: computed(() => t('Moovicut is a free, local-first storyboard and shot list. No account and no video rendering. Prompts work with Grok Imagine, Google, or any other AI image or video model.')),
  ...socialPreview
})
</script>
<template>
 <div class="site-shell"><AppHeader /><main class="legal-page"><div class="container-docs"><div class="page-intro"><p class="eyebrow">{{ $t('FAQ') }}</p><h1>{{ $t('Questions, answered plainly') }}</h1><p>{{ $t('Free and local. Prompts work with Grok Imagine, Google, or any other AI image or video model.') }}</p></div><section v-for="[question, answer] in items" :key="question" class="legal-section"><h2>{{ $t(question) }}</h2><p>{{ $t(answer) }}</p></section></div></main><SiteFooter /></div>
</template>
