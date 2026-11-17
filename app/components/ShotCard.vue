<script setup>
import { Copy, Ellipsis } from 'lucide-vue-next'
import { assessShot } from '~/utils/shot-risk.js'
const props = defineProps({
  shot: { type: Object, required: true },
  index: { type: Number, required: true },
  count: { type: Number, required: true }
})
const store = useProjectStore()
const risks = computed(() => assessShot(props.shot, store.project.value))
const emit = defineEmits(['move', 'delete', 'add', 'copy', 'edit', 'dragshot', 'move-to', 'open-in', 'regenerate'])

function onDragStart(event) {
  if (event.target.closest('button')) {
    event.preventDefault()
    return
  }
  emit('dragshot', event, props.shot.id)
}
</script>
<template>
  <article
    class="shot-card card shot-card-quiet"
    :data-shot-id="shot.id"
    draggable="true"
    @dragstart="onDragStart"
    @dragover.prevent
    @drop="emit('move-to', $event, shot.id)"
  >
    <span class="sr-only">{{ $t('Drag to reorder') }}</span>
    <button class="shot-card-open" type="button" :title="$t('Edit shot')" :aria-label="$t('Edit shot {n}: {title}', { n: index + 1, title: $t(shot.title) })" @click="emit('edit')">
      <span class="shot-number">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="shot-card-title">{{ $t(shot.title) }}</span>
      <span class="shot-thumbnail" :class="`scene-shot-${index % 6}`">
        <SceneArt :index="index" :title="$t('Original scene illustration for {title}', { title: shot.title })" />
      </span>
    </button>
    <div class="shot-card-actions">
      <button class="button button-secondary" type="button" :aria-label="$t('Copy prompt for shot {n}', { n: index + 1 })" @click="emit('copy')"><Copy :size="14" aria-hidden="true" />{{ $t('Copy') }}</button>
      <ActionMenu :label="$t('Actions for shot {n}', { n: index + 1 })" :menu-label="$t('Actions for shot {n}', { n: index + 1 })">
        <template #trigger><Ellipsis :size="18" aria-hidden="true" /></template>
        <button role="menuitem" type="button" @click="emit('open-in', 'grok')">{{ $t('Open in Grok Imagine') }}</button>
        <button role="menuitem" type="button" @click="emit('open-in', 'google')">{{ $t('Open in Google') }}</button>
        <button role="menuitem" type="button" @click="emit('regenerate')">{{ $t('Regenerate this shot') }}</button>
        <button role="menuitem" type="button" :disabled="index === 0" :title="$t('Move shot earlier')" @click="emit('move', -1)">{{ $t('Move earlier') }}</button>
        <button role="menuitem" type="button" :disabled="index === count - 1" :title="$t('Move shot later')" @click="emit('move', 1)">{{ $t('Move later') }}</button>
        <button role="menuitem" type="button" @click="emit('add')">{{ $t('Add shot after {n}', { n: index + 1 }) }}</button>
        <button role="menuitem" type="button" @click="emit('delete')">{{ $t('Delete') }}</button>
      </ActionMenu>
    </div>
    <p v-if="risks.length" class="sr-only">{{ risks.map(item => item.message).join(' ') }}</p>
  </article>
</template>
