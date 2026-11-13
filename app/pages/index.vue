<script setup>
import { ArrowUpRight, Check, Film, Pencil, Clapperboard, Video, ArrowRight } from 'lucide-vue-next'
import { SCENE_STUDIES } from '~/utils/prompt-engine.js'
import { SCENE_STILLS, stillSrc } from '~/utils/reference-content.js'
import { joinAppPath } from '~/utils/urls.js'
import { saveStudioHandoff } from '~/utils/studio-handoff.js'
import { socialPreviewSeo } from '~/utils/social-preview.js'
const store = useProjectStore()
const router = useRouter()
const { notify } = useNotifier()
const runtimeConfig = useRuntimeConfig()
const appBaseURL = runtimeConfig.app.baseURL
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, appBaseURL)
const languageHint = ref(false)
const premise = ref('')
const heroModel = ref('grok')
const genre = ref('action')
function gallerySrc(file, extension = 'webp') { return `media/${file}.${extension === 'jpg' ? 'jpg' : 'webp'}` }
const heroOrder = [0, 2, 3, 1]
const heroImages = heroOrder.map(index => ({ src: stillSrc(index, 'webp'), fallback: stillSrc(index, 'jpg'), alt: SCENE_STILLS[index].alt, caption: SCENE_STILLS[index].caption }))
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
const process = [{icon:Pencil,title:'Describe the scene',text:'One sentence is enough. Moovicut keeps it on this device and does not send it to a model.'},{icon:Film,title:'Edit the shot list',text:'Each shot has a title, a camera, and a prompt you can change before you copy it.'},{icon:Video,title:'Paste the prompt',text:'Copy a prompt into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render the clip.'}]
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
 ['Are visits counted?','Anonymous, cookieless visit counts via Cloudflare Web Analytics; storyboards never leave the device.'],
 ['Does Moovicut render video?','No. It writes prompts. Nothing is rendered inside Moovicut.']
]
useSeoMeta({
  title: 'Moovicut — local storyboard studio',
  ogTitle: 'Moovicut — local storyboard studio',
  twitterTitle: 'Moovicut — local storyboard studio',
  description: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.',
  ogDescription: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.',
  twitterDescription: 'Turn a story premise into a free local storyboard. Copy the prompts into Grok Imagine, Google, or any other AI image or video model. Moovicut does not render video.',
  ...socialPreview
})
function openStudio(nextPremise = premise.value){
  const idea = String(nextPremise || '').trim()
  if (idea) premise.value = idea
  if (import.meta.client) saveStudioHandoff(sessionStorage, { premise: idea, model: heroModel.value })
  if (store.project) router.push('/studio')
}
function startPlan(){ if (!premise.value.trim()) { notify('Enter an idea first.','error'); return } openStudio(premise.value) }
function selectGenre(selected){genre.value=selected.id;premise.value=selected.premise;document.getElementById('hero-premise')?.focus()}
function usePremise(selected){openStudio(selected.premise)}
</script>
<template><div class="site-shell"><AppHeader /><main id="main-content" class="site-main">
  <section class="hero-section" aria-labelledby="hero-title"><div class="hero-container"><div class="hero-copy"><p class="eyebrow-pill">Local storyboard studio</p><h1 id="hero-title">Plan a storyboard</h1><p class="hero-subtitle">Write one idea. Moovicut turns it into editable shots and prompts you can paste into Grok Imagine, Google, or any other AI image or video model. It does not render a clip.</p><form class="premise-composer" @submit.prevent="startPlan"><label class="sr-only" for="hero-premise">Describe your film</label><div class="composer-input-row"><input id="hero-premise" v-model="premise" placeholder="A noir detective chases a suspect through neon-lit rain…" maxlength="6000" required /><button class="button button-primary" type="submit"><Clapperboard :size="17" />Start Directing</button></div><p class="hero-local-note">Generates an editable shot list on your device. No account or rendering.</p><div class="hero-model-line"><label class="hero-model-select">Prompt target<select v-model="heroModel" aria-label="Prompt target"><option value="grok">Grok Imagine</option><option value="google">Google (Veo / Gemini)</option></select></label><span>Try one of these:</span><button v-for="example in examples" :key="example.name" type="button" @click="premise=example.premise">{{example.name}}</button></div><p class="prompt-target-note">Tuned for Grok Imagine and Google, but the prompts work with any AI image or video generator.</p></form><div class="scene-collage hero-story-strip" aria-label="Movie still examples"><figure v-for="image in heroImages" :key="image.src" class="hero-still"><picture><source :srcset="joinAppPath(appBaseURL,image.src)" type="image/webp" /><img :src="joinAppPath(appBaseURL,image.fallback)" :alt="image.alt" width="960" height="1280" loading="lazy" decoding="async" /></picture><figcaption>{{ image.caption }}</figcaption></figure></div></div></div></section>
  <section class="section section-alt workflow-section"><div class="container-wide"><header class="section-heading"><h2>From one line to a shot list</h2><p>Moovicut writes the board on this device. The clip, if you want one, is made in Grok Imagine, Google, or any other AI image or video model.</p></header><ol class="workflow-grid"><li><span class="step-number"><Pencil :size="24" /><span class="sr-only">Step 1</span></span><h3>Idea</h3><p>A sentence is enough. It stays in this browser.</p></li><li><span class="step-number"><Film :size="24" /><span class="sr-only">Step 2</span></span><h3>Shots</h3><p>The idea becomes an editable list with place, light, and a camera for each shot.</p></li><li><span class="step-number"><Clapperboard :size="24" /><span class="sr-only">Step 3</span></span><h3>Prompts</h3><p>Each shot gets a prompt you can edit. Copy one, or copy them all.</p></li><li><span class="step-number"><Video :size="24" /><span class="sr-only">Step 4</span></span><h3>Paste</h3><p>Paste a prompt into Grok Imagine, Google, or any other AI image or video model. Moovicut does not run a render queue.</p></li></ol></div></section>
  <section class="section genre-section"><div class="container-wide"><header class="section-heading"><h2>Pick a genre. We speak its language.</h2><p>Each genre card loads a premise of that genre. You can edit it before opening the studio.</p></header><ul class="genre-grid"><li v-for="item in genres" :key="item.id"><button type="button" :aria-pressed="genre===item.id" @click="selectGenre(item)"><span class="genre-icon" aria-hidden="true"><BaseIcon :name="item.icon" :size="22" /></span><strong>{{ item.name }}</strong><span>{{ item.detail }}</span></button></li></ul><p class="genre-note">Each genre remains editable in your local storyboard.</p></div></section>
  <section class="section section-alt"><div class="container-medium split-feature"><div class="feature-copy"><p class="eyebrow">YOUR CREATIVE TOOL</p><h2>Script &amp; Storyboard Generator</h2><p>Paste a logline. Moovicut writes an editable shot list on this device, with framing and camera notes you can copy.</p><ul class="feature-list"><li><Check :size="15" />Shot-by-shot storyboard with framing and camera movement notes</li><li><Check :size="15" />Dialogue in the premise is kept in the prompts</li><li><Check :size="15" />Copy a prompt and paste it into Grok Imagine, Google, or any other AI image or video model</li><li><Check :size="15" />Export or import JSON. No account and no render</li></ul><button class="button button-primary" type="button" @click="openStudio(premise)">Write my first scene <ArrowRight :size="16" /></button></div><div class="feature-preview"><p class="micro-label">SAMPLE SCRIPT EXCERPT</p><pre class="mini-code">SCENE 1 — INT. COFFEE SHOP — NIGHT
A detective slides a photo across the table.
CUT TO: close-up on trembling hands.
SCENE 2 — EXT. CITY STREET — RAIN
Neon signs reflect in puddles.
The suspect disappears around the corner.
SCENE 3 — INT. APARTMENT — CONTINUOUS
Phone rings. Nobody answers.</pre></div></div></section>
  <section class="section"><div class="container-medium"><header class="section-heading"><h2>How it works</h2><p>Three steps from an idea to a prompt you can paste.</p></header><ol class="process-grid" aria-label="How it works"><li v-for="(item,index) in process" :key="item.title"><span class="process-number">0{{index+1}}</span><component :is="item.icon" :size="22" /><h3>{{item.title}}</h3><p>{{item.text}}</p></li></ol></div></section>
  <section class="section section-alt showcase-section"><div class="container-wide"><header class="section-heading"><h2>Reference stills</h2><p>These pictures show tone and framing. They are references, not renders from Moovicut. Studies on file include {{ referenceStudyNames[0] }} and {{ referenceStudyNames[1] }}.</p></header><ul class="study-grid"><li v-for="study in studyCards" :key="study.title"><article class="study-card"><picture><source :srcset="joinAppPath(appBaseURL,gallerySrc(study.file,'webp'))" type="image/webp" /><img class="study-image" :src="joinAppPath(appBaseURL,gallerySrc(study.file,'jpg'))" :alt="study.title" width="1280" height="720" loading="lazy" decoding="async" /></picture><div class="study-caption"><h3>{{study.title}}</h3><p>{{study.premise}}</p><button type="button" class="text-link" @click="usePremise(study)">Use this prompt <ArrowRight :size="14" /></button></div></article></li></ul></div></section>
  <section class="section faq-section" id="faq"><div class="container-faq"><header class="section-heading"><h2>Frequently asked questions</h2><p>Everything directors ask before their first scene.</p></header><dl class="faq-list"><FaqDisclosure v-for="[question,answer] in faqs" :key="question" :question="question" :answer="answer" /></dl></div></section>
  <section class="section section-alt home-closing"><div class="container-narrow"><p class="eyebrow">READY WHEN YOU ARE</p><h2>Direct your first scene</h2><p>One sentence in, an editable shot list out. Paste a prompt into Grok Imagine, Google, or any other AI image or video model when you want a clip.</p><NuxtLink to="/studio" class="button button-primary">Open the studio <ArrowRight :size="17" /></NuxtLink></div></section>
</main><SiteFooter /></div></template>
