import { computed } from 'vue'
import { useProjectStore } from '~/composables/useProjectStore.js'

/** Nuxt wrapper around the portable, device-only preference engine. */
export function usePreferences() {
  const store = useProjectStore()
  const settings = computed(() => ({ ...(store.settings?.value ?? store.settings) }))
  return { settings, setPreference:store.setPreference }
}
