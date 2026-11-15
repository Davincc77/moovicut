<script setup>
import { computed } from 'vue'
import { cjkNameTip } from '~/utils/cjk-name-tip.js'

const props = defineProps({
  locale: { type: String, default: '' }
})

const text = computed(() => cjkNameTip(props.locale))
</script>

<template>
  <p v-if="text" class="studio-soft-hint" data-cjk-name-tip>{{ text }}</p>
</template>
