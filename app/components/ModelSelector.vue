<script setup>
import { Check } from 'lucide-vue-next'
import { MODEL_OPTIONS } from '../integrations/models/model-registry.js'
defineProps({ model: { type: String, default: 'grok' }, options: { type: Array, default: () => MODEL_OPTIONS } })
const emit = defineEmits(['select'])
</script>
<template>
  <div class="model-selector" role="group" aria-label="Video model">
    <button v-for="option in options" :key="option.id" type="button" :class="{ selected: model === option.id }" :aria-pressed="model === option.id" @click="emit('select', option.id)">
      <span :class="option.markClass" aria-hidden="true">{{ option.mark }}</span>
      <span>{{ option.label }}<small>{{ option.note }}</small></span>
      <Check v-if="model === option.id" :size="11" />
    </button>
  </div>
</template>
