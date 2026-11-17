<script setup>
import { LayoutGrid, Library, Plus } from 'lucide-vue-next'
import { joinAppPath } from '~/utils/urls.js'
const emit = defineEmits(['projects', 'editor', 'create'])
const appBaseURL = useRuntimeConfig().app.baseURL
</script>
<template>
 <aside class="workspace-sidebar" :aria-label="$t('Workspace sidebar')">
  <NuxtLink to="/" class="workspace-home" :aria-label="$t('Moovicut home')"><img :src="joinAppPath(appBaseURL,'brand/mark.svg')" alt="" width="24" height="24" /></NuxtLink>
  <nav id="workspace-destinations" class="workspace-nav" :aria-label="$t('Create')">
   <NuxtLink to="/studio" @click="emit('create')"><Plus :size="18" aria-hidden="true" /><span>{{ $t('Create') }}</span></NuxtLink>
   <button type="button" @click="emit('editor')"><Library :size="18" aria-hidden="true" /><span>{{ $t('Storyboard') }}</span></button>
   <button type="button" @click="emit('projects')"><LayoutGrid :size="18" aria-hidden="true" /><span>{{ $t('My Projects') }}</span></button>
  </nav>
  <div class="workspace-support"><SupportLink /></div>
 </aside>
</template>
