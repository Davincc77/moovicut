import { computed } from 'vue'
import { useProjectStore } from '~/composables/useProjectStore.js'

/** Nuxt wrapper around the portable, device-only preference engine. */
export function usePreferences() {
  const store = useProjectStore()
  const settings = computed(() => ({ ...store.settings }))
  const theme = computed(() => settings.value.darkMode ? 'dark' : 'light')
  useHead({ htmlAttrs:{ class:computed(() => settings.value.darkMode ? 'shotboard-dark' : '') } })
  return { settings, theme, setPreference:store.setPreference }
}
