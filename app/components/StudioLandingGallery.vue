<script setup>
import { joinAppPath } from '~/utils/urls.js'
import { STUDIO_INSPIRATIONS, promptImageSrc } from '~/utils/reference-content.js'
const appBaseURL = useRuntimeConfig().app.baseURL
</script>
<template>
  <section class="studio-still-gallery" aria-labelledby="studio-gallery-heading">
    <div>
      <h2 id="studio-gallery-heading">Scene stills</h2>
      <p>Free local storyboarding. Use these stills as references while you edit shots and export JSON on this device. No account is required, and Moovicut does not render video.</p>
    </div>
    <ul>
      <li v-for="study in STUDIO_INSPIRATIONS" :key="study.file">
        <picture>
          <source :srcset="joinAppPath(appBaseURL, promptImageSrc(study.file, 'webp'))" type="image/webp" />
          <img :src="joinAppPath(appBaseURL, promptImageSrc(study.file, 'jpg'))" :alt="study.title" width="1280" height="720" loading="lazy" decoding="async" />
        </picture>
        <span>{{ study.title }}</span>
      </li>
    </ul>
  </section>
</template>
