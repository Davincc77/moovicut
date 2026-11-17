<script setup>
defineProps({
  scenes: { type: Array, default: () => [] },
  count: { type: Number, default: 5 }
})
const emit = defineEmits(['add', 'remove', 'move', 'update', 'count'])
</script>
<template>
  <section class="studio-step-builder" :aria-label="$t('Step-by-step storyboard')">
    <header class="studio-step-heading">
      <h2>{{ $t('Step-by-step storyboard') }}</h2>
      <p>{{ $t('Add, remove, or reorder scenes. Each scene keeps the board’s style lock, continuity, aspect ratio, and prompt density.') }}</p>
      <label>{{ $t('Scene count') }}<input :value="count" type="number" min="1" :aria-label="$t('Custom scene count')" @change="emit('count', Number($event.target.value))" /></label>
    </header>
    <ol>
      <li v-for="(scene, index) in scenes" :key="scene.id || index" class="studio-step-card">
        <header>
          <span>{{ $t('Scene {n}', { n: index + 1 }) }}</span>
          <span class="studio-step-actions">
            <button class="button button-secondary" type="button" :aria-label="$t('Move scene {n} up', { n: index + 1 })" :disabled="index === 0" @click="emit('move', index, -1)">{{ $t('Up') }}</button>
            <button class="button button-secondary" type="button" :aria-label="$t('Move scene {n} down', { n: index + 1 })" :disabled="index === scenes.length - 1" @click="emit('move', index, 1)">{{ $t('Down') }}</button>
            <button class="button button-secondary" type="button" :aria-label="$t('Remove scene {n}', { n: index + 1 })" :disabled="scenes.length <= 1" @click="emit('remove', index)">{{ $t('Remove') }}</button>
          </span>
        </header>
        <label>{{ $t('Beat / action') }}<textarea :value="scene.action" :aria-label="$t('Beat for scene {n}', { n: index + 1 })" @change="emit('update', index, 'action', $event.target.value)"></textarea></label>
        <label>{{ $t('Duration (seconds)') }}<input type="number" min="2" max="15" :value="scene.duration" :aria-label="$t('Duration for scene {n}', { n: index + 1 })" @change="emit('update', index, 'duration', Number($event.target.value))" /></label>
        <label>{{ $t('Camera framing') }}<input :value="scene.framing" :aria-label="$t('Framing for scene {n}', { n: index + 1 })" @change="emit('update', index, 'framing', $event.target.value)" /></label>
        <label>{{ $t('Camera movement') }}<input :value="scene.camera" :aria-label="$t('Camera for scene {n}', { n: index + 1 })" @change="emit('update', index, 'camera', $event.target.value)" /></label>
        <label>{{ $t('Lighting / mood') }}<input :value="scene.lighting" :aria-label="$t('Lighting for scene {n}', { n: index + 1 })" @change="emit('update', index, 'lighting', $event.target.value)" /></label>
        <label>{{ $t('Notes') }}<textarea :value="scene.notes" :aria-label="$t('Notes for scene {n}', { n: index + 1 })" @change="emit('update', index, 'notes', $event.target.value)"></textarea></label>
        <OpenInButtons v-if="scene.prompt" :prompt="scene.prompt" :seed="index" />
      </li>
    </ol>
    <button class="button button-secondary" type="button" @click="emit('add')">{{ $t('+ Add scene') }}</button>
  </section>
</template>
