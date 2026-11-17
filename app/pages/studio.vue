<script setup>
import { Check, Ellipsis, FolderOpen } from 'lucide-vue-next'
import { socialPreviewSeo } from '~/utils/social-preview.js'
import { wizardText } from '~/utils/wizard-strings.js'
import { downloadBody } from '~/composables/useNotifier.js'
const store = useProjectStore()
const { t } = useI18n()
const runtimeConfig = useRuntimeConfig()
const appBaseURL = runtimeConfig.app.baseURL
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, appBaseURL)
const { notify, downloadText } = useNotifier()
const experience = ref('guided')
const workspace = ref('create')
const projectsOpen = ref(false)
const workspaceMenu = ref(false)
const renamingId = ref('')
const renameDraft = ref('')
const confirmDialog = ref(null)
const importInput = ref(null)
function exportJson() { try { downloadText(`${(store.project.title||'moovicut').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`, downloadBody(store.serialized)) } catch(error){notify(error.message||'Could not export this project.','error')} }
function exportLibrary(){const settings=store.settings?.value??store.settings;downloadText('moovicut-library.json',JSON.stringify({schema:'shotboard.backup.v1',projects:store.savedProjects,settings},null,2),'application/json')}
function openImport(){ importInput.value?.click() }
async function importJson(event){
  const file=event.target.files?.[0]
  try {
    if(!file)return
    const text=await file.text()
    const parsed=JSON.parse(text)
    const backup=parsed&&['shotboard.v1','shotboard.backup.v1'].includes(parsed.schema)&&Array.isArray(parsed.projects)
    const confirmed=await confirmDialog.value?.ask({
      title: backup ? t('Replace the saved projects?') : t('Replace the open storyboard?'),
      message: backup ? t('This file replaces the projects saved in this browser.') : t('Importing replaces the storyboard that is open.'),
      confirm: t('Replace')
    })
    if(!confirmed)return
    if(backup){store.restoreBackup(parsed);notify('Local library restored.','success')}
    else store.importProject(text)
  } catch(error){notify(error.message||'Could not read this JSON file.','error')}
  finally { if(event.target)event.target.value='' }
}
function focusIdea(){
  projectsOpen.value=false
  workspace.value='create'
  if(experience.value!=='guided') setExperience('guided')
  nextTick(()=>window.dispatchEvent(new CustomEvent('moovicut-focus-idea')))
}
function openProjects(){ projectsOpen.value=true; workspaceMenu.value=false }
function openEditor(){ workspace.value='storyboard'; projectsOpen.value=false; workspaceMenu.value=false }
function openCreate(){ workspace.value='create'; workspaceMenu.value=false }
function setExperience(next){ experience.value=next; try{localStorage.setItem('moovicut.studio.experience',next)}catch{} }
function startRename(project){ renamingId.value=project.id; renameDraft.value=project.title }
function saveRename(project){ store.renameSavedProject(project.id, renameDraft.value); renamingId.value='' }
async function confirmDeleteProject(project){
  const confirmed=await confirmDialog.value?.ask({
    title: t('Delete this project?'),
    message: t('This removes the saved project from this browser.'),
    confirm: t('Delete')
  })
  if(confirmed) store.removeSavedProject(project.id)
}
onMounted(()=>{
  const route=useRoute()
  const hash=String(route.hash||'')
  if(hash.includes('board=')) experience.value='advanced'
  else { try{ const saved=localStorage.getItem('moovicut.studio.experience'); if(saved==='advanced'||saved==='guided') experience.value=saved }catch{} }
  if(route.hash==='#storyboard') workspace.value='storyboard'
  if(route.hash==='#library') projectsOpen.value=true
  if(hash.includes('board=')) return
  const id=route.query.project
  if(typeof id==='string'){ const saved=store.savedProjects.find(project=>project.id===id); if(saved) store.loadProject(saved) }
})
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
<template>
  <div class="studio-shell application-shell" :class="{'workspace-menu-open':workspaceMenu}">
    <a class="skip-link" href="#main-content">{{ $t('Skip to content') }}</a>
    <WorkspaceSidebar @projects="openProjects" @editor="openEditor" @create="openCreate" />
    <WorkspaceHeader :menu-open="workspaceMenu" @menu="workspaceMenu=!workspaceMenu">
      <template #tools>
        <button v-if="experience==='guided' && workspace==='create'" class="text-link" type="button" @click="setExperience('advanced')">{{ $t('Advanced mode') }}</button>
        <button v-else-if="workspace==='create'" class="text-link" type="button" @click="setExperience('guided')">{{ $t(wizardText('advanced.back')) }}</button>
      </template>
    </WorkspaceHeader>
    <nav v-if="workspaceMenu" id="mobile-workspace-menu" class="workspace-mobile-nav" :aria-label="$t('Workspace navigation')">
      <NuxtLink to="/" @click="workspaceMenu=false">{{ $t('Home') }}</NuxtLink>
      <NuxtLink to="/studio" @click="openCreate">{{ $t('Studio') }}</NuxtLink>
      <NuxtLink to="/faq" @click="workspaceMenu=false">{{ $t('FAQ') }}</NuxtLink>
      <NuxtLink to="/agents" @click="workspaceMenu=false">{{ $t('Agents') }}</NuxtLink>
      <a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener" @click="workspaceMenu=false">{{ $t('Tips') }}</a>
      <button type="button" @click="openProjects">{{ $t('My projects') }}</button>
      <button type="button" @click="openEditor">{{ $t('Storyboard') }}</button>
    </nav>
    <main id="main-content" class="studio-landing-main" aria-labelledby="studio-heading">
      <AppToast />
      <h1 id="studio-heading" class="studio-page-title studio-crumb">
        <template v-if="workspace==='storyboard'">{{ $t('Storyboard') }}</template>
        <template v-else-if="store.project?.id && store.project.id !== 'starter-project'">{{ store.project.title }}</template>
        <template v-else><span>{{ $t('Create') }}</span><span class="crumb-sep" aria-hidden="true">/</span><span>{{ experience==='guided' ? $t('Guided') : $t('Advanced mode') }}</span></template>
      </h1>
      <div class="studio-workspace">
        <nav class="studio-project-tools" :aria-label="$t('Local project controls')">
          <button type="button" class="text-button" @click="openProjects"><FolderOpen :size="14" aria-hidden="true" />{{ $t('My Projects') }}</button>
          <button class="text-button studio-open-editor" type="button" @click="openEditor">{{ $t('Storyboard') }}</button>
        </nav>
        <div v-show="workspace==='create' && experience==='guided'"><StudioWizard @advanced="setExperience('advanced')" /></div>
        <div v-show="workspace==='create' && experience==='advanced'" class="studio-advanced">
          <p class="studio-advanced-bar"><button class="button button-secondary" type="button" @click="setExperience('guided')">{{ $t(wizardText('advanced.back')) }}</button></p>
          <StudioCreationPanel />
        </div>
        <div v-show="workspace==='storyboard'"><StudioEditor /></div>
      </div>
    </main>
    <SideSheet v-if="projectsOpen" :title="$t('Your local projects')" @close="projectsOpen=false">
      <p>{{ $t('Projects stay in this browser. Save a project before leaving this device.') }}</p>
      <button class="button button-primary" type="button" @click="store.persist()"><Check :size="15" aria-hidden="true" />{{ $t('Save current project') }}</button>
      <ul class="library-list">
        <li v-for="project in store.savedProjects" :key="project.id">
          <div class="library-row">
            <button v-if="renamingId!==project.id" type="button" @click="store.loadProject(project);projectsOpen=false"><strong>{{ project.title }}</strong><span>{{ $t('{count} shots · {date}', { count: project.shots.length, date: project.updatedAt?.slice(0,10) }) }}</span></button>
            <label v-else class="library-rename">{{ $t('New name') }}<input :value="renameDraft" :aria-label="$t('Rename {title}', { title: project.title })" @input="renameDraft=$event.target.value" @keydown.enter.prevent="saveRename(project)" /></label>
            <ActionMenu :label="$t('Actions for {title}', { title: project.title })">
              <template #trigger><Ellipsis :size="18" aria-hidden="true" /></template>
              <button role="menuitem" type="button" @click="store.loadProject(project);projectsOpen=false">{{ $t('Open') }}</button>
              <button role="menuitem" type="button" @click="startRename(project)">{{ $t('Rename') }}</button>
              <button role="menuitem" type="button" @click="confirmDeleteProject(project)">{{ $t('Delete') }}</button>
            </ActionMenu>
          </div>
        </li>
      </ul>
      <p v-if="!store.savedProjects.length" class="empty-state">{{ $t('No saved projects yet. Create the storyboard, then save it here.') }} <a href="#wizard-idea" @click.prevent="focusIdea">{{ $t('Write an idea') }}</a></p>
      <details class="sheet-fold backup-transfer">
        <summary>{{ $t('Backup & transfer') }}</summary>
        <div class="library-file-actions">
          <button class="button button-secondary" type="button" @click="exportJson">{{ $t('Export JSON') }}</button>
          <button class="button button-secondary" type="button" @click="exportLibrary">{{ $t('Export library') }}</button>
          <button class="button button-secondary" type="button" @click="openImport">{{ $t('Import project') }}</button>
        </div>
      </details>
      <input ref="importInput" class="sr-only" type="file" accept=".json,application/json" :aria-label="$t('Import Moovicut project')" @change="importJson" />
    </SideSheet>
    <ConfirmDialog ref="confirmDialog" />
    <SiteFooter />
  </div>
</template>
