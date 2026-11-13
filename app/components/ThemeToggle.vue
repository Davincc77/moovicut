<script setup>
import { Moon, Sun } from 'lucide-vue-next'
const { settings, setPreference } = usePreferences()
</script>
<template>
 <button class="text-button theme-toggle" type="button" :aria-pressed="settings.darkMode" aria-label="Use dark mode" @click="setPreference('darkMode',!settings.darkMode)"><Moon v-if="!settings.darkMode" :size="14" /><Sun v-else :size="14" /><span>Dark mode</span></button>
</template>
