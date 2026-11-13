<script setup>
import { joinAppPath } from '~/utils/urls.js'
import { SCENE_STILLS, stillSrc } from '~/utils/reference-content.js'
const props = defineProps({ index: { type: Number, default: 0 }, alt: { type: String, default: '' } })
const still = computed(() => SCENE_STILLS[Math.abs(Number(props.index) || 0) % SCENE_STILLS.length])
const label = computed(() => props.alt || still.value.alt)
const src = computed(() => joinAppPath(useRuntimeConfig().app.baseURL, stillSrc(props.index, 'webp')))
const fallback = computed(() => joinAppPath(useRuntimeConfig().app.baseURL, stillSrc(props.index, 'jpg')))
</script>
<template>
  <span class="original-scene-still">
    <picture>
      <source :srcset="src" type="image/webp" />
      <img :src="fallback" :alt="label" width="960" height="1280" loading="lazy" decoding="async" />
    </picture>
  </span>
</template>
