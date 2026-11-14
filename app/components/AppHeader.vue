<script setup>
import { Menu, X } from 'lucide-vue-next'
const open = ref(false)
const header = ref(null)
function closeMenu() { open.value = false }
function onKey(event) { if (event.key === 'Escape') { open.value = false; header.value?.querySelector('.nav-menu-button')?.focus() } }
function onDocumentClick(event) { if (header.value && !header.value.contains(event.target)) open.value = false }
onMounted(() => { document.addEventListener('keydown', onKey); document.addEventListener('click', onDocumentClick) })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDocumentClick) })
</script>
<template>
 <div><a class="skip-link" href="#main-content">Skip to content</a><header ref="header" class="site-header"><div class="header-inner"><NuxtLink to="/" class="brand-link" aria-label="Moovicut home"><BrandLogo /></NuxtLink><div class="header-actions"><nav class="site-nav-links" aria-label="Main navigation"><NuxtLink to="/studio">Studio</NuxtLink><NuxtLink to="/faq">FAQ</NuxtLink><NuxtLink to="/agents">Agents</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener">Tips</a></nav><button class="icon-button nav-menu-button" type="button" :aria-expanded="open" aria-controls="site-nav-menu" :aria-label="open ? 'Close navigation menu' : 'Open navigation menu'" @click.stop="open = !open"><Menu v-if="!open" :size="20" /><X v-else :size="20" /></button><nav v-if="open" id="site-nav-menu" class="site-nav-menu" aria-label="Mobile navigation"><NuxtLink to="/studio" @click="closeMenu">Studio</NuxtLink><NuxtLink to="/faq" @click="closeMenu">FAQ</NuxtLink><NuxtLink to="/agents" @click="closeMenu">Agents</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener" @click="closeMenu">Tips</a></nav></div></div></header></div>
</template>
