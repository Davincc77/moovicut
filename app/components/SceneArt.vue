<script setup>
import { joinAppPath } from '~/utils/urls.js'
import { SCENE_STILLS, stillSrc } from '~/utils/reference-content.js'
const props = defineProps({ index: { type: Number, default: 0 }, title: { type: String, default: 'Original scene study' }, sourceSrc: { type: String, default: '' } })
const still = computed(() => SCENE_STILLS[Math.abs(Number(props.index) || 0) % SCENE_STILLS.length])
const src = computed(() => props.sourceSrc || joinAppPath(useRuntimeConfig().app.baseURL, stillSrc(props.index, 'webp')))
const fallback = computed(() => props.sourceSrc || joinAppPath(useRuntimeConfig().app.baseURL, stillSrc(props.index, 'jpg')))
</script>
<template>
  <picture class="scene-art">
    <source v-if="!sourceSrc" :srcset="src" type="image/webp" />
    <img :src="sourceSrc || fallback" :alt="title || still.alt" loading="lazy" decoding="async" />
  </picture>
</template>
