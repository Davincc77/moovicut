<script setup>
import { editCut } from '~/utils/scene-split.js'

const props = defineProps({
  cuts: { type: Array, default: () => [] }
})
const emit = defineEmits(['merge', 'split'])
const { t } = useI18n()
const local = ref([])

watch(() => props.cuts, value => {
  local.value = (value || []).map(cut => ({ ...cut }))
}, { immediate: true, deep: true })

function merge(index) {
  local.value = editCut(local.value, index, 'merge')
  emit('merge', { ...local.value[index], index })
}

function split(index) {
  local.value = editCut(local.value, index, 'split')
  emit('split', { ...local.value[index], index })
}
</script>

<template>
  <section class="scene-cuts" :aria-label="t('Scene cuts')">
    <h3>{{ t('Scene cuts') }}</h3>
    <p>{{ t('Before generating, these are the cuts found in the story. Nothing is sent to a model.') }}</p>
    <p v-if="!local.length">{{ t('No scene cut in this text.') }}</p>
    <ol v-else>
      <li v-for="(cut, index) in local" :key="`${cut.order}-${index}`" :data-uncertain="cut.uncertain ? 'true' : 'false'" :data-kind="cut.kind">
        <p>
          <span v-if="cut.uncertain">{{ t('Uncertain cut') }}. </span>
          {{ cut.kind === 'scene' ? t('Cut here: {cue}', { cue: cut.cue || cut.reason }) : t('New shot in this scene: {cue}', { cue: cut.cue || cut.reason }) }}
        </p>
        <p v-if="cut.reason">{{ t('Reason: {reason}', { reason: cut.reason }) }}</p>
        <button v-if="cut.kind === 'scene'" type="button" class="button button-secondary" @click="merge(index)">{{ t('Merge with the previous scene') }}</button>
        <button v-else type="button" class="button button-secondary" @click="split(index)">{{ t('Split into a new scene') }}</button>
      </li>
    </ol>
  </section>
</template>
