<script setup>
import { X, CheckCircle2, Info, CircleAlert } from 'lucide-vue-next'
const { notification, clearNotification } = useNotifier()
</script>
<template>
  <Transition name="toast">
    <div v-if="notification" class="shotboard-overlay toast" role="status" :class="`toast-${notification.type}`">
      <CircleAlert v-if="notification.type==='error'" :size="17" />
      <Info v-else-if="notification.type==='info'" :size="17" />
      <CheckCircle2 v-else :size="17" />
      <span>{{ notification.message }}</span>
      <button v-if="notification.action" class="text-button toast-action" type="button" @click="notification.action.run()">{{ notification.action.label }}</button>
      <button class="icon-button" aria-label="Dismiss notification" @click="clearNotification"><X :size="15" /></button>
    </div>
  </Transition>
</template>
