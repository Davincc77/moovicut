<script setup>
import { LayoutGrid, Library, Plus } from 'lucide-vue-next'
import { joinAppPath } from '~/utils/urls.js'
const emit = defineEmits(['projects','editor'])
const appBaseURL = useRuntimeConfig().app.baseURL
</script>
<template>
 <aside class="workspace-sidebar" :aria-label="$t('Workspace sidebar')">
  <NuxtLink to="/" class="workspace-home" :aria-label="$t('Moovicut home')"><img :src="joinAppPath(appBaseURL,'brand/mark.svg')" alt="" width="24" height="24" /></NuxtLink>
  <div id="workspace-destinations" class="workspace-nav">
   <nav :aria-label="$t('Create')"><h2 class="sr-only">{{ $t('CREATE') }}</h2><NuxtLink to="/studio" :aria-label="$t('Create')" :title="$t('Create')"><Plus :size="18" /><span class="sr-only">{{ $t('Create') }}</span></NuxtLink></nav>
   <nav :aria-label="$t('Library')"><h2 class="sr-only">{{ $t('LIBRARY') }}</h2><button type="button" :aria-label="$t('Storyboard')" :title="$t('Storyboard')" @click="emit('editor')"><Library :size="18" /><span class="sr-only">{{ $t('Storyboard') }}</span></button><button type="button" :aria-label="$t('My Projects')" :title="$t('My Projects')" @click="emit('projects')"><LayoutGrid :size="18" /><span class="sr-only">{{ $t('My Projects') }}</span></button></nav>
  </div>
 </aside>
</template>
