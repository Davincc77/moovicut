<script setup>
import { Copy, Plus, Redo2, Undo2 } from 'lucide-vue-next'
import { MODEL_OPTIONS, formatContinuitySheet } from '~/utils/prompt-engine.js'
import { joinAppPath } from '~/utils/urls.js'
import { STUDIO_INSPIRATIONS, promptImageSrc } from '~/utils/reference-content.js'
import { combinedShotPrompts, partShotPrompts, runOpenTarget } from '~/utils/open-targets.js'
import { asCharacter, lockLineFor } from '~/utils/character-lock.js'
import { assessShot } from '~/utils/shot-risk.js'
import { downloadBody } from '~/composables/useNotifier.js'
const store = useProjectStore()
const { locale, t } = useI18n()
// Top-level computeds. Nested refs on the plain store object are not unwrapped in the template.
const canUndo = computed(() => store.canUndo.value === true)
const canRedo = computed(() => Array.isArray(store.future.value) && store.future.value.length > 0)
const project = computed(() => store.project.value)
const totalSeconds = computed(() => Number(store.duration.value) || 0)
const { notify, copyText, downloadText } = useNotifier()
const boardSearch = ref('')
const editingShotId = ref(null)
const sheet = ref('')
const importInput = ref(null)
const confirmDialog = ref(null)
const shotFields = [['title', 'Title', 'input'], ['action', 'Action', 'textarea']]
const cameraFields = [['lens', 'Lens', 'input'], ['camera', 'Camera movement', 'input'], ['lighting', 'Lighting', 'input'], ['sound', 'Sound', 'input']]
const activeShot = computed(() => project.value.shots.find(shot => shot.id === editingShotId.value) || null)
const filteredShots = computed(() => {
  const query = boardSearch.value.trim().toLowerCase()
  return project.value.shots.filter(shot => !query || [shot.title, shot.stage, shot.action, shot.prompt].some(value => value?.toLowerCase().includes(query)))
})
const shotGroups = computed(() => {
  const shots = filteredShots.value
  const parts = project.value.parts
  if (!parts || parts.length < 2) return [{ key: 'all', part: null, shots }]
  return parts.map(part => ({ key: `part-${part.index}`, part, shots: shots.filter(shot => shot.order >= part.from && shot.order <= part.to) }))
})
const shotRisks = computed(() => activeShot.value ? assessShot(activeShot.value, project.value) : [])
const cast = computed(() => (project.value.filmSheet?.characters || []).map(character => {
  const person = asCharacter(character)
  return { name: person.name, line: lockLineFor(character, activeShot.value?.order || 1, locale.value || 'en') }
}).filter(item => item.name))
function partPrompt(part) { return partShotPrompts(project.value, part) }
function editShot(id) { editingShotId.value = id; sheet.value = 'shot' }
function openSettings() { sheet.value = 'settings' }
function closeSheet() { sheet.value = ''; }
function updateShotField(field, value) { if (activeShot.value) store.updateShotFields(activeShot.value.id, { [field]: value }) }
function onDragStart(event, id) { event.dataTransfer?.setData('text/plain', id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move' }
function moveTo(event, id) {
  const from = event.dataTransfer?.getData('text/plain')
  const start = project.value.shots.findIndex(shot => shot.id === from)
  const end = project.value.shots.findIndex(shot => shot.id === id)
  if (start < 0 || end < 0 || start === end) return
  const next = JSON.parse(JSON.stringify(project.value))
  const [moved] = next.shots.splice(start, 1)
  next.shots.splice(end, 0, moved)
  next.shots.forEach((item, index) => { item.order = index + 1 })
  store.commit(next, 'Shot order saved. Undo is available.')
}
function exportJson() {
  try { downloadText(`${(project.value.title || 'moovicut').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, downloadBody(store.serialized)) }
  catch (error) { notify(error.message || 'Could not export this project.', 'error') }
}
function openImport() { importInput.value?.click() }
async function importJson(event) {
  const file = event.target.files?.[0]
  try {
    if (!file) return
    const text = await file.text()
    const confirmed = await confirmDialog.value?.ask({
      title: t('Replace the open storyboard?'),
      message: t('Importing replaces the storyboard that is open.'),
      confirm: t('Replace')
    })
    if (!confirmed) return
    store.importProject(text)
  } catch (error) { notify(error.message || 'Could not read this JSON file.', 'error') }
  finally { if (event.target) event.target.value = '' }
}
async function copyAll() {
  const modeLabel = project.value.sequenceMode === 'varied' ? 'Varied shots' : 'Continuous story'
  const continuity = project.value.sequenceMode === 'continuous' && project.value.continuitySheet ? `${formatContinuitySheet(project.value.continuitySheet)}\n\n` : ''
  const text = `Mode: ${modeLabel}\n${continuity}` + project.value.shots.map((shot, index) => `Shot ${index + 1}: ${shot.title}\n${shot.prompt}`).join('\n\n')
  await copyText(text, 'All prompts copied.')
}
async function confirmDeleteShot(id) {
  const confirmed = await confirmDialog.value?.ask({
    title: t('Delete this shot?'),
    message: t('This removes the shot. Undo can bring it back.'),
    confirm: t('Delete')
  })
  if (confirmed) {
    store.removeShot(id)
    if (editingShotId.value === id) closeSheet()
  }
}
async function openElsewhere(id, prompt) {
  try {
    await runOpenTarget({
      id,
      prompt,
      copyText,
      open: url => window.open(url, '_blank', 'noopener,noreferrer'),
      pauseMs: 0
    })
  } catch (error) { notify(error.message || 'Could not open that tool.', 'error') }
}
function onExport(id) {
  if (id === 'json') exportJson()
  if (id === 'import') openImport()
}
</script>
<template>
  <div id="storyboard-workspace" class="studio-editor-content storyboard-workspace">
    <header class="studio-editor-heading">
      <div>
        <h2>{{ project.title }}</h2>
        <p>{{ $t('Local project · {count} shots · {seconds} seconds', { count: project.shots.length, seconds: totalSeconds }) }}</p>
      </div>
      <button class="text-button" type="button" @click="openSettings">{{ $t('Project settings') }}</button>
    </header>
    <div class="editor-toolbar storyboard-toolbar" role="toolbar" :aria-label="$t('Storyboard')">
      <button class="icon-button" type="button" :title="$t('Undo')" :aria-label="$t('Undo')" :disabled="!canUndo" @click="store.undo()"><Undo2 :size="16" aria-hidden="true" /></button>
      <button class="icon-button" type="button" :title="$t('Redo')" :aria-label="$t('Redo')" :disabled="!canRedo" @click="store.redo()"><Redo2 :size="16" aria-hidden="true" /></button>
      <label class="storyboard-search" for="editor-search">{{ $t('Search shots') }}<input id="editor-search" v-model="boardSearch" type="search" :placeholder="$t('Search your storyboard')" /></label>
      <button class="button button-secondary" type="button" @click="store.addShotAtEnd"><Plus :size="14" aria-hidden="true" />{{ $t('Add shot') }}</button>
      <ActionMenu :label="$t('Export')" :menu-label="$t('Export')">
        <button role="menuitem" type="button" @click="onExport('json')">{{ $t('Export JSON') }}</button>
        <hr />
        <button role="menuitem" type="button" :title="$t('Import')" @click="onExport('import')">{{ $t('Import JSON') }}</button>
      </ActionMenu>
      <button class="button button-primary" type="button" @click="copyAll"><Copy :size="14" aria-hidden="true" />{{ $t('Copy all prompts') }}</button>
    </div>
    <section class="storyboard-section" aria-labelledby="editor-storyboard-heading">
      <div class="studio-section-header">
        <div>
          <h3 id="editor-storyboard-heading">{{ $t('Storyboard') }}</h3>
          <p>{{ $t('Edit each shot, copy prompts or drag to reorder.') }}</p>
        </div>
        <span>{{ $t('{count} visible shots', { count: filteredShots.length }) }}</span>
      </div>
      <p v-if="project.parts && project.parts.length > 1" class="board-parts-note">{{ $t('Verified continuity up to 40 shots') }}</p>
      <template v-for="group in shotGroups" :key="group.key">
        <section v-if="group.part" class="board-part" :aria-label="$t('Part {index}', { index: group.part.index })">
          <header class="board-part-heading">
            <h3>{{ $t('Part {index}', { index: group.part.index }) }}</h3>
            <p>{{ $t('Shots {from}–{to}. Starts at {place}, {time}.', { from: group.part.from, to: group.part.to, place: group.part.place, time: group.part.time }) }}</p>
          </header>
          <div class="board-part-actions">
            <button class="button button-secondary" type="button" @click="copyText(partPrompt(group.part), `Part ${group.part.index} copied`)">{{ $t('Copy part {index}', { index: group.part.index }) }}</button>
            <OpenInButtons :prompt="partPrompt(group.part)" :seed="group.part.index" />
          </div>
        </section>
        <div class="shot-board">
          <ShotCard
            v-for="(shot, index) in group.shots"
            :key="shot.id"
            :shot="shot"
            :index="shot.order ? shot.order - 1 : index"
            :count="project.shots.length"
            @move="direction => store.moveShot(shot.id, direction)"
            @delete="confirmDeleteShot(shot.id)"
            @add="store.insertShot(shot.id)"
            @copy="copyText(shot.prompt, 'Shot prompt copied')"
            @edit="editShot(shot.id)"
            @dragshot="onDragStart"
            @move-to="moveTo"
            @open-in="target => openElsewhere(target, shot.prompt)"
            @regenerate="store.regenerateOne(shot.id)"
          />
        </div>
      </template>
      <p v-if="!filteredShots.length" class="empty-state">{{ $t('No shots match your search.') }}</p>
      <details class="sheet-fold">
        <summary>{{ $t('Storyboard studies') }}</summary>
        <div class="studio-generated-grid" :aria-label="$t('Storyboard reference images')">
          <picture v-for="(shot, index) in project.shots.slice(0, 9)" :key="shot.id">
            <source :srcset="joinAppPath(useRuntimeConfig().app.baseURL, promptImageSrc(STUDIO_INSPIRATIONS[index % STUDIO_INSPIRATIONS.length].file, 'webp'))" type="image/webp" />
            <img :src="joinAppPath(useRuntimeConfig().app.baseURL, promptImageSrc(STUDIO_INSPIRATIONS[index % STUDIO_INSPIRATIONS.length].file, 'jpg'))" :alt="$t('{title} storyboard study', { title: shot.title })" width="1280" height="720" loading="lazy" decoding="async" />
          </picture>
        </div>
      </details>
      <details class="sheet-fold">
        <summary>{{ $t('Open the whole board') }}</summary>
        <OpenInButtons :prompt="combinedShotPrompts(project)" :seed="1" />
      </details>
    </section>
    <p class="form-note">{{ $t('Local planning and source/JSON exports only. External providers handle their own accounts and rendering charges.') }}</p>
    <input ref="importInput" class="sr-only" type="file" accept=".json,application/json" :aria-label="$t('Import Moovicut project')" @change="importJson" />
    <SideSheet v-if="sheet" :title="activeShot ? $t('Edit {title}', { title: $t(activeShot.title) }) : $t('Project settings')" @close="closeSheet">
      <details class="sheet-fold" :open="sheet === 'settings'">
        <summary>{{ $t('Project settings') }}</summary>
        <label for="editor-title">{{ $t('Project title') }}<input id="editor-title" :value="project.title" @change="store.commit({ ...project, title: $event.target.value }, 'Project title saved')" /></label>
        <label for="editor-model">{{ $t('Prompt model') }}<select id="editor-model" :value="project.model" @change="store.selectModel($event.target.value)"><option v-for="option in MODEL_OPTIONS" :key="option.id" :value="option.id">{{ option.label }}</option></select></label>
        <button class="button button-secondary" type="button" @click="store.persist()">{{ $t('Save') }}</button>
      </details>
      <div v-if="activeShot" class="studio-shot-detail">
        <p v-if="activeShot.stage">{{ $t(activeShot.stage) }}</p>
        <p v-if="activeShot.source" class="shot-source">{{ activeShot.source }}</p>
        <p v-if="activeShot.flags?.length" class="shot-source">{{ activeShot.flags.map(flag => `${flag.field}: ${flag.code}`).join(', ') }}</p>
        <FramingPicker :shot="activeShot" label="Framing" />
        <p>{{ $t('Changes save locally and can be undone.') }}</p>
        <label v-for="[field, label, type] in shotFields" :key="field">{{ $t(label) }}<textarea v-if="type === 'textarea'" :value="activeShot[field]" @change="updateShotField(field, $event.target.value)"></textarea><input v-else :value="activeShot[field]" :aria-label="field === 'title' ? $t('Shot title') : undefined" @change="updateShotField(field, $event.target.value)" /></label>
        <label>{{ $t('Duration (seconds)') }}<input type="number" min="2" max="15" :value="activeShot.duration" @change="updateShotField('duration', Number($event.target.value))" /></label>
        <label>{{ $t('Complete prompt') }}<textarea :value="activeShot.prompt" @change="updateShotField('prompt', $event.target.value)"></textarea></label>
        <p v-if="activeShot.promptEdited" class="studio-edited-mark">{{ $t('Edited by you') }}</p>
        <ul v-if="shotRisks.length" class="studio-risk-list">
          <li v-for="item in shotRisks" :key="item.code + item.message"><strong>{{ $t(item.message) }}</strong> {{ $t(item.fix) }} <button v-if="item.fixId" type="button" class="studio-fix-button" @click="store.applyShotFix(item)">{{ $t('Fix') }}</button></li>
        </ul>
        <details class="sheet-fold">
          <summary>{{ $t('Camera') }}</summary>
          <label v-for="[field, label, type] in cameraFields" :key="field">{{ $t(label) }}<textarea v-if="type === 'textarea'" :value="activeShot[field]" @change="updateShotField(field, $event.target.value)"></textarea><input v-else :value="activeShot[field]" @change="updateShotField(field, $event.target.value)" /></label>
        </details>
        <details class="sheet-fold">
          <summary>{{ $t('Continuity') }}</summary>
          <label>{{ $t('Continuity') }}<textarea :value="activeShot.continuity" @change="updateShotField('continuity', $event.target.value)"></textarea></label>
        </details>
        <details class="sheet-fold">
          <summary>{{ $t('Characters') }}</summary>
          <p v-if="!cast.length">{{ $t('No characters on this sheet yet.') }}</p>
          <ul v-else class="sheet-cast">
            <li v-for="person in cast" :key="person.name"><strong>{{ person.name }}</strong><p>{{ person.line }}</p></li>
          </ul>
        </details>
        <div class="sheet-shot-actions">
          <button class="text-button" type="button" @click="store.regenerateOne(activeShot.id)">{{ $t('Regenerate this shot') }}</button>
          <button v-if="activeShot.promptEdited" class="text-button" type="button" @click="store.resetShotPrompt(activeShot.id)">{{ $t('Reset') }}</button>
          <button v-if="store.promptUndo && store.promptUndo.id === activeShot.id" class="text-button" type="button" @click="store.restorePromptUndo()">{{ $t('Undo') }}</button>
          <button class="text-link" type="button" @click="copyText(activeShot.prompt, 'Complete prompt copied')"><Copy :size="14" aria-hidden="true" />{{ $t('Copy complete prompt') }}</button>
        </div>
      </div>
    </SideSheet>
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
