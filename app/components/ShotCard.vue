<script setup>
import { GripVertical, ChevronUp, ChevronDown, Plus, Trash2, Copy, Pencil, Check, Maximize2 } from 'lucide-vue-next'
import { assessShot } from '~/utils/shot-risk.js'
const props = defineProps({ shot: { type: Object, required: true }, index: { type: Number, required: true }, count: { type: Number, required: true }, model: String, warnings: { type: Array, default: () => [] } })
const store = useProjectStore()
const risks = computed(() => props.warnings.length ? props.warnings : assessShot(props.shot, store.project.value))
const emit = defineEmits(['move', 'delete', 'add', 'copy', 'update-title', 'edit', 'dragshot', 'move-to'])
const isEditingTitle = ref(false)
const draftTitle = ref(props.shot.title)
function saveTitle() { if (draftTitle.value.trim()) emit('update-title', draftTitle.value); else draftTitle.value = props.shot.title; isEditingTitle.value = false }
</script>
<template>
  <article class="shot-card card" :data-shot-id="shot.id" draggable="true" @dragstart="emit('dragshot', $event, shot.id)" @dragover.prevent @drop="emit('move-to', $event, shot.id)">
    <div class="shot-card-grip" title="Drag to reorder"><GripVertical :size="16" /></div>
    <div class="shot-card-header"><span class="shot-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="shot-stage">{{ shot.stage }}</span><div class="shot-hover-tools"><button class="icon-button" :disabled="index===0" title="Move earlier" aria-label="Move shot earlier" @click="emit('move', -1)"><ChevronUp :size="13" /></button><button class="icon-button" :disabled="index===count-1" title="Move later" aria-label="Move shot later" @click="emit('move', 1)"><ChevronDown :size="13" /></button></div></div>
    <button class="shot-thumbnail" :class="`scene-shot-${index % 6}`" :aria-label="`Edit shot ${index + 1}: ${shot.title}`" @click="emit('edit')"><SceneArt :index="index" :title="`Original scene illustration for ${shot.title}`" /><span class="shot-frame-label"><span>{{ shot.id.replace('shot-','') }}</span><Maximize2 :size="11" /></span><div class="scene-reticle"></div><div class="frame-corners"></div></button>
    <div class="shot-body"><div class="shot-title-row"><template v-if="isEditingTitle"><input v-model="draftTitle" class="shot-title-input" aria-label="Shot title" @keyup.enter="saveTitle" @keyup.escape="isEditingTitle=false" /><button class="icon-button" aria-label="Save shot title" @click="saveTitle"><Check :size="13" /></button></template><template v-else><h3>{{ shot.title }}</h3><button class="icon-button edit-shot-title" :aria-label="`Edit title for shot ${index + 1}`" @click="isEditingTitle=true; draftTitle=shot.title"><Pencil :size="12" /></button></template></div><p class="shot-description">{{ shot.action }}</p>
      <div class="shot-meta"><span>{{ shot.framing?.replace(' establishing shot','').replace('Medium tracking shot','Medium tracking') }}</span><span>{{ shot.duration }}s</span><span>{{ shot.lens?.split(' ')[0] }}</span></div>
      <div class="shot-prompt"><p>{{ shot.prompt }}</p><p v-if="shot.promptEdited" class="studio-edited-mark">Edited by you</p><p v-for="item in risks" :key="item.code" class="studio-edited-mark">{{ item.message }}</p></div>
    </div>
    <div class="shot-card-footer"><span class="model-tag"><span :class="model === 'google' ? 'google-glyph' : 'x-glyph'">{{ model === 'google' ? 'G' : '𝕏' }}</span>{{ model === 'google' ? 'Google (Veo / Gemini)' : 'Grok Imagine' }}</span><button class="copy-prompt-button" :aria-label="`Copy prompt for shot ${index + 1}`" @click="emit('copy')"><Copy :size="13" />Copy prompt</button><button class="copy-prompt-button" type="button" @click="store.regenerateOne(shot.id)">Regenerate this shot</button><OpenInButtons :prompt="shot.prompt" :seed="index" /></div>
    <div class="shot-card-bottom-actions"><button :aria-label="`Add shot after ${index + 1}`" @click="emit('add')"><Plus :size="12" />Add shot</button><button class="delete-shot-button" :aria-label="`Delete shot ${index + 1}`" @click="emit('delete')"><Trash2 :size="12" />Delete</button><button @click="emit('edit')"><Pencil :size="12" />Edit shot</button></div>
  </article>
</template>

