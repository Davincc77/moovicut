<script setup>
const props = defineProps({ mode: { type: String, required: true } })
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
defineExpose({ draft })
</script>
<template>
 <div class="studio-preset-fields">
  <template v-if="mode === 'ad'">
   <label>Product<input v-model="product" aria-label="Product" maxlength="80" placeholder="Sunlit Pear" /></label>
   <label>Benefit<textarea v-model="benefit" aria-label="Benefit" maxlength="400" placeholder="A cold pear soda that tastes like late summer"></textarea></label>
   <label>Call to action, optional<input v-model="cta" aria-label="Call to action" maxlength="120" placeholder="Spoken line, not lettering" /></label>
   <label>Setting, optional<input v-model="setting" aria-label="Setting" maxlength="200" placeholder="A sunlit kitchen counter" /></label>
   <p>Hook, hero, proof, then a pack shot. The product stays on the film sheet.</p>
  </template>
  <template v-else-if="mode === 'series'">
   <label>Series title<input v-model="title" aria-label="Series title" maxlength="80" /></label>
   <label>Hook<textarea v-model="hook" aria-label="Series hook" maxlength="400" placeholder="One sentence shared by every episode"></textarea></label>
   <label>Episodes<input v-model.number="episodeCount" type="number" min="3" max="8" aria-label="Number of episodes" /></label>
   <label>Episode lines, optional<textarea v-model="episodeLines" aria-label="Episode lines" placeholder="One episode per line. Leave this blank to use the hook for 3 to 8 episodes."></textarea></label>
   <label>Character<input v-model="characterName" aria-label="Series character" maxlength="80" placeholder="Same person in every episode" /></label>
   <label>Look<input v-model="characterLook" aria-label="Character look" maxlength="300" /></label>
   <label>Place<input v-model="placeName" aria-label="Series place" maxlength="80" /></label>
   <label>Place description<input v-model="placeDescription" aria-label="Place description" maxlength="300" /></label>
   <p>3 to 8 vertical episodes. One film sheet for the whole series.</p>
  </template>
  <template v-else>
   <label>Topic<input v-model="topic" aria-label="Explainer topic" maxlength="200" placeholder="How to patch a bike tube" /></label>
   <label>Audience, optional<input v-model="audience" aria-label="Audience" maxlength="200" /></label>
   <label>Steps<textarea v-model="steps" aria-label="Numbered steps" placeholder="1. Flip the bike&#10;2. Release the brake&#10;3. Patch the tube"></textarea></label>
   <p>Each numbered line becomes one shot. Length snaps to the selected model.</p>
  </template>
 </div>
</template>
