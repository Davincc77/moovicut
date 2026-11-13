<script setup>
import { joinAppPath } from '~/utils/urls.js'
const appBaseURL = useRuntimeConfig().app.baseURL
</script>
<template>
 <span class="brand" aria-label="Moovicut">
  <img class="brand-wordmark" :src="joinAppPath(appBaseURL,'brand/wordmark.svg')" alt="Moovicut" width="166" height="32" />
 </span>
</template>
