<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({
  warnings: { type: Array, default: () => [] }
})
const emit = defineEmits(['create', 'ignore'])
const { t } = useI18n()
const rows = computed(() => (props.warnings || []).filter(item => item?.code === 'name_without_sheet'))

function scenes(row) {
  return Array.isArray(row.scenes) ? row.scenes.join(', ') : ''
}
</script>

<template>
  <ul v-if="rows.length" class="name-sheet-notices">
    <li v-for="row in rows" :key="row.name" class="name-sheet-notice" role="status">
      <p>
        {{ t('{name} is named in the story and has no character sheet.', { name: row.name }) }}
        <span v-if="scenes(row)">{{ t('Scenes {list}.', { list: scenes(row) }) }}</span>
        <span v-if="row.did_you_mean">{{ t('Did you mean {name}?', { name: row.did_you_mean }) }}</span>
      </p>
      <div class="name-sheet-actions">
        <button class="button button-secondary" type="button" @click="emit('create', row)">{{ t('Create sheet') }}</button>
        <button class="button button-secondary" type="button" @click="emit('ignore', row)">{{ t('Not a name, ignore') }}</button>
      </div>
    </li>
  </ul>
</template>
