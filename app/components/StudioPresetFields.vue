<script setup>
import { parseAd, parseExplainer, parseSeries } from '~/utils/preset-modes.js'
const props = defineProps({ mode: { type: String, required: true }, reveal: { type: Boolean, default: false } })
const touched = ref(false)
watch(() => props.mode, () => { touched.value = false })
const product = ref('')
const benefit = ref('')
const cta = ref('')
const setting = ref('')
const title = ref('')
const hook = ref('')
const episodeCount = ref(3)
const episodeLines = ref('')
const characterName = ref('')
const characterLook = ref('')
const placeName = ref('')
const placeDescription = ref('')
const topic = ref('')
const audience = ref('')
const steps = ref('')

function draft() {
  if (props.mode === 'ad') {
    return {
      premise: '',
      options: { sequenceMode: 'ad', ad: { product: product.value, benefit: benefit.value, cta: cta.value, setting: setting.value } }
    }
  }
  if (props.mode === 'series') {
    const lines = episodeLines.value.trim()
    return {
      premise: '',
      options: {
        sequenceMode: 'series',
        series: {
          title: title.value,
          hook: hook.value,
          episodes: lines || Number(episodeCount.value),
          character: { name: characterName.value, look: characterLook.value, outfit: '' },
          place: { name: placeName.value, description: placeDescription.value }
        }
      }
    }
  }
  return {
    premise: topic.value,
    options: { sequenceMode: 'explainer', explainer: { topic: topic.value, audience: audience.value, steps: steps.value } }
  }
}
const problems = computed(() => {
  if (!touched.value && !props.reveal) return []
  const body = draft()
  const parsed = props.mode === 'ad' ? parseAd(body.options) : props.mode === 'series' ? parseSeries(body.options) : parseExplainer({ ...body.options, premise: body.premise })
  return parsed.ok ? [] : parsed.errors
})
defineExpose({ draft })
</script>
<template>
 <div class="studio-preset-fields" @input="touched = true">
  <template v-if="mode === 'ad'">
   <label>{{ $t('Product') }}<input v-model="product" :aria-label="$t('Product')" maxlength="80" :placeholder="$t('Sunlit Pear')" /></label>
   <label>{{ $t('Benefit') }}<textarea v-model="benefit" :aria-label="$t('Benefit')" maxlength="400" :placeholder="$t('A cold pear soda that tastes like late summer')"></textarea></label>
   <label>{{ $t('Call to action, optional') }}<input v-model="cta" :aria-label="$t('Call to action')" maxlength="120" :placeholder="$t('Spoken line, not lettering')" /></label>
   <label>{{ $t('Setting, optional') }}<input v-model="setting" :aria-label="$t('Setting')" maxlength="200" :placeholder="$t('A sunlit kitchen counter')" /></label>
   <p>{{ $t('Hook, hero, proof, then a pack shot. The product stays on the film sheet.') }}</p>
  </template>
  <template v-else-if="mode === 'series'">
   <label>{{ $t('Series title') }}<input v-model="title" :aria-label="$t('Series title')" maxlength="80" /></label>
   <label>{{ $t('Hook') }}<textarea v-model="hook" :aria-label="$t('Series hook')" maxlength="400" :placeholder="$t('One sentence shared by every episode')"></textarea></label>
   <label>{{ $t('Episodes') }}<input v-model.number="episodeCount" type="number" min="3" max="8" :aria-label="$t('Number of episodes')" /></label>
   <label>{{ $t('Episode lines, optional') }}<textarea v-model="episodeLines" :aria-label="$t('Episode lines')" :placeholder="$t('One episode per line. Leave this blank to use the hook for 3 to 8 episodes.')"></textarea></label>
   <label>{{ $t('Character') }}<input v-model="characterName" :aria-label="$t('Series character')" maxlength="80" :placeholder="$t('Same person in every episode')" /></label>
   <label>{{ $t('Look') }}<input v-model="characterLook" :aria-label="$t('Character look')" maxlength="300" /></label>
   <label>{{ $t('Place') }}<input v-model="placeName" :aria-label="$t('Series place')" maxlength="80" /></label>
   <label>{{ $t('Place description') }}<input v-model="placeDescription" :aria-label="$t('Place description')" maxlength="300" /></label>
   <p>{{ $t('{episodes} episodes, {shots} shots. Choose 3 to 8 episodes. Each episode is an open, a hold, and a landing.', { episodes: Math.min(8, Math.max(3, Number(episodeCount) || 3)), shots: Math.min(8, Math.max(3, Number(episodeCount) || 3)) * 3 }) }}</p>
  </template>
  <template v-else-if="mode === 'explainer'">
   <label>{{ $t('Topic') }}<input v-model="topic" :aria-label="$t('Explainer topic')" maxlength="200" :placeholder="$t('How to patch a bike tube')" /></label>
   <label>{{ $t('Audience, optional') }}<input v-model="audience" :aria-label="$t('Audience')" maxlength="200" /></label>
   <label>{{ $t('Steps') }}<textarea v-model="steps" :aria-label="$t('Numbered steps')" :placeholder="$t('1. Flip the bike\n2. Release the brake\n3. Patch the tube')"></textarea></label>
   <p>{{ $t('Each numbered line becomes one shot. Length snaps to the selected model.') }}</p>
  </template>
  <ul v-if="problems.length" class="studio-scenario-warnings"><li v-for="(item, index) in problems" :key="index">{{ $t(item.message) }}</li></ul>
 </div>
</template>
