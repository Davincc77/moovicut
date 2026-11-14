<script setup>
import { ArrowUpRight, Check, Download, FolderOpen, Upload } from 'lucide-vue-next'
import { joinAppPath } from '~/utils/urls.js'
const store = useProjectStore()
const appBaseURL = useRuntimeConfig().app.baseURL
const { notify, downloadText } = useNotifier()
const showMoreTools = ref(false)
const panel = ref(null)
const workspaceMenu = ref(false)
const workspaceCollapsed = ref(false)
function exportJson() { try { downloadText(`${(store.project.title||'moovicut').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`,store.serialized) } catch(error){notify(error.message||'Could not export this project.','error')} }
function openImport(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=importJson;input.click()}
function importProject(){openImport()}
function focusIdea(){panel.value=null;nextTick(()=>document.getElementById('studio-idea')?.focus())}
function exportLibrary(){downloadText('moovicut-library.json',JSON.stringify({schema:'shotboard.backup.v1',projects:store.savedProjects,settings:store.settings},null,2),'application/json')}
async function importJson(event){const file=event.target.files?.[0];try{if(!file)return;const text=await file.text();const parsed=JSON.parse(text);if(parsed&&['shotboard.v1','shotboard.backup.v1'].includes(parsed.schema)&&Array.isArray(parsed.projects)){store.restoreBackup(parsed);notify('Local library restored.','success')}else store.importProject(text)}catch(error){notify(error.message||'Could not read this JSON file.','error')}finally{if(event.target)event.target.value=''}}
onMounted(()=>{const route=useRoute();if(route.hash==='#storyboard')showMoreTools.value=true;if(route.hash==='#library')panel.value='library';if(String(route.hash||'').includes('board='))return;const id=route.query.project;if(typeof id==='string'){const saved=store.savedProjects.find(project=>project.id===id);if(saved)store.loadProject(saved)}})
useSeoMeta({title:'Moovicut studio — free local storyboarding',description:'Free local storyboarding, shot editing, and JSON export on your device. No account is required.'})
</script>
<template><div class="studio-shell application-shell" :class="{'workspace-collapsed':workspaceCollapsed,'workspace-menu-open':workspaceMenu}">
 <WorkspaceSidebar @projects="panel='library'" @editor="showMoreTools=true" />
 <WorkspaceHeader :menu-open="workspaceMenu" @menu="workspaceMenu=!workspaceMenu" />
 <nav v-if="workspaceMenu" id="mobile-workspace-menu" class="workspace-mobile-nav" aria-label="Workspace navigation"><NuxtLink to="/" @click="workspaceMenu=false">Home</NuxtLink><NuxtLink to="/studio" @click="workspaceMenu=false">Studio</NuxtLink><NuxtLink to="/faq" @click="workspaceMenu=false">FAQ</NuxtLink><NuxtLink to="/agents" @click="workspaceMenu=false">Agents</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener" @click="workspaceMenu=false">Tips</a><button type="button" @click="panel='library';workspaceMenu=false">My projects</button><button type="button" @click="showMoreTools=true;workspaceMenu=false">Board tools</button></nav>
 <main id="main-content" class="studio-landing-main" aria-labelledby="studio-heading"><h1 id="studio-heading" class="studio-page-title">{{ store.project?.id && store.project.id !== 'starter-project' ? store.project.title : 'Create a storyboard' }}</h1>
  <div class="studio-workspace"><nav class="studio-project-tools" aria-label="Local project controls"><button type="button" class="text-button" @click="panel='library'"><FolderOpen :size="14" />My Projects</button><button class="text-button studio-open-editor" type="button" @click="showMoreTools=true">Board tools <ArrowUpRight :size="13" /></button></nav>
   <StudioCreationPanel />
   <StudioLandingGallery />
  </div>
 </main>
 <AppModal v-if="showMoreTools" title="Edit your local storyboard" eyebrow="Board tools" wide @close="showMoreTools=false"><StudioEditor /></AppModal>
 <AppModal v-if="panel==='library'" title="Your local projects" eyebrow="LIBRARY" @close="panel=null"><p>Projects stay in this browser. Save a project before leaving this device.</p><div class="library-file-actions"><button class="button button-secondary" type="button" @click="exportJson"><Download :size="14" />Export JSON</button><button class="button button-secondary" type="button" @click="exportLibrary"><Download :size="14" />Export library</button><button class="button button-secondary" type="button" @click="importProject"><Upload :size="14" />Import project</button></div><ul class="library-list"><li v-for="project in store.savedProjects" :key="project.id"><button type="button" @click="store.loadProject(project);panel=null"><strong>{{project.title}}</strong><span>{{project.shots.length}} shots · {{project.updatedAt?.slice(0,10)}}</span></button><button type="button" class="text-link" @click="store.loadProject(project);panel=null">Open</button></li></ul><p v-if="!store.savedProjects.length" class="empty-state">No saved projects yet. Write an idea, create the storyboard, then save it here.</p><button v-if="!store.savedProjects.length" class="button button-primary" type="button" @click="focusIdea">Write an idea</button><button class="button button-primary" type="button" @click="store.persist()"><Check :size="15" />Save current project</button></AppModal>
 <SiteFooter />
 <AppToast />
</div></template>
