<script setup>
import { ArrowRight, BookOpen, Film, Lightbulb, Library, Pencil, Clapperboard } from 'lucide-vue-next'
import { SCENE_STILLS, stillSrc, stillSrcSet } from '~/utils/reference-content.js'
import { joinAppPath } from '~/utils/urls.js'
import { socialPreviewSeo } from '~/utils/social-preview.js'
import { SCENARIO_MAX_CHARS, STORY_MIN_CHARS } from '~/utils/scenario.js'
const { t, locale } = useI18n()
const runtimeConfig = useRuntimeConfig()
const appBaseURL = runtimeConfig.app.baseURL
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, appBaseURL)

// One home, one question: how big is your project? The thresholds come from the same constants /story enforces.
const format = computed(() => new Intl.NumberFormat(locale.value))
const sizes = computed(() => ({ min: format.value.format(STORY_MIN_CHARS), max: format.value.format(SCENARIO_MAX_CHARS) }))
const modes = computed(() => [
  { id: 'studio', to: '/playground', number: '01', icon: Lightbulb, label: t('Studio'), badge: t('Free · live'), title: t('I have an idea'),
    text: t('A sentence or a paragraph. Play with shots, cameras and prompts in a local playground — everything is editable.'),
    size: t('One sentence to a paragraph'), extra: t('6 guided steps'), cta: t('Open the Studio'), primary: true },
  { id: 'story', to: '/story', number: '02', icon: BookOpen, label: t('Short story'), badge: t('Free · live'), title: t('I have a story'),
    text: t('Paste a finished short story. Every shot tells you which of your sentences it came from.'),
    size: t('{min} – {max} characters', sizes.value), extra: t('Instant audited draft'), cta: t('Paste my story'), primary: true },
  { id: 'author', to: '/long', number: '03', icon: Library, label: t('Author'), badge: t('Early access'), title: t('I’m writing a book'),
    text: t('The whole manuscript, offline on your desktop: chapter map, cast registry, manga and webtoon layouts, audited panels.'),
    size: t('Full novel'), extra: t('Moovicut Long · desktop app'), cta: t('See the Author project'), primary: false }
])
const heroOrder = [0, 2, 3, 1]
const heroImages = heroOrder.map(index => ({ src: stillSrc(index, 'webp'), srcset: stillSrcSet(index), fallback: stillSrc(index, 'jpg'), alt: SCENE_STILLS[index].alt, caption: SCENE_STILLS[index].caption }))
const process = [{icon:Pencil,title:'Idea',text:'One sentence is enough. It stays in this browser.'},{icon:Film,title:'Shots',text:'The idea becomes an editable list with a camera for each shot.'},{icon:Clapperboard,title:'Paste',text:'Paste a prompt into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render the clip.'}]
const faqs = [
 ['What is Moovicut?','Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.'],
 ['Is Moovicut free?','Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.'],
 ['Are visits counted?','The site keeps a simple server-side visit count (POST /api/visits) stored on a persistent volume, with no personal data and no third-party analytics. Storyboards never leave the device.'],
 ['Does Moovicut render video?','No. It writes prompts. Nothing is rendered inside Moovicut.']
]
const description = computed(() => t('Pick the size of your project — an idea, a short story or a whole book — and get a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.'))
useSeoMeta({
  title: computed(() => t('Moovicut — local storyboard studio')),
  ogTitle: computed(() => t('Moovicut — local storyboard studio')),
  twitterTitle: computed(() => t('Moovicut — local storyboard studio')),
  description,
  ogDescription: description,
  twitterDescription: description,
  ...socialPreview
})
</script>
<template><div class="site-shell"><AppHeader /><main id="main-content" class="site-main">
  <section class="hero-section chooser-hero" aria-labelledby="hero-title"><div class="hero-container"><div class="hero-copy"><p class="eyebrow-pill">{{ $t('Free · Local · No account') }}</p><h1 id="hero-title">{{ $t('What are you making?') }}</h1><p class="hero-subtitle">{{ $t('Pick the size of your project. Moovicut turns it into shots and prompts you paste into Grok Imagine, Google, or any other AI image or video model. It does not render a clip, and nothing leaves your browser.') }}</p></div></div></section>
  <section class="section chooser-section" :aria-label="$t('Choose your project size')"><div class="container-wide">
    <ul class="mode-cards"><li v-for="mode in modes" :key="mode.id"><article class="mode-card" :data-mode="mode.id">
      <span class="mode-badge" :class="{ 'mode-badge-live': mode.primary }">{{ mode.badge }}</span>
      <p class="mode-number"><component :is="mode.icon" :size="18" aria-hidden="true" /> {{ mode.number }} · {{ mode.label }}</p>
      <h2>{{ mode.title }}</h2><p class="mode-text">{{ mode.text }}</p>
      <p class="mode-meta"><strong>{{ mode.size }}</strong> · {{ mode.extra }}</p>
      <NuxtLink :to="mode.to" class="button mode-cta" :class="mode.primary ? 'button-primary' : 'button-secondary'">{{ mode.cta }} <ArrowRight :size="16" /></NuxtLink>
    </article></li></ul>
    <div class="mode-ruler" role="group" :aria-label="$t('Project size')"><div class="mode-ruler-bar" aria-hidden="true"><span></span><span></span><span></span></div>
      <ol class="mode-ruler-ticks"><li><strong>{{ $t('Idea') }}</strong> · {{ $t('under {min} characters', sizes) }}</li><li><strong>{{ $t('Story') }}</strong> · {{ $t('{min} – {max}', sizes) }}</li><li><strong>{{ $t('Book') }}</strong> · {{ $t('over {max} characters', sizes) }}</li></ol>
      <p class="mode-ruler-note">{{ $t('Not sure which door? Count the characters — the size decides.') }}</p></div>
  </div></section>
  <section class="section"><div class="container-medium"><header class="section-heading"><h2>{{ $t('How it works') }}</h2><p>{{ $t('Three steps from an idea to a prompt you can paste.') }}</p></header><ol class="process-grid" :aria-label="$t('How it works')"><li v-for="(item,index) in process" :key="item.title"><span class="process-number">0{{index+1}}</span><component :is="item.icon" :size="22" /><h3>{{ $t(item.title) }}</h3><p>{{ $t(item.text) }}</p></li></ol>
    <div class="scene-collage hero-story-strip" :aria-label="$t('Movie still examples')"><figure v-for="image in heroImages" :key="image.src" class="hero-still"><picture><source :srcset="joinAppPath(appBaseURL,image.srcset)" sizes="(max-width: 767px) 46vw, 22vw" type="image/webp" /><img :src="joinAppPath(appBaseURL,image.fallback)" :alt="$t(image.alt)" width="400" height="533" loading="lazy" decoding="async" /></picture><figcaption>{{ $t(image.caption) }}</figcaption></figure></div></div></section>
  <section class="section faq-section section-alt" id="faq"><div class="container-faq"><header class="section-heading"><h2>{{ $t('Frequently asked questions') }}</h2><p>{{ $t('Everything directors ask before their first scene.') }}</p></header><div class="faq-list"><FaqDisclosure v-for="[question,answer] in faqs" :key="question" :question="question" :answer="answer" /></div><p class="faq-more"><NuxtLink to="/faq" class="text-link">{{ $t('FAQ') }} <ArrowRight :size="14" /></NuxtLink></p></div></section>
</main><SiteFooter /></div></template>
