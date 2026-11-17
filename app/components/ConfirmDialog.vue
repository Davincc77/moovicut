<script setup>
const dialog = ref(null)
const pending = ref(null)

function ask(options) {
  pending.value = options
  return new Promise(resolve => {
    pending.value = { ...options, resolve }
    nextTick(() => dialog.value?.showModal())
  })
}

function onClose() {
  const confirmed = dialog.value?.returnValue === 'confirm'
  const resolve = pending.value?.resolve
  pending.value = null
  resolve?.(confirmed)
}

defineExpose({ ask })
</script>

<template>
  <dialog ref="dialog" class="confirm-dialog" @close="onClose">
    <h2>{{ pending?.title }}</h2>
    <p>{{ pending?.message }}</p>
    <form method="dialog">
      <button value="cancel" type="submit">{{ $t('Cancel') }}</button>
      <button class="button button-primary" value="confirm" type="submit">{{ pending?.confirm || $t('Delete') }}</button>
    </form>
  </dialog>
</template>
