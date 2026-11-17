<script setup>
import { Download } from 'lucide-vue-next'
const deferred = ref(null)
const installed = ref(false)
function onPrompt(event) {
  event.preventDefault()
  deferred.value = event
}
function onInstalled() {
  installed.value = true
  deferred.value = null
}
onMounted(() => {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  installed.value = standalone
  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onPrompt)
  window.removeEventListener('appinstalled', onInstalled)
})
async function install() {
  const event = deferred.value
  if (!event?.prompt) return
  await event.prompt()
  deferred.value = null
}
</script>
<template>
  <button v-if="deferred && !installed" class="text-button install-button" type="button" :aria-label="$t('Install app')" @click="install"><Download :size="14" /><span>{{ $t('Install app') }}</span></button>
</template>
