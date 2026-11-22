<script setup>
import { computed, ref } from 'vue'
import { socialPreviewSeo } from '~/utils/social-preview.js'
import { storyToBoard, shotProvenance } from '~/utils/story-provenance.js'
import { saveStudioHandoff } from '~/utils/studio-handoff.js'
import { MODEL_OPTIONS } from '~/utils/prompt-engine.js'
import { SCENARIO_MAX_CHARS } from '~/utils/scenario.js'

const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const { t } = useI18n()

const story = ref('')
const model = ref('grok')
const draft = ref(null)
const error = ref('')

const tooLong = computed(() => story.value.length > SCENARIO_MAX_CHARS)
const canBuild = computed(() => story.value.trim().length >= 40 && !tooLong.value && !draftBusy.value)
const draftBusy = ref(false)

function buildDraft() {
  if (!canBuild.value) return
  draftBusy.value = true
  error.value = ''
  try {
    draft.value = storyToBoard(story.value, { model: model.value })
  } catch (problem) {
    error.value = problem.message || 'The story could not be planned.'
    draft.value = null
  } finally {
    draftBusy.value = false
  }
}

function badgeFor(shot) {
  return shotProvenance(shot, { idea: story.value })
}

function continueInStudio() {
  if (import.meta.client) saveStudioHandoff(sessionStorage, { premise: story.value, model: model.value })
  return navigateTo('/studio')
}

useSeoMeta({
  title: computed(() => t('I have a story — Moovicut')),
  description: computed(() => t('Paste a finished short or medium story and get a storyboard draft whose every shot says which of your sentences it came from. Free, local, no account.')),
  ogTitle: computed(() => t('I have a story — Moovicut')),
  ogDescription: computed(() => t('Paste a finished short or medium story and get a storyboard draft whose every shot says which of your sentences it came from. Free, local, no account.')),
  twitterTitle: computed(() => t('I have a story — Moovicut')),
  twitterDescription: computed(() => t('Paste a finished short or medium story and get a storyboard draft whose every shot says which of your sentences it came from. Free, local, no account.')),
  ...socialPreview
})
</script>

<template>
  <div class="site-shell">
    <AppHeader />
    <main id="main-content" class="legal-page">
      <div class="container-docs">
        <div class="page-intro">
          <p class="eyebrow">{{ $t('For authors') }}</p>
          <h1>{{ $t('I have a story. Show me the film.') }}</h1>
          <p>{{ $t('Paste your short or medium story. Moovicut reads it on this device and drafts a storyboard where every shot tells you which of your sentences it came from. Nothing is stored. No account, no cost, no AI call.') }}</p>
        </div>

        <section class="legal-section">
          <label class="story-paste-label" for="story-input">{{ $t('Your story') }}</label>
          <textarea id="story-input" v-model="story" rows="12" maxlength="8000" :placeholder="$t('Paste your story here — at least 40 characters, up to 8,000.')" required></textarea>
          <p v-if="tooLong" class="story-length-warning">{{ $t('Keep the story under 8,000 characters. Long works go one chapter at a time, and the character sheet carries over.') }}</p>
          <div class="story-controls">
            <label for="story-model">{{ $t('Prompt target') }}</label>
            <select id="story-model" v-model="model">
              <option v-for="option in MODEL_OPTIONS" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
            <button class="button button-primary" type="button" :disabled="!canBuild" @click="buildDraft">{{ $t('Show my draft') }}</button>
          </div>
          <p v-if="error" class="story-error" role="alert">{{ error }}</p>
        </section>

        <section v-if="draft" class="legal-section" aria-live="polite">
          <h2>{{ $t('Your draft') }}</h2>
          <p class="story-coverage">{{ $t('{from} of {total} shots come from your story', { from: draft.coverage.fromText, total: draft.coverage.total }) }}</p>
          <ol class="story-shot-list">
            <li v-for="shot in draft.board.shots" :key="shot.order" class="story-shot" :data-provenance="badgeFor(shot)">
              <p class="story-shot-head">
                <strong>{{ $t('Shot {number}', { number: shot.order }) }}</strong>
                <span v-if="badgeFor(shot) === 'extracted'" class="story-badge">{{ $t('From your story') }}</span>
                <span v-else-if="badgeFor(shot) === 'suggested'" class="story-badge story-badge-muted">{{ $t('Suggested') }}</span>
                <span v-else-if="badgeFor(shot) === 'yours'" class="story-badge">{{ $t('Your words') }}</span>
                <span v-else-if="badgeFor(shot) === 'edited'" class="story-badge">{{ $t('You edited this') }}</span>
              </p>
              <p v-if="shot.source" class="story-shot-source">“{{ shot.source }}”</p>
              <pre class="story-shot-prompt">{{ shot.prompt }}</pre>
            </li>
          </ol>
          <div class="story-actions">
            <button class="button button-primary" type="button" @click="continueInStudio">{{ $t('Continue in the Studio') }}</button>
            <button class="button button-secondary" type="button" @click="draft = null">{{ $t('Start over') }}</button>
          </div>
          <p class="story-note">{{ $t('In the Studio you can fix names, looks, places and pacing step by step. Your story text comes along; nothing leaves this browser.') }}</p>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.story-paste-label { display: block; margin-bottom: .4rem; }
#story-input { width: 100%; font: inherit; padding: .7rem; border-radius: .6rem; border: 1px solid var(--border); background: transparent; color: inherit; }
.story-controls { display: flex; flex-wrap: wrap; align-items: end; gap: .7rem; margin-top: .7rem; }
.story-controls label { font-size: .9rem; }
.story-length-warning, .story-error { color: var(--accent-hover); }
.story-coverage { color: var(--text-secondary); }
.story-shot-list { padding-left: 1.1rem; }
.story-shot { margin: 1rem 0; }
.story-shot-head { display: flex; gap: .6rem; align-items: baseline; }
.story-badge { color: var(--text-secondary); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
.story-badge-muted { color: var(--accent-hover); }
.story-shot-source { color: var(--text-secondary); font-style: italic; margin: .2rem 0; }
.story-shot-prompt { white-space: pre-wrap; font-size: .88rem; }
.story-actions { display: flex; gap: .7rem; margin-top: 1rem; }
.story-note { color: var(--text-secondary); font-size: .9rem; }
</style>
