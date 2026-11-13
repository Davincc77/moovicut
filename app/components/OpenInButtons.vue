<script setup>
import { orderedOpenTargets, runOpenTarget } from '~/utils/open-targets.js'
const props = defineProps({ prompt: { type: String, default: '' }, seed: { type: Number, default: 0 } })
const { copyText, notify } = useNotifier()
const targets = computed(() => orderedOpenTargets(props.seed))
const copiedId = ref('')
let copiedTimer
async function openIn(id) {
  try {
    await runOpenTarget({
      id,
      prompt: props.prompt,
      copyText: async (text, message) => {
        const copied = await copyText(text, message)
        if (copied) {
          copiedId.value = id
          clearTimeout(copiedTimer)
          copiedTimer = setTimeout(() => { copiedId.value = '' }, 2500)
        }
        return copied
      },
      open: url => window.open(url, '_blank', 'noopener,noreferrer')
    })
  } catch (error) {
    notify(error.message || 'Could not open that tool.', 'error')
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>
<template>
  <div class="open-in-actions" role="group" aria-label="Open prompt elsewhere">
    <button v-for="target in targets" :key="target.id" class="open-in-button" :class="{ 'is-copied': copiedId === target.id }" type="button" @click="openIn(target.id)">{{ copiedId === target.id ? 'Prompt copied' : target.label }}</button>
  </div>
</template>
