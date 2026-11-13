<script setup>
defineProps({
  scenes: { type: Array, default: () => [] },
  count: { type: Number, default: 5 }
})
const emit = defineEmits(['add', 'remove', 'move', 'update', 'count'])
</script>
<template>
  <section class="studio-step-builder" aria-label="Step-by-step storyboard">
    <header class="studio-step-heading">
      <h2>Step-by-step storyboard</h2>
      <p>Add, remove, or reorder scenes. Each scene keeps the board’s style lock, continuity, aspect ratio, and prompt density.</p>
      <label>Scene count<input :value="count" type="number" min="1" max="48" aria-label="Custom scene count" @change="emit('count', Number($event.target.value))" /></label>
    </header>
    <ol>
      <li v-for="(scene, index) in scenes" :key="scene.id || index" class="studio-step-card">
        <header>
          <span>Scene {{ index + 1 }}</span>
          <span class="studio-step-actions">
            <button type="button" :aria-label="`Move scene ${index + 1} up`" :disabled="index === 0" @click="emit('move', index, -1)">Up</button>
            <button type="button" :aria-label="`Move scene ${index + 1} down`" :disabled="index === scenes.length - 1" @click="emit('move', index, 1)">Down</button>
            <button type="button" :aria-label="`Remove scene ${index + 1}`" :disabled="scenes.length <= 1" @click="emit('remove', index)">Remove</button>
          </span>
        </header>
        <label>Beat / action<textarea :value="scene.action" :aria-label="`Beat for scene ${index + 1}`" @change="emit('update', index, 'action', $event.target.value)"></textarea></label>
        <label>Duration (seconds)<input type="number" min="2" max="15" :value="scene.duration" :aria-label="`Duration for scene ${index + 1}`" @change="emit('update', index, 'duration', Number($event.target.value))" /></label>
        <label>Camera framing<input :value="scene.framing" :aria-label="`Framing for scene ${index + 1}`" @change="emit('update', index, 'framing', $event.target.value)" /></label>
        <label>Camera movement<input :value="scene.camera" :aria-label="`Camera for scene ${index + 1}`" @change="emit('update', index, 'camera', $event.target.value)" /></label>
        <label>Lighting / mood<input :value="scene.lighting" :aria-label="`Lighting for scene ${index + 1}`" @change="emit('update', index, 'lighting', $event.target.value)" /></label>
        <label>Notes<textarea :value="scene.notes" :aria-label="`Notes for scene ${index + 1}`" @change="emit('update', index, 'notes', $event.target.value)"></textarea></label>
        <OpenInButtons v-if="scene.prompt" :prompt="scene.prompt" :seed="index" />
      </li>
    </ol>
    <button type="button" @click="emit('add')">+ Add scene</button>
  </section>
</template>
