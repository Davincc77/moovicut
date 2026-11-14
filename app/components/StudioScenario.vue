<script setup>
import { Copy } from 'lucide-vue-next'
import { listPresets } from '~/utils/prompt-engine.js'
import { agentScenarioPrompt, composeScenarioText, parseScenario, scenarioBudget, scenarioFieldsFromText } from '~/utils/scenario.js'
import { applyDetection, applyWarningChoice, detectProse } from '~/utils/prose-detect.js'

const props = defineProps({
  idea: { type: String, default: '' },
  duration: { type: Number, default: 3 },
  total: { type: Number, default: 0 }
})
const emit = defineEmits(['preset'])
const { copyText } = useNotifier()
const families = listPresets()
const family = ref('cinema')
const genre = ref('drama')
const genres = computed(() => families.find(item => item.id === family.value)?.genres || [])
const characters = ref('')
const places = ref('')
const scenes = ref('')
const light = ref('')
const mood = ref('')
const prose = ref('')
const detected = ref(null)
const riskNote = computed(() => (detected.value?.warnings || []).find(item => item.code === 'risk_note') || null)
const fieldWarnings = computed(() => (detected.value?.warnings || []).filter(item => item.code !== 'risk_note'))
const locks = ref({ characters: false, places: false, scenes: false, light: false, mood: false })
const errors = ref([])

watch(family, value => {
  const next = families.find(item => item.id === value)
  if (!next?.genres.some(item => item.id === genre.value)) genre.value = next?.defaultGenre || ''
  emit('preset', { family: family.value, genre: genre.value })
})
watch(genre, () => emit('preset', { family: family.value, genre: genre.value }))

const budget = computed(() => scenarioBudget(composeScenarioText({
  characters: characters.value,
  places: places.value,
  scenes: scenes.value,
  light: light.value,
  mood: mood.value
}), Number(props.total) || Number(props.duration) || 15))
let detectTimer
function scheduleDetect() {
  clearTimeout(detectTimer)
  detectTimer = setTimeout(() => fillFromText(prose.value), 350)
}
onBeforeUnmount(() => clearTimeout(detectTimer))

function currentFields() {
  return { characters: characters.value, places: places.value, scenes: scenes.value, light: light.value, mood: mood.value }
}

function applyFields(next, lockKeys = []) {
  characters.value = next.characters
  places.value = next.places
  scenes.value = next.scenes
  light.value = next.light || ''
  mood.value = next.mood || ''
  lockKeys.forEach(key => { locks.value[key] = true })
}

function onEdit(key) {
  locks.value[key] = true
}

function fillFromText(value) {
  const source = String(value || '').trim()
  if (!source) return
  if (/^\s*(characters|personnages)\b/i.test(source)) {
    const fields = scenarioFieldsFromText(source)
    applyFields(fields, ['characters', 'places', 'scenes', 'light', 'mood'])
    detected.value = null
    errors.value = []
    return
  }
  const found = detectProse(source)
  detected.value = found
  applyFields(applyDetection(currentFields(), found, locks.value))
  errors.value = []
}

function confirmWarning(warning, choice) {
  const next = applyWarningChoice(currentFields(), warning, choice || warning.options?.[0])
  const lockKeys = warning.target === 'scenes' ? ['scenes'] : warning.target === 'places' ? ['places'] : ['characters', 'scenes']
  applyFields(next, lockKeys)
}

function draft() {
  const parsed = parseScenario(composeScenarioText(currentFields()))
  errors.value = parsed.ok ? [] : parsed.errors
  return {
    ok: parsed.ok,
    errors: parsed.errors,
    premise: parsed.premise,
    style: family.value,
    genre: genre.value,
    scenario: parsed.ok ? {
      characters: parsed.characters,
      places: parsed.places,
      light: parsed.light,
      mood: parsed.mood,
      scenes: parsed.scenes
    } : null
  }
}

async function copyAgentPrompt() {
  await copyText(agentScenarioPrompt(props.idea), 'Agent prompt copied.')
}

defineExpose({ draft, fill: fillFromText })
</script>

<template>
  <section class="studio-scenario" aria-label="Scenario">
    <label class="studio-scenario-paste">Paste a story or a formatted scenario
      <textarea v-model="prose" aria-label="Paste a story or a formatted scenario" rows="4" placeholder="Paste free text, or a CHARACTERS / PLACES / SCENES block." @input="scheduleDetect" @change="fillFromText(prose)"></textarea>
    </label>
    <p v-if="detected" class="studio-scenario-confidence">Detection confidence: {{ detected.confidence }}. Lines you already edited stay as you left them.</p>
    <p v-if="riskNote" class="studio-soft-hint">{{ riskNote.message }}</p>
    <ul v-if="fieldWarnings.length" class="studio-scenario-warnings">
      <li v-for="(warning, index) in fieldWarnings" :key="`${warning.code}-${index}`">
        <span>{{ warning.message }}</span>
        <button v-if="warning.options?.length" type="button" @click="confirmWarning(warning, warning.options[0])">Use {{ warning.options[0] }}</button>
      </li>
    </ul>
    <label>1. Characters
      <textarea v-model="characters" aria-label="Characters" rows="3" placeholder="Léa — curly hair, round glasses — green apron" @input="onEdit('characters')"></textarea>
    </label>
    <label>2. Places
      <textarea v-model="places" aria-label="Places" rows="3" placeholder="Café — a small morning cafe" @input="onEdit('places')"></textarea>
    </label>
    <label>3. Story, scene by scene
      <textarea v-model="scenes" aria-label="Scenes" rows="4" placeholder="Scene 1 — Lea — Cafe — She pours a latte" @input="onEdit('scenes')"></textarea>
    </label>
    <div class="studio-scenario-style">
      <label>Light
        <input v-model="light" aria-label="Scenario light" placeholder="dawn" @input="onEdit('light')">
      </label>
      <label>Mood
        <input v-model="mood" aria-label="Scenario mood" placeholder="playful" @input="onEdit('mood')">
      </label>
    </div>
    <p class="studio-scenario-budget" :data-status="budget.status">{{ budget.message }}</p>
    <button type="button" class="text-button" @click="copyAgentPrompt"><Copy :size="14" />Copy the prompt for your agent</button>
    <ul v-if="errors.length" class="studio-scenario-warnings">
      <li v-for="(error, index) in errors" :key="index">{{ error.message }}</li>
    </ul>
  </section>
</template>
