<script setup>
import { computed, ref } from 'vue'
import { socialPreviewSeo } from '~/utils/social-preview.js'

const runtimeConfig = useRuntimeConfig()
const socialPreview = socialPreviewSeo(runtimeConfig.public.productionOrigin || runtimeConfig.public.appUrl, runtimeConfig.app.baseURL)
const { t } = useI18n()

useSeoMeta({
  title: computed(() => t('Moovicut Long — the whole novel, audited')),
  description: computed(() => t('The deterministic adaptation engine for long stories: import a full novel, get an audited storyboard where every panel cites the sentences it came from. Offline desktop app, no AI calls.')),
  ogTitle: computed(() => t('Moovicut Long — the whole novel, audited')),
  ogDescription: computed(() => t('The deterministic adaptation engine for long stories: import a full novel, get an audited storyboard where every panel cites the sentences it came from. Offline desktop app, no AI calls.')),
  twitterTitle: computed(() => t('Moovicut Long — the whole novel, audited')),
  twitterDescription: computed(() => t('The deterministic adaptation engine for long stories: import a full novel, get an audited storyboard where every panel cites the sentences it came from. Offline desktop app, no AI calls.')),
  ...socialPreview
})

const email = ref('')
const website = ref('') // honeypot: humans never see or fill this
const status = ref('idle') // idle | sending | listed | duplicate | error
const errorMessage = ref('')

async function joinList() {
  if (!email.value.trim()) return
  status.value = 'sending'
  errorMessage.value = ''
  try {
    const response = await fetch('/api/long/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.value, website: website.value })
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok && data.ok) {
      status.value = data.duplicate ? 'duplicate' : 'listed'
    } else {
      status.value = 'error'
      errorMessage.value = data.error === 'rate_limited'
        ? t('Too many requests from this address — try again in a minute.')
        : data.error === 'waitlist_full'
          ? t('The early-access list is full for now — we will open more seats soon.')
          : t('That email does not look right.')
    }
  } catch {
    status.value = 'error'
    errorMessage.value = t('The request failed — check your connection and try again.')
  }
}
</script>

<template>
  <div class="site-shell">
    <AppHeader />
    <main id="main-content" class="legal-page">
      <div class="container-docs">
        <div class="page-intro">
          <p class="eyebrow">{{ $t('For authors · long works') }}</p>
          <h1>{{ $t('Your whole novel, one audited storyboard.') }}</h1>
          <p>{{ $t('Moovicut Long is the offline desktop engine for full-length works. Import the complete manuscript — chapter map, character registry, tension curve, manga pages and webtoon episodes — and every panel says which of your sentences it came from. Deterministic: same input, same output, reviewable line by line. No account, no cloud, no AI call.') }}</p>
        </div>

        <section class="legal-section">
          <h2>{{ $t('How it works') }}</h2>
          <p class="long-step"><strong>{{ $t('1 · Import') }}</strong> — {{ $t('the complete novel, in one file. It never leaves your machine.') }}</p>
          <p class="long-step"><strong>{{ $t('2 · Draft') }}</strong> — {{ $t('the engine lays out chapters, scenes, panels and episodes under rules you can tune per style pack.') }}</p>
          <p class="long-step"><strong>{{ $t('3 · Audit') }}</strong> — {{ $t('every panel cites its source sentences; the whole dossier carries content hashes, so rights holders and lawyers can verify fidelity.') }}</p>
        </section>

        <section class="legal-section">
          <h2>{{ $t('What you get on day one') }}</h2>
          <ul>
            <li>{{ $t('Chapter and scene map with per-node content hashes') }}</li>
            <li>{{ $t('Persistent character, prop and place registry across the whole book') }}</li>
            <li>{{ $t('Tension curve, page and episode budgets, per-chapter cast') }}</li>
            <li>{{ $t('Manga page layouts (RTL, komawari grids) and vertical webtoon episodes') }}</li>
            <li>{{ $t('A .moovicut project file that reopens anywhere and proves what changed') }}</li>
          </ul>
        </section>

        <section class="legal-section" aria-live="polite">
          <h2>{{ $t('Early access') }}</h2>
          <p>{{ $t('The desktop app is finished internally and ships first to early-access writers. Join the list and we will write when a build is yours.') }}</p>
          <form class="long-signup" novalidate @submit.prevent="joinList">
            <label class="story-paste-label" for="long-email">{{ $t('Email for early access') }}</label>
            <input id="long-email" v-model="email" type="email" maxlength="254" :placeholder="$t('you@example.com')" autocomplete="email" required>
            <input class="long-hp" tabindex="-1" aria-hidden="true" v-model="website" autocomplete="off">
            <button class="button button-primary" type="submit" :disabled="status === 'sending'">{{ status === 'sending' ? $t('Saving…') : $t('Join the list') }}</button>
          </form>
          <p v-if="status === 'listed'" class="long-ok">{{ $t('You are on the list.') }}</p>
          <p v-else-if="status === 'duplicate'" class="long-ok">{{ $t('You were already on the list.') }}</p>
          <p v-else-if="status === 'error'" class="story-error" role="alert">{{ errorMessage }}</p>
          <p class="long-note">{{ $t('Your email is stored on our host and used only for Moovicut Long news — one-click “unsubscribe” in any message.') }}</p>
        </section>

        <section class="legal-section">
          <h2>{{ $t('Want it now?') }}</h2>
          <p>{{ $t('The free web demo covers short and medium stories in your browser, today:') }}</p>
          <div class="story-actions">
            <NuxtLink class="button button-primary" to="/story">{{ $t('Try the free story demo') }}</NuxtLink>
          </div>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.long-step { margin: .6rem 0; }
.long-signup { display: flex; flex-wrap: wrap; align-items: end; gap: .7rem; margin-top: .7rem; }
.long-signup label { width: 100%; margin-bottom: 0; font-size: .9rem; }
#long-email { flex: 1 1 16rem; font: inherit; padding: .7rem; border-radius: .6rem; border: 1px solid var(--border); background: transparent; color: inherit; }
.long-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.long-ok { color: var(--text-secondary); }
.story-error { color: var(--accent-hover); }
.long-note { color: var(--text-secondary); font-size: .86rem; }
</style>
