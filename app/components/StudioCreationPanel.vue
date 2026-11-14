<script setup>
import { Copy, Image as ImageIcon, Plus, SlidersHorizontal, CircleHelp } from 'lucide-vue-next'
import { REFERENCE_MODEL_NAMES, ASPECT_RATIOS, DURATION_PRESETS, canonicalAspect, canonicalModel, inferSequenceMode, formatContinuitySheet } from '~/utils/prompt-engine.js'
import { decodeStudioBoard, boardTokenFromHash, studioHash } from '~/utils/studio-link.js'
import { storyMarkdown } from '~/utils/story-markdown.js'
import { combinedShotPrompts } from '~/utils/open-targets.js'
import { SOCIAL_X_URL } from '~/config/social.js'
import { joinAppPath } from '~/utils/urls.js'
import { STUDIO_INSPIRATIONS, promptImageSrc } from '~/utils/reference-content.js'
import { drawShareCard } from '~/utils/share-card.js'
import { readStudioChoices, writeStudioChoices } from '~/utils/studio-choices.js'
import { assessProject } from '~/utils/shot-risk.js'
import { takeStudioHandoff } from '~/utils/studio-handoff.js'
const store = useProjectStore()
const project = store.project
const { notify, copyText, downloadText } = useNotifier()
const remembered = readStudioChoices(import.meta.client ? localStorage : null)
const handoff = import.meta.client ? takeStudioHandoff(sessionStorage) : { premise: '', model: '' }
const premise = ref(handoff.premise || '')
const model = ref(canonicalModel(handoff.model) || remembered.model || canonicalModel(project.value.target_model) || 'grok')
watch(() => project.value.target_model, value => { const next = canonicalModel(value); if (next) model.value = next })
const count = ref(5)
const sequenceMode = ref(remembered.sequenceMode || 'continuous')
const sequenceTouched = ref(remembered.sequenceMode === 'varied' || remembered.sequenceMode === 'continuous')
watch(premise, value => { if (!sequenceTouched.value) sequenceMode.value = inferSequenceMode(value) })
function storyboardOptions(mode = sequenceMode.value, overrides = {}) {
  const idea = premise.value.trim() || (boardReady.value ? project.value?.premise : '') || ''
  const shots = overrides.count ?? (boardReady.value ? project.value.shots.length : count.value)
  return {
    idea,
    options: {
      count: Math.min(48, Math.max(1, Number(shots) || 5)),
      style: style.value,
      aspectRatio: canonicalAspect(aspect.value),
      continuityStrength: continuityStrength.value,
      promptDensity: density.value,
      duration: overrides.duration ?? duration.value,
      sequenceMode: mode,
      scenes: overrides.scenes
    }
  }
}
async function chooseSequence(mode) {
  if (mode !== 'continuous' && mode !== 'varied' && mode !== 'scenario') return
  sequenceTouched.value = true
  if (mode === sequenceMode.value) return
  const previous = sequenceMode.value
  sequenceMode.value = mode
  if (mode === 'scenario' || !boardReady.value) return
  const { idea, options } = storyboardOptions(mode)
  if (!idea.trim()) return
  try { await store.createNew(idea, model.value, options) }
  catch (error) {
    sequenceMode.value = previous
    uploadError.value = error.message || 'Could not replan the shot list.'
  }
}
function editSheet(field, value) { store.updateContinuity(field, value) }
function editCast(index, field, value) {
  const characters = project.value.filmSheet.characters.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : { ...item })
  store.patchFilmSheet({ characters })
}
function editPlace(index, value) {
  const places = project.value.filmSheet.places.map((item, itemIndex) => itemIndex === index ? { ...item, description: value } : { ...item })
  store.patchFilmSheet({ places })
}
const boardReady = computed(() => { const current = project.value; return !!current && current.id !== 'starter-project' && Array.isArray(current.shots) && current.shots.length > 0 })
const style = ref(remembered.style || 'Normal')
const aspect = ref(remembered.aspectRatio || '16:9')
const continuityStrength = ref(remembered.continuityStrength || 'standard')
const density = ref(remembered.promptDensity || 'standard')
const activePreset = ref('15s')
const tipsOpen = ref(false)
const stepByStep = ref(false)
const draftScenes = ref([])
const shortIdea = computed(() => { const words = premise.value.trim().split(/\s+/).filter(Boolean); return words.length > 0 && words.length < 4 })
watch([style, model, sequenceMode, aspect, continuityStrength, density], () => { if (import.meta.client) writeStudioChoices(localStorage, { style: style.value, model: model.value, sequenceMode: sequenceMode.value, aspectRatio: aspect.value, continuityStrength: continuityStrength.value, promptDensity: density.value }) })
function chooseAspect(value) {
  if (!ASPECT_RATIOS.some(item => item.id === value)) return
  aspect.value = value
  if (boardReady.value) store.applyPromptSettings({ aspectRatio: value })
}
function chooseStrength(value) {
  if (value !== 'standard' && value !== 'strict') return
  continuityStrength.value = value
  if (boardReady.value && sequenceMode.value === 'continuous') store.applyPromptSettings({ continuityStrength: value })
}
function chooseDensity(value) {
  if (value !== 'standard' && value !== 'concise') return
  density.value = value
  if (boardReady.value) store.applyPromptSettings({ promptDensity: value })
}
function syncPreset() {
  const match = DURATION_PRESETS.find(item => item.count === Number(count.value) && item.duration === Number(duration.value))
  activePreset.value = match ? match.id : ''
}
function blankScene() { return { action: '', duration: duration.value, framing: '', camera: '', lighting: '', notes: '' } }
function resizeDrafts(total) {
  const size = Math.min(48, Math.max(1, Number(total) || 5))
  const next = draftScenes.value.slice(0, size)
  while (next.length < size) next.push(blankScene())
  draftScenes.value = next
}
function choosePreset(preset) {
  count.value = preset.count
  duration.value = preset.duration
  activePreset.value = preset.id
  if (!boardReady.value) { if (stepByStep.value) resizeDrafts(preset.count); return }
  const idea = premise.value.trim() || project.value?.premise || ''
  if (!idea.trim()) return
  const { options } = storyboardOptions(sequenceMode.value, { count: preset.count, duration: preset.duration })
  store.createNew(idea, model.value, options).catch(error => { uploadError.value = error.message || 'Could not apply that duration.' })
}
const builderScenes = computed(() => {
  if (boardReady.value) return project.value.shots.map(shot => ({ id: shot.id, action: shot.action, duration: shot.duration, framing: shot.framing, camera: shot.camera, lighting: shot.lighting, notes: shot.notes || '', prompt: shot.prompt }))
  return draftScenes.value
})
function toggleStep() {
  stepByStep.value = !stepByStep.value
  if (stepByStep.value && !boardReady.value) resizeDrafts(count.value)
}
function changeSceneCount(value) {
  const size = Math.min(48, Math.max(1, Number(value) || 1))
  count.value = size
  syncPreset()
  if (!boardReady.value) { resizeDrafts(size); return }
  const current = project.value.shots.length
  if (size > current) { for (let index = current; index < size; index += 1) store.addShotAtEnd() }
  if (size < current) { for (const shot of project.value.shots.slice(size)) store.removeShot(shot.id) }
}
function addBuilderScene() {
  if ((boardReady.value ? project.value.shots.length : draftScenes.value.length) >= 48) return
  if (!boardReady.value) { draftScenes.value = [...draftScenes.value, blankScene()]; count.value = draftScenes.value.length; syncPreset(); return }
  store.addShotAtEnd()
  count.value = project.value.shots.length
  syncPreset()
}
function removeBuilderScene(index) {
  if (!boardReady.value) { if (draftScenes.value.length <= 1) return; draftScenes.value = draftScenes.value.filter((_, item) => item !== index); count.value = draftScenes.value.length; syncPreset(); return }
  const shot = project.value.shots[index]
  if (shot) store.removeShot(shot.id)
  count.value = project.value.shots.length
  syncPreset()
}
function moveBuilderScene(index, direction) {
  if (!boardReady.value) {
    const next = draftScenes.value.slice()
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [scene] = next.splice(index, 1)
    next.splice(target, 0, scene)
    draftScenes.value = next
    return
  }
  const shot = project.value.shots[index]
  if (!shot) return
  store.moveShot(shot.id, direction)
  store.applyPromptSettings({})
}
function updateBuilderScene(index, field, value) {
  if (!boardReady.value) { draftScenes.value[index] = { ...draftScenes.value[index], [field]: value }; return }
  const shot = project.value.shots[index]
  if (!shot) return
  if (field === 'notes') { store.updateShotFields(shot.id, { notes: value, directions: value }); return }
  store.updateShot(shot.id, field, value)
}
function applySharedBoard(board) {
  premise.value = board.premise
  if (board.model) model.value = board.model
  if (['Fun', 'Normal', 'Spicy'].includes(board.style)) style.value = board.style
  aspect.value = board.aspectRatio || aspect.value
  if (board.sequenceMode === 'varied' || board.sequenceMode === 'continuous' || board.sequenceMode === 'scenario') { sequenceMode.value = board.sequenceMode; sequenceTouched.value = true }
  continuityStrength.value = board.continuity === 'strict' ? 'strict' : 'standard'
  density.value = board.density === 'concise' ? 'concise' : 'standard'
  count.value = board.shots || 5
  duration.value = board.duration || 3
  syncPreset()
  stepByStep.value = Boolean(board.stepByStep || board.scenes?.length)
  if (board.scenes?.length) draftScenes.value = board.scenes.map(scene => ({ ...blankScene(), ...scene }))
  if (board.sequenceMode === 'scenario' && board.scenario) {
    return store.createNew(board.premise, model.value, { sequenceMode: 'scenario', scenario: board.scenario, style: board.preset?.family || board.style, genre: board.preset?.genre || board.genre, aspectRatio: board.aspectRatio, duration: board.duration, promptDensity: density.value })
  }
  return store.createNew(board.premise, model.value, { count: board.shots, duration: board.duration, style: style.value, aspectRatio: board.aspectRatio, sequenceMode: board.sequenceMode, continuityStrength: continuityStrength.value, promptDensity: density.value, genre: board.genre, scenes: board.scenes })
}
const boardOpenPrompt = computed(() => boardReady.value ? combinedShotPrompts(project.value) : '')
const duration = ref(3)
const uploadError = ref('')
const referenceName = ref('')
const referencePreview = ref('')
const referenceReady = ref(true)
const activeTab = ref('preview')
const genreFilter = ref('All')
const genreTags = computed(() => ['All', ...new Set(STUDIO_INSPIRATIONS.map(study => study.genre))])
const visibleStudies = computed(() => genreFilter.value === 'All' ? STUDIO_INSPIRATIONS : STUDIO_INSPIRATIONS.filter(study => study.genre === genreFilter.value))
const compactPrompt = ref('')
const copiedKey = ref('')
let copiedTimer
const modelDirectory = [
 {name:'Grok Imagine',engine:'grok',art:'grok'},
 {name:'Google (Veo / Gemini)',engine:'google',art:'veo'}
]
function chooseModel(item){model.value=item.engine}
const activeDetail = ref(null)
const creating = ref(false)
const scenarioForm = ref(null)
const shotWarnings = computed(() => boardReady.value ? assessProject(project.value) : [])
function warningsFor(id) { return shotWarnings.value.filter(item => item.shotId === id) }
const appBaseURL = useRuntimeConfig().app.baseURL
const models = [
 {id:'grok',name:'Grok Imagine'},
 {id:'google',name:'Google (Veo / Gemini)'}
]
const starterIdeas = [
 { title:'Last light', premise:'A lighthouse keeper races the dusk to repair a failing beacon before a fishing boat reaches the rocks.' },
 { title:'Paper star map', premise:'An apprentice astronaut guides a damaged capsule home using only a paper star map.' },
 { title:'Last loaf', premise:'A night baker finds an unsigned note and delivers one last loaf before sunrise.' }
]
async function readReference(event){
 uploadError.value='';referenceReady.value=false;const file=event.target.files?.[0]
 if(!file){referenceReady.value=true;return}
 if(file.size>10*1024*1024){uploadError.value='Choose an image smaller than 10 MB.';return}
 if(!file.type.startsWith('image/')){uploadError.value='Choose a PNG, JPEG, WebP, GIF, AVIF or SVG image.';return}
 try { await store.attachReference(file) } catch (error) { uploadError.value=error.message||'Could not read the selected reference.';return }
 referenceName.value=file.name
 if(referencePreview.value)URL.revokeObjectURL(referencePreview.value)
 referencePreview.value=URL.createObjectURL(file);referenceReady.value=true
}
function dropReference(event){readReference({target:{files:event.dataTransfer.files}})}
function clearReference(){referenceName.value='';if(referencePreview.value)URL.revokeObjectURL(referencePreview.value);referencePreview.value='';uploadError.value=''}
function applyScenarioPreset(choice) {
  if (boardReady.value && project.value.sequenceMode === 'scenario' && choice?.family && choice?.genre) store.setStylePreset(choice.family, choice.genre)
}
async function createStoryboard(){
 uploadError.value=''
 if (sequenceMode.value === 'scenario') {
  const draft = scenarioForm.value?.draft?.()
  if (!draft?.ok) { uploadError.value = draft?.errors?.map(item => item.message).join(' ') || 'Fix the highlighted scenario lines, then create the board.'; return }
  if (!referenceReady.value) { uploadError.value = 'Wait for the reference image to finish loading.'; return }
  creating.value = true
  try {
    await store.createNew(premise.value.trim() || draft.premise, model.value, { sequenceMode: 'scenario', scenario: draft.scenario, style: draft.style, genre: draft.genre, aspectRatio: canonicalAspect(aspect.value), duration: duration.value, promptDensity: density.value })
    notify('Editable storyboard created locally. Nothing was rendered.', 'success')
    activeTab.value = 'preview'
  } catch (error) { uploadError.value = error.message || 'Fix the scenario, then try again.' }
  finally { creating.value = false }
  return
 }
 if(!premise.value.trim()){uploadError.value='Enter an idea to create a local storyboard.';return}
 if(!referenceReady.value){uploadError.value='Wait for the reference image to finish loading.';return}
 creating.value=true
 try {
  const { options } = storyboardOptions()
  if (stepByStep.value && draftScenes.value.length && !boardReady.value) options.scenes = draftScenes.value
  await store.createNew(premise.value,model.value,options)
  notify('Editable storyboard created locally. Nothing was rendered.','success')
  activeTab.value='preview'
  await nextTick()
  if(window.matchMedia('(max-width: 767px)').matches) document.getElementById('editable-shots')?.scrollIntoView({behavior:'smooth',block:'start'})
 }
 catch(error){uploadError.value=error.message||'Enter a story premise to create a storyboard.'}
 finally{creating.value=false}
}
async function copyAllPrompts(){
 if(!boardReady.value){uploadError.value='Create a local storyboard before copying prompts.';return}
 const modeLabel=project.value.sequenceMode==='varied'?'Varied shots':'Continuous story'
 const sheet=project.value.sequenceMode==='continuous'?`${formatContinuitySheet(project.value.continuitySheet)}\n\n`:''
 const text=`Mode: ${modeLabel}\n${sheet}`+project.value.shots.map((shot,index)=>`Shot ${index+1}: ${shot.title}\n${shot.prompt}`).join('\n\n')
 if(await copyText(text,'All prompts copied.')) flashCopied('all')
}
async function downloadShareImage(){
 if(!boardReady.value){uploadError.value='Create a local storyboard before downloading a share image.';return}
 const blob=await drawShareCard(project.value)
 if(!blob){notify('This browser could not draw the share image.','error');return}
 const url=URL.createObjectURL(blob)
 const link=document.createElement('a')
 link.href=url
 link.download=`${(project.value.title||'moovicut').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`
 document.body.appendChild(link); link.click(); link.remove()
 setTimeout(()=>URL.revokeObjectURL(url),500)
 notify('Share image saved on this device.')
}
async function importStoryboardJson(event){
 const file=event.target.files?.[0]
 event.target.value=''
 if(!file)return
 try {
  store.importProject(await file.text())
  premise.value=project.value.premise||''
  const next=canonicalModel(project.value.target_model)
  if(next) model.value=next
  notify('Storyboard imported on this device.')
 } catch(error){uploadError.value=error.message||'Could not import that JSON file.'}
}
const mentionOpen=ref(false)
function watchMention(event){
 const caret=event.target.selectionStart||0
 const before=String(event.target.value||'').slice(0,caret)
 mentionOpen.value=/(?:^|\s)@[^\s]*$/.test(before)
}
function useMention(name){
 premise.value=premise.value.replace(/@[^\s]*$/,`@${name} `)
 mentionOpen.value=false
}
function exportStoryboardJson(){
 if(!boardReady.value){uploadError.value='Create a local storyboard before exporting JSON.';return}
 const payload=store.serialized?.value??store.serialized
 const name=`${(project.value.title||'moovicut').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`
 downloadText(name,typeof payload==='string'?payload:JSON.stringify(payload))
}
function useStudy(study){premise.value=study.premise;style.value=study.genre==='Experimental'?'Fun':'Normal'}
function flashCopied(key){copiedKey.value=key;clearTimeout(copiedTimer);copiedTimer=setTimeout(()=>{copiedKey.value=''},1600)}
function currentMarkdown(){ if(!boardReady.value){uploadError.value='Create a local storyboard before exporting Markdown.';return ''}; return storyMarkdown(project.value) }
async function copyMarkdown(){ const text=currentMarkdown(); if(text && await copyText(text,'Markdown copied.')) flashCopied('markdown') }
function downloadMarkdown(){ const text=currentMarkdown(); if(!text) return; const name=`${(project.value.title||'moovicut').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.md`; downloadText(name,text,'text/markdown') }
async function copyShareLink(){
  const idea = premise.value.trim() || (boardReady.value ? project.value.premise : '')
  if (!idea || idea.length < 8) { uploadError.value = 'Add a little more detail before copying a share link.'; return }
  const scenes = boardReady.value ? project.value.shots.map(shot => ({ action: shot.action, duration: shot.duration, framing: shot.framing, camera: shot.camera, lighting: shot.lighting, notes: shot.notes || '' })) : draftScenes.value
  const hash = studioHash({ premise: idea, model: model.value, shots: boardReady.value ? project.value.shots.length : count.value, sequenceMode: sequenceMode.value, continuityStrength: continuityStrength.value, density: density.value, aspectRatio: aspect.value, style: style.value, duration: duration.value, stepByStep: stepByStep.value, scenes: stepByStep.value || boardReady.value ? scenes : undefined })
  if (!hash) { uploadError.value = 'This board is too large for a share link. Export JSON instead.'; return }
  const path = joinAppPath(appBaseURL, 'studio')
  const url = `${location.origin}${path}${hash}`
  history.replaceState(null, '', `${path}${hash}`)
  if (await copyText(url, 'Share link copied.')) flashCopied('share')
}
onMounted(() => {
  const board = decodeStudioBoard(boardTokenFromHash(window.location.hash))
  if (!board) return
  applySharedBoard(board).catch(error => { uploadError.value = error.message || 'Could not open that share link.' })
})
async function copyExample(text, key){if(await copyText(text,'Prompt copied.'))flashCopied(key)}
async function copyStudyPrompt(study){if(await copyText(study.premise,'Prompt copied.'))flashCopied(`study:${study.title}`)}
async function copyShotPrompt(text, id){if(await copyText(text,'Shot prompt copied.'))flashCopied(`shot:${id}`)}
onBeforeUnmount(()=>{clearTimeout(copiedTimer);if(referencePreview.value)URL.revokeObjectURL(referencePreview.value)})
</script>
<template>
 <section class="studio-main" aria-label="Storyboard creation workspace">
  <div class="studio-create-column"><header class="studio-panel-header"><h1 class="studio-create-heading">What will you create?</h1><p class="studio-local-badge">Free · Local · No account</p></header><form class="studio-create-form" aria-label="Create a local storyboard" @submit.prevent="createStoryboard">
   <div class="studio-prompt-editor"><textarea v-model="premise" aria-label="Video scene prompt" placeholder="Describe your idea in detail — characters, setting, mood, camera style..." @input="watchMention" @keyup="watchMention" @click="watchMention" /><ul v-if="mentionOpen" class="studio-mention-list" aria-label="Uploaded images"><li v-if="referenceName"><button type="button" @click="useMention(referenceName)">{{ referenceName }}</button></li><li v-else>Upload an image to mention it.</li></ul><div class="studio-reference-upload"><label class="studio-add-reference" aria-label="Upload reference image"><ImageIcon :size="22" /><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" @change="readReference" /></label><img v-if="referencePreview" :src="referencePreview" alt="Selected reference" /><span>{{referenceName}}</span><p>Type @ to select your uploaded images.</p><button v-if="referencePreview" type="button" class="studio-remove-reference" @click="clearReference">Remove image</button></div><div v-if="!boardReady" class="studio-starters" aria-label="Starter ideas"><p>Try a starter idea</p><button v-for="idea in starterIdeas" :key="idea.title" type="button" @click="premise=idea.premise">{{ idea.title }}</button></div></div>
   <p v-if="shortIdea" class="studio-idea-hint">Add a place, lighting, or a medium such as watercolor or 35mm for sharper shots.</p>
   <header class="studio-model-selector"><label class="studio-model-icon" for="studio-model"><img :src="joinAppPath(appBaseURL,promptImageSrc('paper-star-map','webp'))" alt="" width="20" height="20" /><span class="sr-only">Model</span></label><select id="studio-model" v-model="model" aria-label="Prompt target"><option v-for="item in models" :key="item.id" :value="item.id">{{item.name}}</option></select><p>Prompt target for your local shot list. Moovicut does not render video.</p><button type="button" aria-label="Model information" @click="activeDetail='model'"><CircleHelp :size="16" /></button></header><p class="prompt-target-note">Tuned for Grok Imagine and Google, but the prompts work with any AI image or video generator.</p>
   <div class="studio-style-settings"><fieldset class="studio-sequence-mode studio-aspect-presets"><legend>Aspect ratio</legend><div><button v-for="item in ASPECT_RATIOS" :key="item.id" type="button" :aria-pressed="aspect===item.id" @click="chooseAspect(item.id)"><span>{{ item.label }}</span><small>{{ item.note }}</small></button></div></fieldset><fieldset><legend>Style Mode</legend><button v-for="choice in ['Fun','Normal','Spicy']" :key="choice" type="button" :aria-pressed="style===choice" @click="style=choice">{{choice}}</button></fieldset></div>
   <div class="studio-creation-note">Free local storyboard generation, editing and export. No plan or account is needed; provider generation is not connected.</div><details class="studio-advanced-settings"><summary><SlidersHorizontal :size="14" />Storyboard settings</summary><div><label>Number of shots<input v-model.number="count" type="number" min="1" max="48" aria-label="Number of shots" /></label><label>Duration in seconds<input v-model.number="duration" type="number" min="1" max="60" aria-label="Duration in seconds" /></label></div></details>
   <fieldset class="studio-sequence-mode studio-duration-presets"><legend>Total duration</legend><div><button v-for="preset in DURATION_PRESETS" :key="preset.id" type="button" :aria-pressed="activePreset===preset.id" @click="choosePreset(preset)"><span>{{ preset.label }}</span><small>{{ preset.count }} × {{ preset.duration }}s</small></button></div></fieldset><fieldset class="studio-sequence-mode studio-mode-choices"><legend>Sequence mode</legend><div><button type="button" :aria-pressed="sequenceMode==='continuous'" @click="chooseSequence('continuous')">Continuous story</button><button type="button" :aria-pressed="sequenceMode==='varied'" @click="chooseSequence('varied')">Varied shots</button><button type="button" :aria-pressed="sequenceMode==='scenario'" @click="chooseSequence('scenario')">Scenario</button></div></fieldset><fieldset v-if="sequenceMode==='continuous'" class="studio-sequence-mode"><legend>Continuity strength</legend><div><button type="button" :aria-pressed="continuityStrength==='standard'" @click="chooseStrength('standard')">Standard<small>Shared sheet in every shot</small></button><button type="button" :aria-pressed="continuityStrength==='strict'" @click="chooseStrength('strict')">Strict<small>Repeat the full sheet verbatim</small></button></div></fieldset><fieldset class="studio-sequence-mode"><legend>Prompt density</legend><div><button type="button" :aria-pressed="density==='standard'" @click="chooseDensity('standard')">Standard<small>Shared sheet, once</small></button><button type="button" :aria-pressed="density==='concise'" @click="chooseDensity('concise')">Concise<small>One short continuity line</small></button></div></fieldset>
   <StudioScenario v-if="sequenceMode==='scenario'" ref="scenarioForm" :idea="premise" :duration="duration" @preset="applyScenarioPreset" />
   <button v-if="sequenceMode!=='scenario'" type="button" class="studio-step-toggle" :aria-pressed="stepByStep" @click="toggleStep">Step-by-step storyboard</button>
   <StudioStepBuilder v-if="stepByStep && sequenceMode!=='scenario'" :scenes="builderScenes" :count="boardReady ? project.shots.length : count" @add="addBuilderScene" @remove="removeBuilderScene" @move="moveBuilderScene" @update="updateBuilderScene" @count="changeSceneCount" />
   <div class="studio-generate-row"><button class="studio-generate" type="submit" :disabled="creating"><Plus :size="16" />{{creating?'Creating local storyboard…':'Create local storyboard'}}</button><button type="button" class="studio-tips-button" :aria-expanded="tipsOpen" aria-controls="studio-tips" @click="tipsOpen=!tipsOpen">?</button></div>
   <section v-if="tipsOpen" id="studio-tips" class="studio-tips" aria-label="Storyboard tips"><h2>Tips</h2><ol><li>Name a subject, a place, an action, and a medium or style.</li><li>Continuous story keeps one world. Varied shots are separate angles.</li><li>Concise prompts stay short. Standard keeps one shared continuity sheet.</li><li>Aspect presets: 9:16 for vertical, 16:9 for wide.</li></ol></section><p class="studio-generation-note">Generates an editable shot list on your device. No account or rendering.</p><p v-if="uploadError" class="studio-error" role="alert">{{uploadError}}</p><p class="studio-generation-note">Free local storyboarding, editing and exporting · JSON export</p>
  </form></div>
  <section id="editable-shots" class="studio-preview-panel"><nav class="studio-model-directory" aria-label="Prompt targets"><button v-for="item in modelDirectory" :key="item.name" type="button" :aria-pressed="model===item.engine" :aria-label="`${item.name} prompt target`" @click="chooseModel(item)"><img :src="joinAppPath(appBaseURL,`models/${item.art}.svg`)" alt="" width="14" height="14" /><span>{{item.name}}</span></button></nav><div class="studio-preview-heading"><h2>Editable shots</h2><p>Each shot is editable here. Copy a prompt without opening another view.</p></div><section v-if="boardReady && project.sequenceMode==='scenario' && project.filmSheet" class="studio-continuity" aria-label="Film sheet"><h3>Film sheet</h3><p>Characters and places are stored once. Generated prompts use them by name. Prompts you edited stay as you left them.</p><label v-for="(character, index) in project.filmSheet.characters" :key="`cast-${index}`">{{ character.name }} look<input :value="character.look" :aria-label="`${character.name} look`" @change="editCast(index, 'look', $event.target.value)" /></label><label v-for="(place, index) in project.filmSheet.places" :key="`place-${index}`">{{ place.name }}<input :value="place.description" :aria-label="`${place.name} description`" @change="editPlace(index, $event.target.value)" /></label><p v-for="sequence in project.sequences || []" :key="sequence.order"><button type="button" @click="copyText(sequence.export, `Sequence ${sequence.order} copied`)">Copy sequence {{ sequence.order }} ({{ sequence.duration }}s)</button></p></section><section v-if="boardReady && project.sequenceMode==='continuous' && project.continuitySheet" class="studio-continuity" aria-label="Continuity sheet"><h3>Continuity sheet</h3><p>Standard prompts include this sheet once. Strict repeats it verbatim. Concise keeps one short line. Edit it and the generated prompts update together. Prompts you edited stay as you left them.</p><label>Character<input :value="project.continuitySheet.character" aria-label="Continuity character" @change="editSheet('character',$event.target.value)" /></label><label>Outfit<input :value="project.continuitySheet.appearance" aria-label="Continuity outfit" @change="editSheet('appearance',$event.target.value)" /></label><label>Place<input :value="project.continuitySheet.place" aria-label="Continuity place" @change="editSheet('place',$event.target.value)" /></label><label>Time of day / light<input :value="project.continuitySheet.time" aria-label="Continuity time of day" @change="editSheet('time',$event.target.value)" /></label><label>Lighting<input :value="project.continuitySheet.lighting" aria-label="Continuity lighting" @change="editSheet('lighting',$event.target.value)" /></label><label>Palette<input :value="project.continuitySheet.palette" aria-label="Continuity palette" @change="editSheet('palette',$event.target.value)" /></label><label>Style<input :value="project.continuitySheet.style" aria-label="Continuity style" @change="editSheet('style',$event.target.value)" /></label><label v-if="project.continuitySheet.dialogue">Dialogue<input :value="project.continuitySheet.dialogue" aria-label="Continuity dialogue" @change="editSheet('dialogue',$event.target.value)" /></label><p v-if="project.continuitySheet.avoid">Do not show: {{ project.continuitySheet.avoid }}</p></section><div class="studio-shot-toolbar"><button class="copy-prompt-button" type="button" @click="copyAllPrompts">{{ copiedKey==='all' ? 'Copied' : 'Copy all prompts' }}</button><p class="studio-paste-hint">Paste this into Grok Imagine, Google, or any other AI image or video model.</p><OpenInButtons v-if="boardReady" :prompt="boardOpenPrompt" :seed="1" /><button class="copy-prompt-button" type="button" @click="exportStoryboardJson">Export JSON</button><button class="copy-prompt-button" type="button" @click="copyMarkdown">{{ copiedKey==='markdown' ? 'Copied' : 'Copy Markdown' }}</button><button class="copy-prompt-button" type="button" @click="downloadMarkdown">Download Markdown</button><button class="copy-prompt-button" type="button" @click="copyShareLink">{{ copiedKey==='share' ? 'Copied' : 'Copy share link' }}</button><button class="copy-prompt-button" type="button" @click="$refs.importJson.click()">Import JSON</button><input ref="importJson" class="sr-only" type="file" accept="application/json,.json" @change="importStoryboardJson" /><button class="copy-prompt-button" type="button" @click="downloadShareImage">Download share image</button></div><p v-if="!boardReady" class="studio-shot-empty">Enter an idea, then create a local storyboard. The editable shots stay on this device.</p><ol v-else class="studio-shot-list" aria-label="Editable shots"><li v-for="(shot,index) in project.shots" :key="shot.id"><header class="studio-shot-card-heading"><span class="shot-number">{{String(index+1).padStart(2,'0')}}</span><span>{{shot.stage}}</span></header><label>Title<input :value="shot.title" :aria-label="`Title for shot ${index+1}`" @change="store.updateShot(shot.id,'title',$event.target.value)" /></label><label>Description<textarea :value="shot.action" :aria-label="`Description for shot ${index+1}`" @change="store.updateShot(shot.id,'action',$event.target.value)"></textarea></label><label>Camera / shot type<input :value="shot.framing" :aria-label="`Shot type for shot ${index+1}`" @change="store.updateShot(shot.id,'framing',$event.target.value)" /></label><label>Camera<input :value="shot.camera" :aria-label="`Camera for shot ${index+1}`" @change="store.updateShot(shot.id,'camera',$event.target.value)" /></label><label>Duration (seconds)<input type="number" min="2" max="15" :value="shot.duration" :aria-label="`Duration for shot ${index+1}`" @change="store.updateShot(shot.id,'duration',Number($event.target.value))" /></label><label>Prompt<textarea :value="shot.prompt" :aria-label="`Prompt for shot ${index+1}`" @change="store.updateShot(shot.id,'prompt',$event.target.value,false)"></textarea></label><p v-if="shot.promptEdited" class="studio-edited-mark">Edited by you</p><ul v-if="warningsFor(shot.id).length" class="studio-scenario-warnings"><li v-for="item in warningsFor(shot.id)" :key="item.code">{{ item.message }} {{ item.fix }}</li></ul><button type="button" class="text-button" @click="store.regenerateOne(shot.id)">Regenerate this shot</button><button v-if="shot.promptEdited" type="button" class="text-button" @click="store.resetShotPrompt(shot.id)">Reset to generated prompt</button><button class="copy-prompt-button" :class="{ 'is-copied': copiedKey===`shot:${shot.id}` }" type="button" :aria-label="`Copy prompt for shot ${index+1}`" @click="copyShotPrompt(shot.prompt, shot.id)"><Copy :size="13" />{{ copiedKey===`shot:${shot.id}` ? 'Copied' : 'Copy prompt' }}</button><OpenInButtons :prompt="shot.prompt" :seed="index" /><p class="studio-paste-hint">Paste this into Grok Imagine, Google, or any other AI image or video model.</p></li></ol><p v-if="boardReady" class="studio-thanks">Enjoying Moovicut? <a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener">Tips keep it free</a> <span>Tips pay for hosting and keep Moovicut free.</span><a v-if="SOCIAL_X_URL" class="studio-follow" :href="SOCIAL_X_URL" target="_blank" rel="noopener">Follow on X (it's free!)</a></p><nav class="studio-view-tabs" aria-label="Storyboard views"><button type="button" :aria-pressed="activeTab==='preview'" @click="activeTab='preview'">Preview</button><button type="button" :aria-pressed="activeTab==='explore'" @click="activeTab='explore'">Explore</button><button type="button" :aria-pressed="activeTab==='prompts'" @click="activeTab='prompts'">Prompts</button></nav><nav class="studio-provider-list" aria-label="Prompt targets"><span v-for="name in REFERENCE_MODEL_NAMES" :key="name">{{name}}</span></nav><p class="sr-only">Local prompt studies and storyboard results</p>
   <div class="studio-genre-filters" role="toolbar" aria-label="Filter prompts by genre"><button v-for="tag in genreTags" :key="tag" type="button" :aria-pressed="genreFilter===tag" @click="genreFilter=tag">{{tag}}</button></div>
   <div v-if="activeTab==='preview'" class="studio-inspiration-cards"><article v-for="study in visibleStudies" :key="study.title" class="studio-prompt-card"><picture><source :srcset="joinAppPath(appBaseURL,promptImageSrc(study.file,'webp'))" type="image/webp" /><img :src="joinAppPath(appBaseURL,promptImageSrc(study.file,'jpg'))" :alt="study.title" width="1280" height="720" loading="lazy" decoding="async" /></picture><div class="studio-prompt-card-body"><span class="studio-genre-chip">{{study.genre}}</span><strong>{{study.title}}</strong><p>{{study.premise}}</p><button class="studio-card-copy" type="button" @click="copyStudyPrompt(study)">{{ copiedKey===`study:${study.title}` ? 'Copied' : 'Copy prompt' }}</button></div></article></div>
   <div v-else-if="activeTab==='explore'" class="studio-explore"><h2>Explore story ideas</h2><p>Choose a study to use its premise in your local storyboard.</p><div class="studio-inspiration-cards"><article v-for="study in visibleStudies" :key="study.title" class="studio-prompt-card"><picture><source :srcset="joinAppPath(appBaseURL,promptImageSrc(study.file,'webp'))" type="image/webp" /><img :src="joinAppPath(appBaseURL,promptImageSrc(study.file,'jpg'))" :alt="study.title" width="1280" height="720" loading="lazy" decoding="async" /></picture><div class="studio-prompt-card-body"><span class="studio-genre-chip">{{study.genre}}</span><strong>{{study.title}}</strong><p>{{study.premise}}</p><button class="studio-card-copy" type="button" @click="useStudy(study)">Use this idea</button></div></article></div></div>
   <div v-else class="studio-prompt-library"><h2>Prompt library</h2><p>Copy a study or generate your own editable shot list. Browse prompt history to get more ideas.</p><article v-for="study in visibleStudies" :key="study.title" class="studio-prompt-card"><picture><source :srcset="joinAppPath(appBaseURL,promptImageSrc(study.file,'webp'))" type="image/webp" /><img :src="joinAppPath(appBaseURL,promptImageSrc(study.file,'jpg'))" :alt="study.title" width="1280" height="720" loading="lazy" decoding="async" /></picture><div class="studio-prompt-card-body"><span class="studio-genre-chip">{{study.genre}}</span><h3>{{study.title}}</h3><p>{{study.premise}}</p><button class="studio-card-copy" type="button" @click="copyExample(study.premise, `library:${study.title}`)"><Copy :size="14" />{{ copiedKey===`library:${study.title}` ? 'Copied' : 'Copy prompt' }}</button></div></article></div>
   <form class="studio-bottom-composer" aria-label="Create from a compact prompt" @submit.prevent="premise=compactPrompt;createStoryboard()"><button type="button" aria-label="Upload reference image" @click="$refs.compactReference.click()"><ImageIcon :size="16" /></button><input ref="compactReference" class="sr-only" type="file" accept="image/*" @change="readReference" /><input v-model="compactPrompt" aria-label="Describe your next storyboard" placeholder="Describe your next storyboard" /><select v-model="model" aria-label="Prompt target"><option v-for="item in models" :key="item.id" :value="item.id">{{item.name}}</option></select><button type="submit" aria-label="Create local storyboard"><Plus :size="18" /></button></form><p class="studio-generation-note">Generates an editable shot list on your device. No account or rendering.</p>
  </section>
 </section>
 <AppModal v-if="activeDetail" title="Local model selector" @close="activeDetail=null"><p>These labels adapt your prompts for Grok Imagine or Google (Veo / Gemini). The prompts also work with any other AI image or video model. Moovicut does not call those services or render video.</p><p>All storyboarding, editing and exporting features are free and work with no account.</p></AppModal>
</template>
