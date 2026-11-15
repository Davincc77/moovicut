<script setup>
import { X, CheckCircle2, Info, CircleAlert } from 'lucide-vue-next'
const { notification, clearNotification, holdNotification, releaseNotification } = useNotifier()
function onFocusOut(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  releaseNotification()
}
</script>
<template>
  <div class="toast-region" role="region" :aria-label="$t('Notifications')">
    <Transition name="toast">
      <div v-if="notification" class="toast" role="status" :class="`toast-${notification.type}`" @pointerenter="holdNotification" @pointerleave="releaseNotification" @focusin="holdNotification" @focusout="onFocusOut">
        <CircleAlert v-if="notification.type==='error'" :size="17" />
        <Info v-else-if="notification.type==='info'" :size="17" />
        <CheckCircle2 v-else :size="17" />
        <span>{{ $t(notification.message) }}</span>
        <button v-if="notification.action" class="text-button toast-action" type="button" @click="notification.action.run()">{{ $t(notification.action.label) }}</button>
        <button class="icon-button" type="button" :aria-label="$t('Dismiss notification')" @click="clearNotification"><X :size="15" /></button>
      </div>
    </Transition>
  </div>
</template>
