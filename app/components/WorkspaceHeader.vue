<script setup>
import { Menu, X } from 'lucide-vue-next'
const emit = defineEmits(['menu'])
defineProps({ menuOpen: Boolean })
const navOpen = ref(false)
const bar = ref(null)
function onDocumentClick(event) { if (bar.value && !bar.value.contains(event.target)) navOpen.value = false }
onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>
<template>
 <header ref="bar" class="workspace-topbar">
  <button class="workspace-menu-button" type="button" :aria-label="menuOpen ? 'Close workspace navigation' : 'Open workspace navigation'" :aria-expanded="menuOpen" aria-controls="mobile-workspace-menu" @click="emit('menu')"><Menu :size="18" /></button>
  <p class="studio-local-badge">Free · Local · No account</p>
  <SupportLink />
  <button class="workspace-nav-button" type="button" :aria-expanded="navOpen" aria-controls="studio-nav-menu" :aria-label="navOpen ? 'Close navigation menu' : 'Open navigation menu'" @click.stop="navOpen = !navOpen"><Menu v-if="!navOpen" :size="18" /><X v-else :size="18" /></button>
  <nav v-if="navOpen" id="studio-nav-menu" class="studio-nav-menu" aria-label="Studio"><NuxtLink to="/studio" @click="navOpen=false">Studio</NuxtLink><NuxtLink to="/faq" @click="navOpen=false">FAQ</NuxtLink><NuxtLink to="/agents" @click="navOpen=false">Agents</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener" @click="navOpen=false">Tips</a></nav>
 </header>
</template>
