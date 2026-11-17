<script setup>
defineProps({ title: { type: String, required: true } })
const emit = defineEmits(['close'])
const dialog = ref(null)
const modal = ref(true)
const labelId = `side-sheet-${Math.random().toString(36).slice(2, 9)}`
let opener = null
let media = null

function phone() { return window.matchMedia('(max-width: 819px)').matches }

function present() {
  const el = dialog.value
  if (!el) return
  modal.value = phone()
  if (el.open) el.close()
  if (modal.value) el.showModal()
  else el.show()
  el.querySelector('[data-sheet-close]')?.focus()
}

function requestClose() {
  dialog.value?.close()
}

function onDialogClose() {
  if (!modal.value && opener?.isConnected) opener.focus()
  emit('close')
}

function onCancel(event) {
  if (event.cancelable) event.preventDefault()
  requestClose()
}

function onKey(event) {
  if (event.key !== 'Escape' || modal.value || !dialog.value?.open) return
  event.preventDefault()
  requestClose()
}

function onMedia() {
  if (!dialog.value?.open) return
  const next = phone()
  if (next === modal.value) return
  const el = dialog.value
  el.close()
  modal.value = next
  if (next) el.showModal()
  else el.show()
}

onMounted(() => {
  opener = document.activeElement
  media = window.matchMedia('(max-width: 819px)')
  media.addEventListener('change', onMedia)
  document.addEventListener('keydown', onKey)
  present()
})
onBeforeUnmount(() => {
  media?.removeEventListener('change', onMedia)
  document.removeEventListener('keydown', onKey)
  if (dialog.value?.open) dialog.value.close()
})
</script>

<template>
  <Teleport to="body">
    <button v-if="!modal" class="side-sheet-scrim" type="button" :aria-label="$t('Close panel')" @click="requestClose"></button>
    <dialog
      ref="dialog"
      class="side-sheet modal-panel"
      :class="{ 'is-modal': modal }"
      :aria-labelledby="labelId"
      @close="onDialogClose"
      @cancel="onCancel"
    >
      <header class="side-sheet-header">
        <h2 :id="labelId">{{ title }}</h2>
        <button class="icon-button" type="button" data-sheet-close :aria-label="$t('Close panel')" @click="requestClose">{{ $t('Close') }}</button>
      </header>
      <div class="side-sheet-body"><slot /></div>
    </dialog>
  </Teleport>
</template>
