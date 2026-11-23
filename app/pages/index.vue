<script setup>
import { ArrowRight, Clapperboard, Film, Pencil } from 'lucide-vue-next'
import { MODEL_OPTIONS, SCENE_STUDIES } from '~/utils/prompt-engine.js'
import { SCENE_STILLS, stillSrc, stillSrcSet } from '~/utils/reference-content.js'
import { joinAppPath } from '~/utils/urls.js'
import { saveStudioHandoff } from '~/utils/studio-handoff.js'
import { buildPreview } from '~/utils/home-preview.js'
import { socialPreviewSeo } from '~/utils/social-preview.js'
const store = useProjectStore()
const { t } = useI18n()
const router = useRouter()
const { notify, copyText } = useNotifier()
const runtimeConfig = useRuntimeConfig()
const appBaseURL = runtimeConfig.app.baseURL
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, appBaseURL)
const languageHint = ref(false)
const premise = ref('')
const heroModel = ref('grok')
const genre = ref('action')
const preview = ref({ ok: false, shots: [] })
let previewTimer = null
const moreLabel = computed(() => {
  const n = preview.value.more || 0
  return n === 1 ? t('{more} more shot in the studio', { more: n }) : t('{more} more shots in the studio', { more: n })
})
watch([premise, heroModel], () => {
  if (import.meta.server) return
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => { preview.value = buildPreview(premise.value, heroModel.value) }, 350)
})
function gallerySrc(file, extension = 'webp') { return `media/${file}.${extension === 'jpg' ? 'jpg' : 'webp'}` }
const heroOrder = [0, 2, 3, 1]
const heroImages = heroOrder.map(index => ({ src: stillSrc(index, 'webp'), srcset: stillSrcSet(index), fallback: stillSrc(index, 'jpg'), alt: SCENE_STILLS[index].alt, caption: SCENE_STILLS[index].caption }))
const genrePremises = {
  action: 'A courier sprints across a failing bridge while a pursuit closes from behind, handheld camera and hard cuts.',
  drama: 'Two estranged sisters sit in a quiet kitchen after the funeral, soft window light and almost no words.',
  scifi: 'An apprentice astronaut guides a damaged capsule home using only a paper star map.',
  horror: 'A night archivist hears a locked drawer slide open by itself in an empty records room.',
  comedy: 'A llama causes chaos during a cozy mountain picnic, playful timing and warm golden-hour light.',
  romance: 'Two old friends meet again on a rainy station platform and nearly say what they have meant for years.',
  thriller: 'A night clerk realizes the last guest never left, and the hallway lights go out one by one.',
  documentary: 'A lighthouse keeper talks through the morning checklist while the camera stays on the work.'
}
const genres = [
  {id:'action',name:'Action',icon:'Zap',detail:'High-octane set pieces'},
  {id:'drama',name:'Drama',icon:'Drama',detail:'Human stakes & emotion'},
  {id:'scifi',name:'Sci-Fi',icon:'Orbit',detail:'Futuristic worlds'},
  {id:'horror',name:'Horror',icon:'Eye',detail:'Atmospheric dread'},
  {id:'comedy',name:'Comedy',icon:'Smile',detail:'Timing & lightness'},
  {id:'romance',name:'Romance',icon:'Heart',detail:'Intimate connection'},
  {id:'thriller',name:'Thriller',icon:'Sword',detail:'Suspense & tension'},
  {id:'documentary',name:'Documentary',icon:'Video',detail:'Observational realism'}
].map(item => ({ ...item, premise: genrePremises[item.id] }))
const referenceStudyNames = SCENE_STUDIES
const examples = [
 {name:'Neon-noir chase',premise:'A detective chases a suspect through a rain-soaked neon city at night.'},
 {name:'Golden-hour drama',premise:'Two estranged friends reunite in a cozy countryside kitchen during golden hour, gentle camera movement and warm natural light.'},
 {name:'Sci-fi corridor',premise:'An astronaut crosses an endless futuristic corridor, atmospheric lighting and a slow cinematic reveal.'},
 {name:'Cozy comedy',premise:'A llama causes chaos during a cozy mountain picnic, playful timing and warm golden-hour light.'}
]
const process = [{icon:Pencil,title:'Idea',text:'One sentence is enough. It stays in this browser.'},{icon:Film,title:'Shots',text:'The idea becomes an editable list with a camera for each shot.'},{icon:Clapperboard,title:'Paste',text:'Paste a prompt into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render the clip.'}]
const studyCards = [
 {genre:'ACTION',title:'Snow Fight',file:'snow-fight',alt:'Snow Fight — warrior vs dragon in snow',premise:'A warrior battles a dragon on a snowy mountain pass, sweeping camera, epic scale.'},
 {genre:'ADVENTURE',title:'Dragon Chase',file:'dragon-chase',alt:'Dragon Chase — dragon chasing a rider on ice',premise:'A dragon pursues a rider across an icy landscape, low-angle tracking shot.'},
 {genre:'SCI-FI',title:'The Lab',file:'the-lab',alt:'The Lab — two scientists debating in a robotics lab',premise:'Scientists debate in a dark robotics lab, overhead fluorescent lighting, tense atmosphere.'},
 {genre:'ACTION',title:'The Climb',file:'the-climb',alt:'The Climb — soldier on collapsing scaffolding',premise:'A soldier scales a collapsing scaffold, dust and debris falling, dutch-angle camera.'},
 {genre:'SCI-FI',title:'Mech Reveal',file:'mech-reveal',alt:'Mech Reveal — giant mechanical creature in fog',premise:'A giant mechanical creature emerges through fog, soldiers frozen in place, dramatic scale reveal.'},
 {genre:'EXPERIMENTAL',title:'Solo Corridor',file:'solo-corridor',alt:'Solo Corridor — lone figure in wireframe corridor',premise:'A lone figure walks down an endless wireframe corridor, ambient light pulsing, surreal tone.'},
 {genre:'DRAMA',title:'Machine Room',file:'machine-room',alt:'Machine Room — two characters face off in a machine room',premise:'Two characters argue inside a vast machine hall, volumetric light cutting through darkness.'},
 {genre:'DRAMA',title:'High Country',file:'high-country',alt:'High Country — llama at sunrise in mountain pasture',premise:'A llama crosses a mountain pasture at dawn, mist rolling over grass, wide cinematic framing.'}
]
const faqs = [
 ['What is Moovicut?','Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.'],
 ['How does Moovicut work?','A premise becomes an ordered shot list on this device, with camera, action, lighting, sound, and continuity you can edit. Paste a prompt into the model you already use. Moovicut does not call that model.'],
 ['Which genres can I start from?','Action, Drama, Sci-Fi, Horror, Comedy, Romance, Thriller and Documentary. Each genre card loads a premise of that genre, and you can edit it.'],
 ['Is Moovicut free?','Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.'],
 ['Are visits counted?','Anonymous, cookieless visit counts via Cloudflare Web Analytics. The site also keeps a simple server-side visit count (POST /api/visits) stored on a persistent volume, with no personal data. Storyboards never leave the device.'],
 ['Does Moovicut render video?','No. It writes prompts. Nothing is rendered inside Moovicut.']
]
useSeoMeta({
  title: computed(() => t('Moovicut — local storyboard studio')),
  ogTitle: computed(() => t('Moovicut — local storyboard studio')),
  twitterTitle: computed(() => t('Moovicut — local storyboard studio')),
  description: computed(() => t('Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.')),
  ogDescription: computed(() => t('Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.')),
  twitterDescription: computed(() => t('Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.')),
  ...socialPreview
})
function openStudio(nextPremise = premise.value){
  const idea = String(nextPremise || '').trim()
  if (idea) premise.value = idea
  if (import.meta.client) saveStudioHandoff(sessionStorage, { premise: idea, model: heroModel.value })
  if (store.project) router.push('/studio')
}
function startPlan(){ if (!premise.value.trim()) { notify('Enter an idea first.','error'); return } openStudio(premise.value) }
function selectGenre(selected){genre.value=selected.id;premise.value=t(selected.premise);document.getElementById('hero-premise')?.focus()}
function usePremise(selected){openStudio(t(selected.premise))}
</script>
<template><div class="site-shell"><AppHeader /><main id="main-content" class="site-main">
  <section class="hero-section" aria-labelledby="hero-title"><div class="hero-container"><div class="hero-copy"><p class="eyebrow-pill">{{ $t('Local storyboard studio') }}</p><h1 id="hero-title">{{ $t('Plan a storyboard') }}</h1><p class="hero-subtitle">{{ $t('Write one idea. Moovicut turns it into editable shots and prompts you can paste into Grok Imagine, Google, or any other AI image or video model. It does not render a clip.') }}</p><form class="premise-composer" @submit.prevent="startPlan"><label class="sr-only" for="hero-premise">{{ $t('Describe your film') }}</label><div class="composer-input-row"><input id="hero-premise" v-model="premise" :placeholder="$t('A noir detective chases a suspect through neon-lit rain…')" maxlength="6000" required /><button class="button button-primary" type="submit"><Clapperboard :size="17" />{{ $t('Create storyboard') }}</button></div><p class="hero-local-note">{{ $t('Generates an editable shot list on your device. No account or rendering.') }}</p><div class="hero-model-line"><label class="hero-model-select">{{ $t('Prompt target') }}<select v-model="heroModel" :aria-label="$t('Prompt target')"><option v-for="item in MODEL_OPTIONS" :key="item.id" :value="item.id">{{ item.label }}</option></select></label><span>{{ $t('Try one of these:') }}</span><button v-for="example in examples" :key="example.name" type="button" @click="premise=$t(example.premise)">{{ $t(example.name) }}</button></div><p class="prompt-target-note">{{ $t('Thirteen prompt targets. Shot length and aspect follow the one you pick. The prompts also paste into any other AI image or video model.') }}</p></form>
          <section v-if="preview.ok" class="instant-board" :aria-label="$t('Instant board preview')">
            <h2 class="board-title">{{ $t('Here is your idea as shots') }}</h2>
            <p class="board-hint">{{ $t('Want just one picture? Copy any card and paste it into your AI app.') }}</p>
            <ol class="board-list">
              <li v-for="shot in preview.shots" :key="shot.order">
                <span class="board-order">{{ shot.order }}</span>
                <div class="board-body"><p class="board-line">{{ shot.line }}</p><span v-if="shot.tag" class="board-tag">{{ shot.tag }}</span></div>
                <button type="button" class="board-copy" @click="copyText(shot.prompt)">{{ $t('Copy prompt') }}</button>
              </li>
            </ol>
            <div class="board-foot">
              <p class="board-local">{{ $t('Built on this device — nothing was sent.') }}<span v-if="preview.more"> · {{ moreLabel }}</span></p>
              <button type="button" class="button button-primary board-refine" @click="startPlan">{{ $t('Refine in the studio') }} <ArrowRight :size="16" /></button>
            </div>
          </section><div class="scene-collage hero-story-strip" :aria-label="$t('Movie still examples')"><figure v-for="image in heroImages" :key="image.src" class="hero-still"><picture><source :srcset="joinAppPath(appBaseURL,image.srcset)" sizes="(max-width: 767px) 46vw, 22vw" type="image/webp" /><img :src="joinAppPath(appBaseURL,image.fallback)" :alt="$t(image.alt)" width="400" height="533" loading="lazy" decoding="async" /></picture><figcaption>{{ $t(image.caption) }}</figcaption></figure></div></div></div></section>
  <section class="section genre-section"><div class="container-wide"><header class="section-heading"><h2>{{ $t('Pick a genre. We speak its language.') }}</h2><p>{{ $t('Each genre card loads a premise of that genre. You can edit it before opening the studio.') }}</p></header><ul class="genre-grid"><li v-for="item in genres" :key="item.id"><button type="button" :aria-pressed="genre===item.id" @click="selectGenre(item)"><span class="genre-icon" aria-hidden="true"><BaseIcon :name="item.icon" :size="22" /></span><strong>{{ $t(item.name) }}</strong><span>{{ $t(item.detail) }}</span></button></li></ul><p class="genre-note">{{ $t('Each genre remains editable in your local storyboard.') }}</p></div></section>
  <section class="section"><div class="container-medium"><header class="section-heading"><h2>{{ $t('How it works') }}</h2><p>{{ $t('Three steps from an idea to a prompt you can paste.') }}</p></header><ol class="process-grid" :aria-label="$t('How it works')"><li v-for="(item,index) in process" :key="item.title"><span class="process-number">0{{index+1}}</span><component :is="item.icon" :size="22" /><h3>{{ $t(item.title) }}</h3><p>{{ $t(item.text) }}</p></li></ol></div></section>
  <section class="section section-alt showcase-section"><div class="container-wide"><header class="section-heading"><h2>{{ $t('Reference stills') }}</h2><p>{{ $t('These pictures show tone and framing. They are references, not renders from Moovicut. Studies on file include {first} and {second}.', { first: $t(referenceStudyNames[0]), second: $t(referenceStudyNames[1]) }) }}</p></header><ul class="study-grid"><li v-for="study in studyCards.slice(0, 4)" :key="study.title"><article class="study-card"><picture><source :srcset="joinAppPath(appBaseURL,gallerySrc(study.file,'webp'))" type="image/webp" /><img class="study-image" :src="joinAppPath(appBaseURL,gallerySrc(study.file,'jpg'))" :alt="$t(study.title)" width="1280" height="720" loading="lazy" decoding="async" /></picture><div class="study-caption"><h3>{{ $t(study.title) }}</h3><p>{{ $t(study.premise) }}</p><button type="button" class="text-link" @click="usePremise(study)">{{ $t('Use this prompt') }} <ArrowRight :size="14" /></button></div></article></li></ul></div></section>
  <section class="section faq-section" id="faq"><div class="container-faq"><header class="section-heading"><h2>{{ $t('Frequently asked questions') }}</h2><p>{{ $t('Everything directors ask before their first scene.') }}</p></header><div class="faq-list"><FaqDisclosure v-for="[question,answer] in faqs" :key="question" :question="question" :answer="answer" /></div></div></section>
  <section class="section section-alt home-closing"><div class="container-narrow"><p class="eyebrow">{{ $t('READY WHEN YOU ARE') }}</p><h2>{{ $t('Create a storyboard') }}</h2><p>{{ $t('One sentence in, an editable shot list out.') }}</p><NuxtLink to="/studio" class="button button-primary">{{ $t('Create storyboard') }} <ArrowRight :size="17" /></NuxtLink></div></section>
</main><SiteFooter /></div></template>
