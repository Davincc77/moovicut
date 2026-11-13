<script setup>
import { LayoutGrid, Library, Plus } from 'lucide-vue-next'
import { joinAppPath } from '~/utils/urls.js'
const emit = defineEmits(['projects','editor'])
const appBaseURL = useRuntimeConfig().app.baseURL
</script>
<template>
 <aside class="workspace-sidebar" aria-label="Workspace sidebar">
  <NuxtLink to="/" class="workspace-home" aria-label="Moovicut home"><img :src="joinAppPath(appBaseURL,'brand/mark.svg')" alt="" width="24" height="24" /></NuxtLink>
  <div id="workspace-destinations" class="workspace-nav">
   <nav aria-label="Create"><h2 class="sr-only">CREATE</h2><NuxtLink to="/studio" aria-label="Create" title="Create"><Plus :size="18" /><span class="sr-only">Create</span></NuxtLink></nav>
   <nav aria-label="Library"><h2 class="sr-only">LIBRARY</h2><button type="button" aria-label="Storyboard" title="Storyboard" @click="emit('editor')"><Library :size="18" /><span class="sr-only">Storyboard</span></button><button type="button" aria-label="My Projects" title="My Projects" @click="emit('projects')"><LayoutGrid :size="18" /><span class="sr-only">My Projects</span></button></nav>
  </div>
 </aside>
</template>
