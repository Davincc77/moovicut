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
 <div><a class="skip-link" href="#main-content">{{ $t('Skip to content') }}</a><header ref="header" class="site-header"><div class="header-inner"><NuxtLink to="/" class="brand-link" :aria-label="$t('Moovicut home')"><BrandLogo /></NuxtLink><div class="header-actions"><nav class="site-nav-links" :aria-label="$t('Main navigation')"><NuxtLink to="/studio">{{ $t('Studio') }}</NuxtLink><NuxtLink to="/faq">{{ $t('FAQ') }}</NuxtLink><NuxtLink to="/agents">{{ $t('Agents') }}</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener">{{ $t('Tips') }}</a></nav><LanguageSwitcher /><button class="icon-button nav-menu-button" type="button" :aria-expanded="open" aria-controls="site-nav-menu" :aria-label="open ? $t('Close navigation menu') : $t('Open navigation menu')" @click.stop="open = !open"><Menu v-if="!open" :size="20" /><X v-else :size="20" /></button><nav v-if="open" id="site-nav-menu" class="site-nav-menu" :aria-label="$t('Mobile navigation')"><NuxtLink to="/studio" @click="closeMenu">{{ $t('Studio') }}</NuxtLink><NuxtLink to="/faq" @click="closeMenu">{{ $t('FAQ') }}</NuxtLink><NuxtLink to="/agents" @click="closeMenu">{{ $t('Agents') }}</NuxtLink><a href="https://buymeacoffee.com/enzoc1977r" target="_blank" rel="noopener" @click="closeMenu">{{ $t('Tips') }}</a></nav></div></div></header></div>
</template>
