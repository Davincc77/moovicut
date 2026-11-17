<script setup>
import { GripVertical, ChevronUp, ChevronDown, Plus, Trash2, Copy, Pencil, Check, Maximize2 } from 'lucide-vue-next'
import { assessShot } from '~/utils/shot-risk.js'
import { MODEL_OPTIONS } from '~/utils/prompt-engine.js'
const props = defineProps({ shot: { type: Object, required: true }, index: { type: Number, required: true }, count: { type: Number, required: true }, model: String, warnings: { type: Array, default: () => [] } })
const store = useProjectStore()
const risks = computed(() => props.warnings.length ? props.warnings : assessShot(props.shot, store.project.value))
const target = computed(() => MODEL_OPTIONS.find(item => item.id === props.model) || MODEL_OPTIONS[0])
const emit = defineEmits(['move', 'delete', 'add', 'copy', 'update-title', 'edit', 'dragshot', 'move-to'])
const isEditingTitle = ref(false)
const draftTitle = ref(props.shot.title)
function saveTitle() { if (draftTitle.value.trim()) emit('update-title', draftTitle.value); else draftTitle.value = props.shot.title; isEditingTitle.value = false }
</script>
<template>
  <article class="shot-card card" :data-shot-id="shot.id" draggable="true" @dragstart="emit('dragshot', $event, shot.id)" @dragover.prevent @drop="emit('move-to', $event, shot.id)">
    <div class="shot-card-grip" role="img" :aria-label="$t('Drag to reorder')"><GripVertical :size="16" aria-hidden="true" /></div>
    <div class="shot-card-header"><span class="shot-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="shot-stage">{{ shot.stage }}</span><div class="shot-hover-tools"><button class="icon-button" :disabled="index===0" :title="$t('Move earlier')" :aria-label="$t('Move shot earlier')" @click="emit('move', -1)"><ChevronUp :size="13" /></button><button class="icon-button" :disabled="index===count-1" :title="$t('Move later')" :aria-label="$t('Move shot later')" @click="emit('move', 1)"><ChevronDown :size="13" /></button></div></div>
    <button class="shot-thumbnail" :class="`scene-shot-${index % 6}`" :aria-label="$t('Edit shot {n}: {title}', { n: index + 1, title: shot.title })" @click="emit('edit')"><SceneArt :index="index" :title="$t('Original scene illustration for {title}', { title: shot.title })" /><span class="shot-frame-label"><span>{{ shot.id.replace('shot-','') }}</span><Maximize2 :size="11" /></span><div class="scene-reticle"></div><div class="frame-corners"></div></button>
    <div class="shot-body"><p v-if="shot.source" class="shot-source">{{ shot.source }}</p><p v-if="shot.flags?.length" class="shot-source">{{ shot.flags.map(flag => `${flag.field}: ${flag.code}`).join(', ') }}</p><div class="shot-title-row"><template v-if="isEditingTitle"><input v-model="draftTitle" class="shot-title-input" :aria-label="$t('Shot title')" @keyup.enter="saveTitle" @keyup.escape="isEditingTitle=false" /><button class="icon-button" :aria-label="$t('Save shot title')" @click="saveTitle"><Check :size="13" /></button></template><template v-else><h3>{{ shot.title }}</h3><button class="icon-button edit-shot-title" :aria-label="$t('Edit title for shot {n}', { n: index + 1 })" @click="isEditingTitle=true; draftTitle=shot.title"><Pencil :size="12" /></button></template></div><p class="shot-description">{{ shot.action }}</p><p v-if="shot.source" class="shot-source">{{ shot.source }}</p><p v-if="shot.flags?.length" class="shot-source">{{ shot.flags.map(flag => `${flag.field}: ${flag.code}`).join(', ') }}</p>
      <div class="shot-meta"><span>{{ shot.framing?.replace(' establishing shot','').replace('Medium tracking shot','Medium tracking') }}</span><span>{{ shot.duration }}s</span><span>{{ shot.lens?.split(' ')[0] }}</span></div>
      <div class="shot-prompt"><p>{{ shot.prompt }}</p><p v-if="shot.promptEdited" class="studio-edited-mark">{{ $t('Edited by you') }}</p><p v-for="item in risks" :key="item.code + item.message" class="studio-edited-mark">{{ $t(item.message) }} <button v-if="item.fixId" type="button" class="studio-fix-button" @click="store.applyShotFix(item)">{{ $t('Fix') }}</button></p></div>
    </div>
    <div class="shot-card-footer"><span class="model-tag"><span :class="model === 'google' ? 'google-glyph' : 'x-glyph'">{{ target.mark }}</span>{{ target.label }}</span><button class="copy-prompt-button" :aria-label="$t('Copy prompt for shot {n}', { n: index + 1 })" @click="emit('copy')"><Copy :size="13" />{{ $t('Copy prompt') }}</button><button class="copy-prompt-button" type="button" @click="store.regenerateOne(shot.id)">{{ $t('Regenerate this shot') }}</button><OpenInButtons :prompt="shot.prompt" :seed="index" /></div>
    <div class="shot-card-bottom-actions"><button :aria-label="$t('Add shot after {n}', { n: index + 1 })" @click="emit('add')"><Plus :size="12" />{{ $t('Add shot') }}</button><button class="delete-shot-button" :aria-label="$t('Delete shot {n}', { n: index + 1 })" @click="emit('delete')"><Trash2 :size="12" />{{ $t('Delete') }}</button><button @click="emit('edit')"><Pencil :size="12" />{{ $t('Edit shot') }}</button></div>
  </article>
</template>

