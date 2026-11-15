<script setup>
import { FRAMING_TERMS, framingOptionLabel, suggestFraming } from '~/utils/framing.js'

const props = defineProps({
  shot: { type: Object, required: true },
  label: { type: String, default: 'Framing' }
})
const store = useProjectStore()
const fieldId = computed(() => `framing-${props.shot.id || props.shot.shot_id}`)
const selected = computed(() => props.shot.framingChosen && props.shot.framingTerm ? props.shot.framingTerm : suggestFraming(props.shot).id)

function choose(event) {
  store.setFraming(props.shot.id || props.shot.shot_id, event.target.value)
}
</script>

<template>
  <div class="framing-picker">
    <label :for="fieldId">{{ label }}</label>
    <select :id="fieldId" :value="selected" @change="choose">
      <option v-for="term in FRAMING_TERMS" :key="term.id" :value="term.id">{{ framingOptionLabel(term) }}</option>
    </select>
  </div>
</template>
