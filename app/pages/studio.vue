<script setup>
import { ArrowUpRight, Check, Download, FolderOpen, Upload } from 'lucide-vue-next'
import { joinAppPath } from '~/utils/urls.js'
import { socialPreviewSeo } from '~/utils/social-preview.js'
import { wizardText } from '~/utils/wizard-strings.js'
import { downloadBody } from '~/composables/useNotifier.js'
const store = useProjectStore()
const runtimeConfig = useRuntimeConfig()
const appBaseURL = runtimeConfig.app.baseURL
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, appBaseURL)
const { notify, downloadText } = useNotifier()
const showMoreTools = ref(false)
const experience = ref('guided')
const panel = ref(null)
const workspaceMenu = ref(false)
const workspaceCollapsed = ref(false)
function exportJson() { try { downloadText(`${(store.project.title||'moovicut').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`, downloadBody(store.serialized)) } catch(error){notify(error.message||'Could not export this project.','error')} }
function openImport(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=importJson;input.click()}
function importProject(){openImport()}
function focusIdea(){panel.value=null;if(experience.value!=='guided')setExperience('guided');nextTick(()=>window.dispatchEvent(new CustomEvent('moovicut-focus-idea')))}
function openProjects(){showMoreTools.value=false;panel.value='library';workspaceMenu.value=false}
function openEditor(){panel.value=null;showMoreTools.value=true;workspaceMenu.value=false}
function exportLibrary(){const settings=store.settings?.value??store.settings;downloadText('moovicut-library.json',JSON.stringify({schema:'shotboard.backup.v1',projects:store.savedProjects,settings},null,2),'application/json')}
async function importJson(event){const file=event.target.files?.[0];try{if(!file)return;const text=await file.text();const parsed=JSON.parse(text);if(parsed&&['shotboard.v1','shotboard.backup.v1'].includes(parsed.schema)&&Array.isArray(parsed.projects)){store.restoreBackup(parsed);notify('Local library restored.','success')}else store.importProject(text)}catch(error){notify(error.message||'Could not read this JSON file.','error')}finally{if(event.target)event.target.value=''}}
function setExperience(next){experience.value=next;try{localStorage.setItem('moovicut.studio.experience',next)}catch{}}
onMounted(()=>{const route=useRoute();const hash=String(route.hash||'');if(hash.includes('board='))experience.value='advanced';else{try{const saved=localStorage.getItem('moovicut.studio.experience');if(saved==='advanced'||saved==='guided')experience.value=saved}catch{}}if(route.hash==='#storyboard')showMoreTools.value=true;if(route.hash==='#library')panel.value='library';if(hash.includes('board='))return;const id=route.query.project;if(typeof id==='string'){const saved=store.savedProjects.find(project=>project.id===id);if(saved)store.loadProject(saved)}})
const { t } = useI18n()
useSeoMeta({
  title: computed(() => t('Moovicut studio — free local storyboarding')),
  ogTitle: computed(() => t('Moovicut studio — free local storyboarding')),
  twitterTitle: computed(() => t('Moovicut studio — free local storyboarding')),
  description: computed(() => t('Free local storyboarding, shot editing, and JSON export on your device. No account is required.')),
  ogDescription: computed(() => t('Free local storyboarding, shot editing, and JSON export on your device. No account is required.')),
  twitterDescription: computed(() => t('Free local storyboarding, shot editing, and JSON export on your device. No account is required.')),
  ...socialPreview
})
</script>
<template><div class="studio-shell application-shell" :class="{'workspace-collapsed':workspaceCollapsed,'workspace-menu-open':workspaceMenu}">
 <a class="skip-link" href="#main-content">{{ $t('Skip to content') }}</a>
 <WorkspaceSidebar @projects="openProjects" @editor="openEditor" />
 <WorkspaceHeader :menu-open="workspaceMenu" @menu="workspaceMenu=!workspaceMenu"><template #tools><button v-if="experience==='guided'" class="text-link" type="button" @click="setExperience('advanced')">{{ $t('Advanced mode') }}</button><button v-else class="text-link" type="button" @click="setExperience('guided')">{{ $t(wizardText('advanced.back')) }}</button></template></WorkspaceHeader>
 <nav v-if="workspaceMenu" id="mobile-workspace-menu" class="workspace-mobile-nav" :aria-label="$t('Workspace navigation')"><NuxtLink to="/" @click="workspaceMenu=false">{{ $t('Home') }}</NuxtLink><NuxtLink to="/studio" @click="workspaceMenu=false">{{ $t('Studio') }}</NuxtLink><NuxtLink to="/faq" @click="workspaceMenu=false">{{ $t('FAQ') }}</NuxtLink><NuxtLink to="/agents" @click="workspaceMenu=false">{{ $t('Agents') }}</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener" @click="workspaceMenu=false">{{ $t('Tips') }}</a><button type="button" @click="openProjects">{{ $t('My projects') }}</button><button type="button" @click="openEditor">{{ $t('Storyboard') }}</button></nav>
 <main id="main-content" class="studio-landing-main" aria-labelledby="studio-heading"><AppToast /><h1 id="studio-heading" class="studio-page-title studio-crumb"><template v-if="store.project?.id && store.project.id !== 'starter-project'">{{ store.project.title }}</template><template v-else><span>{{ $t('Create') }}</span><span class="crumb-sep" aria-hidden="true">/</span><span>{{ experience==='guided' ? $t('Guided') : $t('Advanced mode') }}</span></template></h1>
  <div class="studio-workspace"><nav class="studio-project-tools" :aria-label="$t('Local project controls')"><button type="button" class="text-button" @click="openProjects"><FolderOpen :size="14" />{{ $t('My Projects') }}</button><button class="text-button studio-open-editor" type="button" @click="openEditor">{{ $t('Storyboard') }} <ArrowUpRight :size="13" /></button></nav>
   <div v-show="experience==='guided'"><StudioWizard @advanced="setExperience('advanced')" /></div>
   <div v-show="experience==='advanced'" class="studio-advanced"><p class="studio-advanced-bar"><button class="button button-secondary" type="button" @click="setExperience('guided')">{{ $t(wizardText('advanced.back')) }}</button></p><StudioCreationPanel /><StudioLandingGallery /></div>
  </div>
 </main>
 <AppModal v-if="showMoreTools" title="Edit your local storyboard" eyebrow="Storyboard" wide @close="showMoreTools=false"><StudioEditor /></AppModal>
 <AppModal v-if="panel==='library'" title="Your local projects" eyebrow="LIBRARY" @close="panel=null"><p>{{ $t('Projects stay in this browser. Save a project before leaving this device.') }}</p><div class="library-file-actions"><button class="button button-secondary" type="button" @click="exportJson"><Download :size="14" />{{ $t('Export JSON') }}</button><button class="button button-secondary" type="button" @click="exportLibrary"><Download :size="14" />{{ $t('Export library') }}</button><button class="button button-secondary" type="button" @click="importProject"><Upload :size="14" />{{ $t('Import project') }}</button></div><ul class="library-list"><li v-for="project in store.savedProjects" :key="project.id"><button type="button" @click="store.loadProject(project);panel=null"><strong>{{project.title}}</strong><span>{{ $t('{count} shots · {date}', { count: project.shots.length, date: project.updatedAt?.slice(0,10) }) }}</span></button><button type="button" class="text-link" @click="store.loadProject(project);panel=null">{{ $t('Open') }}</button></li></ul><p v-if="!store.savedProjects.length" class="empty-state">{{ $t('No saved projects yet. Write an idea, create the storyboard, then save it here.') }}</p><button v-if="!store.savedProjects.length" class="button button-primary" type="button" @click="focusIdea">{{ $t('Write an idea') }}</button><button class="button button-primary" type="button" @click="store.persist()"><Check :size="15" />{{ $t('Save current project') }}</button></AppModal>
 <SiteFooter />
</div></template>
