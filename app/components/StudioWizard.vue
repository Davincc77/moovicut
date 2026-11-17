<script setup>
import { ArrowRight, ChevronDown } from 'lucide-vue-next'
import { WIZARD_STRINGS, wizardText } from '~/utils/wizard-strings.js'
import {
  WIZARD_STEPS,
  CHARACTER_FIELDS,
  blankWizard,
  loadWizard,
  saveWizard,
  gateGaps,
  gapFieldId,
  revealGap,
  splitOffer,
  canOpenStep,
  openStep,
  continueStep,
  canGenerate,
  review,
  setIdea,
  setModel,
  setPromptStyle,
  setAspect,
  setCharacterField,
  setNoCharacter,
  setShotNoCharacter,
  openCharacter,
  addCharacter,
  removeCharacter,
  setPlaceField,
  openPlace,
  addPlace,
  removePlace,
  setLight,
  setMood,
  setStyle,
  setGenre,
  setShotField,
  toggleShotCharacter,
  openShot,
  addWizardShot,
  removeShot,
  acceptSplit,
  applyCheckFix,
  previewLock,
  projectFromWizard,
  markGenerated,
  optionsSignature
} from '~/utils/wizard.js'
import { MODEL_OPTIONS, ASPECT_RATIOS } from '~/utils/prompt-engine.js'
import { FRAMING_TERMS, framingOptionLabel } from '~/utils/framing.js'
import { LIGHT_VALUES, MOOD_VALUES } from '~/utils/scenario.js'
import { listPresets } from '~/utils/presets/index.js'
import { combinedShotPrompts, partShotPrompts } from '~/utils/open-targets.js'
import { detectProse, textLanguageHint } from '~/utils/prose-detect.js'

const emit = defineEmits(['advanced'])
const store = useProjectStore()
const { copyText } = useNotifier()
const { t: translate, locale } = useI18n()
function t(key, vars) {
  const template = WIZARD_STRINGS[key]
  if (!template) return key
  return translate(template, vars)
}
const state = ref(blankWizard())
const ready = ref(false)
const buildError = ref('')
const settingsOpen = ref(false)
const ideaFeedback = ref(false)
const presets = listPresets()
const optionalCharacterFields = new Set(['colors', 'mark'])
const pendingFocusId = ref('')
const missingField = {
  name: 'missing.name',
  age: 'missing.age',
  build: 'missing.build',
  hair: 'missing.hair',
  outfit: 'missing.outfit',
  colors: 'missing.colors',
  mark: 'missing.mark'
}

function onFocusIdea() {
  state.value = openStep(state.value, 'idea')
  nextTick(() => document.getElementById('wizard-idea')?.focus())
}
onMounted(() => {
  const saved = loadWizard(localStorage)
  if (saved) state.value = saved
  ready.value = true
  window.addEventListener('moovicut-focus-idea', onFocusIdea)
})
onBeforeUnmount(() => window.removeEventListener('moovicut-focus-idea', onFocusIdea))

watch(state, value => {
  if (ready.value) saveWizard(localStorage, value)
}, { deep: true })

watch(() => state.value.step, () => {
  if (!ready.value) return
  buildError.value = ''
})

watch(() => state.value.characterIndex, (index, previous) => {
  if (!ready.value || state.value.step !== 'characters' || index === previous) return
  const pending = pendingFocusId.value
  nextTick(() => document.getElementById(pending || `${state.value.characters[index]?.id}-name`)?.focus())
})

const stepMeta = computed(() => WIZARD_STEPS.find(step => step.id === state.value.step) || WIZARD_STEPS[0])
const stepNumber = computed(() => WIZARD_STEPS.findIndex(step => step.id === state.value.step) + 1)
const stepName = computed(() => t(stepMeta.value.label))
const headingText = computed(() => `${stepNumber.value}. ${stepName.value}`)
function numberedStep(step, index) { return `${index + 1}. ${t(step.label)}` }
const gateNotice = ref(false)
const gaps = computed(() => gateGaps(state.value, state.value.step))
const showIdeaError = computed(() => state.value.step === 'idea' && (ideaFeedback.value || gateNotice.value) && gaps.value.some(item => item.field === 'idea'))
const visibleGaps = computed(() => gateNotice.value ? gaps.value.filter(item => item.field !== 'idea') : [])
watch(() => state.value.step, () => { gateNotice.value = false })
watch(gaps, list => { if (!list.length) gateNotice.value = false })
const modelLabel = computed(() => MODEL_OPTIONS.find(item => item.id === state.value.model)?.label || MODEL_OPTIONS[0]?.label || '')
const promptStyleLabel = computed(() => state.value.promptStyle === 'detailed' ? t('settings.detailed') : t('settings.short'))
const settingsSummary = computed(() => t('settings.summary', { model: modelLabel.value, aspect: state.value.aspectRatio, style: promptStyleLabel.value }))
const nextStepMeta = computed(() => WIZARD_STEPS[stepNumber.value] || null)
const nextLabel = computed(() => nextStepMeta.value ? t('action.nextStep', { step: t(nextStepMeta.value.label) }) : t('action.next'))
const compactStep = computed(() => t('progress.compact', { current: stepNumber.value, total: WIZARD_STEPS.length, label: stepName.value }))
const report = computed(() => state.value.step === 'check' || state.value.step === 'generate' ? review(state.value) : null)
const proseCuts = computed(() => {
  if (state.value.step !== 'check') return []
  const idea = String(state.value.idea || '').trim()
  if (idea.length < 8) return []
  return detectProse(idea).cuts || []
})
function onMergeCut(cut) {
  const start = cut?.shotIndex
  if (!Number.isInteger(start) || start < 1) return
  const nextBoundary = proseCuts.value.find(item => item.kind === 'scene' && item.shotIndex > start)
  const end = nextBoundary ? nextBoundary.shotIndex : state.value.shots.length
  const placeId = state.value.shots[start - 1]?.placeId
  if (!placeId) return
  let next = state.value
  for (let index = start; index < end && index < next.shots.length; index += 1) {
    next = setShotField(next, next.shots[index].id, 'placeId', placeId)
  }
  state.value = next
}
const generateEnabled = computed(() => canGenerate(state.value))
const character = computed(() => state.value.characters[state.value.characterIndex] || state.value.characters[0])
const place = computed(() => state.value.places[state.value.placeIndex] || state.value.places[0])
const shot = computed(() => state.value.shots[state.value.shotIndex] || state.value.shots[0])
const lockLine = computed(() => character.value ? previewLock(character.value) : '')
const offer = computed(() => shot.value ? splitOffer(shot.value.action) : null)
const genres = computed(() => {
  const family = presets.find(item => item.id === state.value.styleFamily)
  return family?.genres || []
})
const project = computed(() => store.project.value)
const shotGroups = computed(() => {
  const shots = project.value?.shots || []
  const parts = project.value?.parts
  if (!parts || parts.length < 2) return [{ key: 'all', part: null, shots }]
  return parts.map(part => ({ key: `part-${part.index}`, part, shots: shots.filter(shot => shot.order >= part.from && shot.order <= part.to) }))
})
function partPrompt(part) { return partShotPrompts(project.value, part) }
const showOutputs = computed(() => state.value.hasGenerated && project.value?.id && project.value.id !== 'starter-project')
const stale = computed(() => showOutputs.value && state.value.generatedSignature && state.value.generatedSignature !== optionsSignature(state.value, locale.value))
const notes = computed(() => (report.value?.warnings || []).filter(item => !report.value.blocking.some(block => block.code === item.code && block.shotId === item.shotId && block.message === item.message)))

function describedBy(owner, field, empty, detected) {
  if (detected) return `${owner}-${field}-hint`
  if (empty) return `${owner}-${field}-error`
  return undefined
}

function gapText(item) {
  const message = t(item.key)
  return item.name ? t('summary.named', { name: translate(item.name), message }) : message
}

function confidenceLabel(level) {
  if (level === 'high' || level === 'low') return t(`confidence.${level}`)
  return t('confidence.medium')
}

function languageLabel(code) {
  const key = `detect.language.${code || 'en'}`
  const label = t(key)
  return label === key ? t('detect.language.en') : label
}

const ideaHint = computed(() => {
  const mismatch = textLanguageHint(state.value.idea, locale.value || 'en')
  if (mismatch) return t('hint.languageDiffers', { language: languageLabel(mismatch.detected), site: languageLabel(mismatch.site) })
  if (state.value.detection?.uncertain) return t('hint.detectionUncertain', { language: languageLabel(state.value.detection.language) })
  return ''
})

function moveTabs(event, kind) {
  const key = event.key
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) return
  const list = kind === 'character' ? state.value.characters : kind === 'place' ? state.value.places : state.value.shots
  const current = kind === 'character' ? state.value.characterIndex : kind === 'place' ? state.value.placeIndex : state.value.shotIndex
  let index = current
  if (key === 'Home') index = 0
  else if (key === 'End') index = list.length - 1
  else index = (current + (key === 'ArrowRight' ? 1 : -1) + list.length) % list.length
  event.preventDefault()
  if (kind === 'character') state.value = openCharacter(state.value, index)
  else if (kind === 'place') state.value = openPlace(state.value, index)
  else state.value = openShot(state.value, index)
  nextTick(() => document.getElementById(`wizard-${kind}-${list[index].id}`)?.focus())
}

function onIdeaBlur() { ideaFeedback.value = true }
function showBlocked(blocking) {
  gateNotice.value = true
  if (state.value.step === 'idea') ideaFeedback.value = true
  const target = gapFieldId(state.value, blocking[0])
  pendingFocusId.value = target
  state.value = revealGap(state.value, blocking[0])
  nextTick(() => {
    document.getElementById(target)?.focus()
    pendingFocusId.value = ''
  })
}
function onSubmit() {
  if (state.value.step === 'generate') {
    generate()
    return
  }
  if (state.value.step === 'check') {
    if (!generateEnabled.value) return
    state.value = continueStep(state.value)
    return
  }
  const blocking = gateGaps(state.value, state.value.step)
  if (blocking.length) {
    showBlocked(blocking)
    return
  }
  gateNotice.value = false
  state.value = continueStep(state.value)
}

function generate() {
  if (!generateEnabled.value) return
  buildError.value = ''
  try {
    const lang = locale.value || 'en'
    store.commit(projectFromWizard(state.value, { promptLanguage: lang }), wizardText('generate.done'))
    state.value = markGenerated(state.value, lang)
  } catch (error) {
    buildError.value = error.message || wizardText('generate.failed')
  }
}

function copyAgent() {
  copyText(JSON.stringify(store.agentBoard()), wizardText('generate.copiedAgent'))
}

</script>

<template>
  <div class="studio-wizard">
    <h2 id="wizard-step-heading" class="sr-only">{{ headingText }}</h2>
    <div class="wizard-progress">
      <p class="wizard-step-compact">{{ compactStep }}</p>
      <ol class="wizard-steps" :aria-label="t('progress.nav')">
        <li v-for="(step, index) in WIZARD_STEPS" :key="step.id">
          <button
            type="button"
            :aria-current="step.id === state.step ? 'step' : undefined"
            :disabled="!canOpenStep(state, step.id)"
            :aria-label="t('step.goto', { label: t(step.label) })"
            @click="state = openStep(state, step.id)"
          ><span class="wizard-step-index" aria-hidden="true"><span class="wizard-step-num">{{ index + 1 }}.</span></span><span class="wizard-step-label">{{ t(step.label) }}</span></button>
        </li>
      </ol>
      <progress :value="stepNumber" :max="WIZARD_STEPS.length" :aria-label="t('progress.label', { current: stepNumber, total: WIZARD_STEPS.length, label: headingText })"></progress>
    </div>

    <form class="wizard-form" novalidate aria-labelledby="wizard-step-heading" @submit.prevent="onSubmit">
      <section v-if="state.step === 'idea'" class="wizard-panel" :aria-label="t('idea.heading')">
        <p>{{ t('idea.help') }}</p>
        <div class="wizard-field">
          <label for="wizard-idea">{{ t('idea.label') }}</label>
          <textarea id="wizard-idea" name="idea" rows="5" required maxlength="6000" :value="state.idea" :aria-invalid="showIdeaError ? 'true' : 'false'" :aria-describedby="showIdeaError ? 'wizard-idea-error' : undefined" @input="state = setIdea(state, $event.target.value)" @blur="onIdeaBlur"></textarea>
          <p v-if="showIdeaError" id="wizard-idea-error" class="wizard-error">{{ t(gaps.find(item => item.field === 'idea').key) }}</p>
          <p v-if="ideaHint" class="wizard-hint" role="status">{{ ideaHint }}</p>
          <CjkNameTip :locale="locale" />
        </div>
        <div class="wizard-settings">
          <div class="wizard-settings-summary">
            <p>{{ settingsSummary }}</p>
            <button class="button button-secondary" type="button" :aria-expanded="settingsOpen" aria-controls="wizard-settings-panel" @click="settingsOpen = !settingsOpen">{{ t('settings.change') }} <ChevronDown :size="14" aria-hidden="true" /></button>
          </div>
          <div v-show="settingsOpen" id="wizard-settings-panel" class="wizard-settings-panel">
        <div class="wizard-field">
          <label for="wizard-model">{{ t('idea.model') }}</label>
          <select id="wizard-model" name="model" :value="state.model" @change="state = setModel(state, $event.target.value)">
            <option v-for="option in MODEL_OPTIONS" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </div>
        <fieldset>
          <legend>{{ t('idea.aspect') }}</legend>
          <div class="wizard-choice">
            <label v-for="ratio in ASPECT_RATIOS" :key="ratio.id">
              <input type="radio" name="wizard-aspect" :value="ratio.id" :checked="state.aspectRatio === ratio.id" @change="state = setAspect(state, ratio.id)" />
              <span>{{ ratio.label }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>{{ t('idea.promptStyle') }}</legend>
          <div class="wizard-choice">
            <label>
              <input type="radio" name="wizard-prompt-style" value="short" :checked="state.promptStyle === 'short'" @change="state = setPromptStyle(state, 'short')" />
              <span>{{ t('idea.short') }} <small>{{ t('idea.shortHelp') }}</small></span>
            </label>
            <label>
              <input type="radio" name="wizard-prompt-style" value="detailed" :checked="state.promptStyle === 'detailed'" @change="state = setPromptStyle(state, 'detailed')" />
              <span>{{ t('idea.detailed') }} <small>{{ t('idea.detailedHelp') }}</small></span>
            </label>
          </div>
        </fieldset>
          </div>
        </div>
      </section>

      <section v-else-if="state.step === 'characters'" class="wizard-panel" :aria-label="t('character.panel')">
        <button id="wizard-no-character" class="button button-secondary wizard-skip-characters" type="button" :aria-pressed="state.noCharacter" @click="state = setNoCharacter(state, !state.noCharacter)">{{ t('character.none') }}</button>
        <p v-if="state.noCharacter" class="wizard-hint" role="status">{{ t('character.noneHelp') }}</p>
        <p v-if="state.detection && !state.noCharacter" role="status">{{ t('detect.summary', { confidence: confidenceLabel(state.detection.confidence), language: languageLabel(state.detection.language) }) }}</p>
        <div v-if="!state.noCharacter" class="wizard-tabs" role="tablist" :aria-label="t('character.list')" @keydown="moveTabs($event, 'character')">
          <button
            v-for="(item, index) in state.characters"
            :id="`wizard-character-${item.id}`"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="index === state.characterIndex"
            :aria-controls="`wizard-character-panel-${item.id}`"
            :tabindex="index === state.characterIndex ? 0 : -1"
            @click="state = openCharacter(state, index)"
          >{{ item.name.trim() || t('character.new') }}</button>
        </div>
        <button v-if="!state.noCharacter" id="wizard-add-character" class="button button-secondary" type="button" @click="state = addCharacter(state)">{{ t('action.addCharacter') }}</button>
        <div v-if="character && !state.noCharacter" :id="`wizard-character-panel-${character.id}`" role="tabpanel" :aria-labelledby="`wizard-character-${character.id}`" class="wizard-sheet">
          <p>{{ t('character.count', { current: state.characterIndex + 1, total: state.characters.length }) }}</p>
          <div v-for="field in CHARACTER_FIELDS" :key="field" class="wizard-field">
            <label :for="`${character.id}-${field}`">{{ t(`field.${field}`) }}</label>
            <input
              :id="`${character.id}-${field}`"
              :name="field"
              type="text"
              :required="!optionalCharacterFields.has(field)"
              autocomplete="off"
              enterkeyhint="next"
              :maxlength="field === 'name' ? 80 : 300"
              :value="character[field]"
              :aria-invalid="optionalCharacterFields.has(field) ? undefined : !character[field].trim()"
              :aria-describedby="describedBy(character.id, field, !optionalCharacterFields.has(field) && !character[field].trim(), character.origin[field] === 'detected' && character[field].trim())"
              @input="state = setCharacterField(state, character.id, field, $event.target.value)"
            />
            <p v-if="character.origin[field] === 'detected' && character[field].trim()" :id="`${character.id}-${field}-hint`" class="wizard-hint">{{ t('hint.detected', { confidence: confidenceLabel(character.confidence[field]) }) }}</p>
            <p v-else-if="optionalCharacterFields.has(field) && !character[field].trim()" :id="`${character.id}-${field}-hint`" class="wizard-hint">{{ t('field.optional') }}</p>
            <p v-else-if="!character[field].trim()" :id="`${character.id}-${field}-error`" class="wizard-error">{{ t(missingField[field]) }}</p>
          </div>
          <p class="wizard-lock" aria-live="polite">
            <span>{{ t('lock.preview') }}</span>
            {{ lockLine || t('lock.empty') }}
          </p>
          <button v-if="state.characters.length > 1" class="button button-secondary" type="button" @click="state = removeCharacter(state, character.id)">{{ t('action.removeCharacter', { name: character.name.trim() || t('character.new') }) }}</button>
        </div>
      </section>

      <section v-else-if="state.step === 'places' && place" class="wizard-panel" :aria-label="t('place.panel')">
        <div class="wizard-tabs" role="tablist" :aria-label="t('place.list')" @keydown="moveTabs($event, 'place')">
          <button
            v-for="(item, index) in state.places"
            :id="`wizard-place-${item.id}`"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="index === state.placeIndex"
            :aria-controls="`wizard-place-panel-${item.id}`"
            :tabindex="index === state.placeIndex ? 0 : -1"
            @click="state = openPlace(state, index)"
          >{{ item.name.trim() || t('place.new') }}</button>
        </div>
        <button id="wizard-add-place" class="button button-secondary" type="button" @click="state = addPlace(state)">{{ t('action.addPlace') }}</button>
        <div :id="`wizard-place-panel-${place.id}`" role="tabpanel" :aria-labelledby="`wizard-place-${place.id}`" class="wizard-sheet">
          <p>{{ t('place.count', { current: state.placeIndex + 1, total: state.places.length }) }}</p>
          <div class="wizard-field">
            <label :for="`${place.id}-name`">{{ t('field.placeName') }}</label>
            <input :id="`${place.id}-name`" name="place-name" type="text" required maxlength="80" autocomplete="off" :value="place.name" :aria-invalid="!place.name.trim()" :aria-describedby="describedBy(place.id, 'name', !place.name.trim(), place.origin.name === 'detected' && place.name.trim())" @input="state = setPlaceField(state, place.id, 'name', $event.target.value)" />
            <p v-if="place.origin.name === 'detected' && place.name.trim()" :id="`${place.id}-name-hint`" class="wizard-hint">{{ t('hint.detected', { confidence: confidenceLabel(place.confidence.name) }) }}</p>
            <p v-else-if="!place.name.trim()" :id="`${place.id}-name-error`" class="wizard-error">{{ t('missing.placeName') }}</p>
          </div>
          <div class="wizard-field">
            <label :for="`${place.id}-description`">{{ t('field.placeDescription') }}</label>
            <textarea :id="`${place.id}-description`" name="place-description" rows="3" required maxlength="300" :value="place.description" :aria-invalid="!place.description.trim()" :aria-describedby="describedBy(place.id, 'description', !place.description.trim(), place.origin.description === 'detected' && place.description.trim())" @input="state = setPlaceField(state, place.id, 'description', $event.target.value)"></textarea>
            <p v-if="place.origin.description === 'detected' && place.description.trim()" :id="`${place.id}-description-hint`" class="wizard-hint">{{ t('hint.detected', { confidence: confidenceLabel(place.confidence.description) }) }}</p>
            <p v-else-if="!place.description.trim()" :id="`${place.id}-description-error`" class="wizard-error">{{ t('missing.placeDescription') }}</p>
          </div>
          <button v-if="state.places.length > 1" class="button button-secondary" type="button" @click="state = removePlace(state, place.id)">{{ t('action.removePlace', { name: place.name.trim() || t('place.new') }) }}</button>
        </div>
        <div class="wizard-field">
          <label for="wizard-light">{{ t('field.light') }}</label>
          <select id="wizard-light" name="light" required :value="state.light" :aria-invalid="!state.light" :aria-describedby="state.light ? undefined : 'wizard-light-error'" @change="state = setLight(state, $event.target.value)">
            <option value="">{{ t('field.choose') }}</option>
            <option v-for="light in LIGHT_VALUES" :key="light" :value="light">{{ t(`light.${light}`) }}</option>
          </select>
          <p v-if="!state.light" id="wizard-light-error" class="wizard-error">{{ t('missing.light') }}</p>
          <p v-else-if="state.lightOrigin === 'detected'" class="wizard-hint">{{ t('hint.detected', { confidence: confidenceLabel('medium') }) }}</p>
        </div>
        <div class="wizard-field">
          <label for="wizard-mood">{{ t('field.mood') }}</label>
          <select id="wizard-mood" name="mood" required :value="state.mood" :aria-invalid="!state.mood" :aria-describedby="state.mood ? undefined : 'wizard-mood-error'" @change="state = setMood(state, $event.target.value)">
            <option value="">{{ t('field.choose') }}</option>
            <option v-for="mood in MOOD_VALUES" :key="mood" :value="mood">{{ t(`mood.${mood}`) }}</option>
          </select>
          <p v-if="!state.mood" id="wizard-mood-error" class="wizard-error">{{ t('missing.mood') }}</p>
          <p v-else-if="state.moodOrigin === 'detected'" class="wizard-hint">{{ t('hint.detected', { confidence: confidenceLabel('medium') }) }}</p>
        </div>
        <fieldset id="wizard-style" tabindex="-1">
          <legend>{{ t('field.style') }}</legend>
          <p class="wizard-hint">{{ t('style.help') }}</p>
          <div class="wizard-choice">
            <label v-for="family in presets" :key="family.id">
              <input type="radio" name="wizard-style" :value="family.id" :checked="state.styleFamily === family.id" @change="state = setStyle(state, family.id)" />
              <span>{{ $t(family.label) }}</span>
            </label>
          </div>
        </fieldset>
        <div class="wizard-field">
          <label for="wizard-genre">{{ t('field.genre') }}</label>
          <select id="wizard-genre" name="genre" required :value="state.genre" @change="state = setGenre(state, $event.target.value)">
            <option v-for="genre in genres" :key="genre.id" :value="genre.id">{{ $t(genre.label) }}</option>
          </select>
        </div>
      </section>

      <section v-else-if="state.step === 'shots' && shot" class="wizard-panel" :aria-label="t('shot.panel')">
        <div class="wizard-tabs" role="tablist" :aria-label="t('shot.list')" @keydown="moveTabs($event, 'shot')">
          <button
            v-for="(item, index) in state.shots"
            :id="`wizard-shot-${item.id}`"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="index === state.shotIndex"
            :aria-controls="`wizard-shot-panel-${item.id}`"
            :tabindex="index === state.shotIndex ? 0 : -1"
            :aria-label="t('generate.shotLabel', { number: index + 1 })"
            @click="state = openShot(state, index)"
          >{{ index + 1 }}</button>
        </div>
        <button id="wizard-add-shot" class="button button-secondary" type="button" @click="state = addWizardShot(state)">{{ t('action.addShot') }}</button>
        <div :id="`wizard-shot-panel-${shot.id}`" role="tabpanel" :aria-labelledby="`wizard-shot-${shot.id}`" class="wizard-sheet">
          <p>{{ t('shot.count', { current: state.shotIndex + 1, total: state.shots.length }) }}</p>
          <fieldset :id="`${shot.id}-who`">
            <legend>{{ t('field.who') }}</legend>
            <div class="wizard-checks">
              <label>
                <input type="checkbox" :name="`none-${shot.id}`" :checked="state.noCharacter || shot.noCharacter" :disabled="state.noCharacter" @change="state = setShotNoCharacter(state, shot.id, $event.target.checked)" />
                <span>{{ t('shot.none') }}</span>
              </label>
            </div>
            <template v-if="!(state.noCharacter || shot.noCharacter)">
              <p class="wizard-hint">{{ t('shot.whoHelp') }}</p>
              <div class="wizard-checks">
                <label v-for="person in state.characters" :key="person.id">
                  <input type="checkbox" :name="`who-${shot.id}`" :checked="shot.whoIds.includes(person.id)" @change="state = toggleShotCharacter(state, shot.id, person.id)" />
                  <span>{{ person.name.trim() || t('character.new') }}</span>
                </label>
              </div>
              <p v-if="!shot.whoIds.length" class="wizard-error">{{ t('missing.who') }}</p>
            </template>
          </fieldset>
          <div class="wizard-field">
            <label :for="`${shot.id}-place`">{{ t('field.place') }}</label>
            <select :id="`${shot.id}-place`" :name="`place-${shot.id}`" required :value="shot.placeId" :aria-invalid="!shot.placeId" @change="state = setShotField(state, shot.id, 'placeId', $event.target.value)">
              <option value="">{{ t('field.choose') }}</option>
              <option v-for="item in state.places" :key="item.id" :value="item.id">{{ item.name.trim() || t('place.new') }}</option>
            </select>
            <p v-if="!shot.placeId" class="wizard-error">{{ t('missing.place') }}</p>
          </div>
          <div class="wizard-field">
            <label :for="`${shot.id}-action`">{{ t('field.action') }}</label>
            <textarea :id="`${shot.id}-action`" :name="`action-${shot.id}`" rows="3" required maxlength="2000" :value="shot.action" :aria-invalid="!shot.action.trim() || !!offer" :aria-describedby="offer ? `${shot.id}-split` : (!shot.action.trim() ? `${shot.id}-action-error` : (shot.origin.action === 'detected' ? `${shot.id}-action-hint` : undefined))" @input="state = setShotField(state, shot.id, 'action', $event.target.value)"></textarea>
            <p v-if="shot.origin.action === 'detected' && shot.action.trim() && !offer" :id="`${shot.id}-action-hint`" class="wizard-hint">{{ t('hint.detected', { confidence: confidenceLabel(shot.confidence.action) }) }}</p>
            <p v-else-if="!shot.action.trim()" :id="`${shot.id}-action-error`" class="wizard-error">{{ t('missing.action') }}</p>
            <div v-if="offer" :id="`${shot.id}-split`" class="wizard-offer" role="status">
              <p>{{ t('split.prompt', { count: offer.length }) }}</p>
              <ol>
                <li v-for="(part, index) in offer" :key="`${shot.id}-part-${index}`">{{ part }}</li>
              </ol>
              <button class="button button-secondary" type="button" @click="state = acceptSplit(state, shot.id)">{{ t('split.accept') }}</button>
            </div>
          </div>
          <div class="wizard-field">
            <label :for="`${shot.id}-framing`">{{ t('field.framing') }}</label>
            <select :id="`${shot.id}-framing`" :name="`framing-${shot.id}`" required :value="shot.framing" :aria-invalid="!shot.framing" @change="state = setShotField(state, shot.id, 'framing', $event.target.value)">
              <option value="">{{ t('field.choose') }}</option>
              <option v-for="term in FRAMING_TERMS" :key="term.id" :value="term.id">{{ framingOptionLabel(term) }}</option>
            </select>
            <p v-if="shot.origin.framing === 'detected' && shot.framing" class="wizard-hint">{{ t('hint.framing') }}</p>
            <p v-else-if="!shot.framing" class="wizard-error">{{ t('missing.framing') }}</p>
          </div>
          <div class="wizard-field">
            <label :for="`${shot.id}-duration`">{{ t('field.duration') }}</label>
            <input :id="`${shot.id}-duration`" :name="`duration-${shot.id}`" type="number" inputmode="numeric" min="2" max="15" step="1" :value="shot.duration" @change="state = setShotField(state, shot.id, 'duration', $event.target.value)" />
          </div>
          <button v-if="state.shots.length > 1" class="button button-secondary" type="button" @click="state = removeShot(state, shot.id)">{{ t('action.removeShot', { number: state.shotIndex + 1 }) }}</button>
        </div>
      </section>

      <section v-else-if="state.step === 'check'" class="wizard-panel" :aria-label="t('check.heading')">
        <h3>{{ t('check.heading') }}</h3>
        <p role="status">{{ t('check.sheet', { characters: state.noCharacter ? t('character.none') : state.characters.map(item => item.name).filter(Boolean).join(', '), places: state.places.map(item => item.name).filter(Boolean).join(', '), light: state.light }) }}</p>
        <p v-if="report && report.gaps.length" role="status">{{ t('check.needSteps') }}</p>
        <template v-else-if="report">
          <p v-if="!report.blocking.length" role="status">{{ t('check.clear') }}</p>
          <template v-else>
            <h3>{{ t('check.blocking') }}</h3>
            <p>{{ t('check.blocked') }}</p>
            <ul class="wizard-issues">
              <li v-for="(issue, index) in report.blocking" :key="`${issue.code}-${issue.shotId}-${index}`">
                <p>{{ $t(issue.message) }}</p>
                <p>{{ issue.fix }}</p>
                <button v-if="issue.fixId" class="button button-secondary" type="button" @click="state = applyCheckFix(state, issue)">{{ t('action.applyFix') }}</button>
              </li>
            </ul>
          </template>
          <template v-if="notes.length">
            <h3>{{ t('check.notes') }}</h3>
            <p>{{ t('check.notesHelp') }}</p>
            <ul class="wizard-issues">
              <li v-for="(issue, index) in notes" :key="`note-${issue.code}-${index}`">
                <p>{{ $t(issue.message) }}</p>
                <p>{{ issue.fix }}</p>
                <button v-if="issue.fixId" class="button button-secondary" type="button" @click="state = applyCheckFix(state, issue)">{{ t('action.applyFix') }}</button>
              </li>
            </ul>
          </template>
        </template>
        <SceneCuts :cuts="proseCuts" @merge="onMergeCut" />
      </section>

      <section v-else class="wizard-panel" :aria-label="t('generate.heading')">
        <h3>{{ t('generate.heading') }}</h3>
        <p>{{ t('generate.help') }}</p>
        <p v-if="buildError" class="wizard-error" role="alert">{{ $t(buildError) }}</p>
        <p v-if="stale" role="status">{{ t('generate.stale') }}</p>
        <div v-if="showOutputs" class="wizard-output">
          <p>{{ t('generate.ready') }}</p>
          <div class="wizard-actions">
            <button class="button button-secondary" type="button" @click="copyText(combinedShotPrompts(project), wizardText('generate.copiedAll'))">{{ t('action.copyAll') }}</button>
            <button class="button button-secondary" type="button" @click="copyAgent">{{ t('action.copyAgent') }}</button>
          </div>
          <p v-if="project.parts && project.parts.length > 1" class="board-parts-note">{{ $t('Verified continuity up to 40 shots') }}</p>
          <section v-for="group in shotGroups" :key="group.key" :class="group.part ? 'board-part' : undefined" :aria-label="group.part ? $t('Part {index}', { index: group.part.index }) : t('generate.heading')">
            <header v-if="group.part" class="board-part-heading">
              <h3>{{ $t('Part {index}', { index: group.part.index }) }}</h3>
              <p>{{ $t('Shots {from}–{to}. Starts at {place}, {time}.', { from: group.part.from, to: group.part.to, place: group.part.place, time: group.part.time }) }}</p>
              <div class="board-part-actions">
                <button class="button button-secondary" type="button" @click="copyText(partPrompt(group.part), `Part ${group.part.index} copied`)">{{ $t('Copy part {index}', { index: group.part.index }) }}</button>
                <OpenInButtons :prompt="partPrompt(group.part)" :seed="group.part.index" />
              </div>
            </header>
            <article v-for="(item, index) in group.shots" :key="item.id" class="wizard-shot">
              <h3>{{ t('generate.shotLabel', { number: item.order || index + 1 }) }}</h3>
              <p v-if="item.promptEdited" class="wizard-hint">{{ t('generate.edited') }}</p>
              <pre>{{ item.prompt }}</pre>
              <div class="wizard-actions">
                <button class="button button-secondary" type="button" @click="copyText(item.prompt, wizardText('generate.copiedShot'))">{{ t('action.copyShot') }}</button>
                <button class="button button-secondary" type="button" @click="store.regenerateOne(item.id)">{{ t('action.regenerate') }}</button>
              </div>
            </article>
          </section>
          <CharacterSheets />
        </div>
        <p v-else>{{ t('generate.waiting') }}</p>
      </section>

      <ul v-if="visibleGaps.length && state.step !== 'check'" id="wizard-gaps" class="wizard-gaps" role="alert" :aria-label="t('gaps.heading')">
        <li v-for="(item, index) in visibleGaps" :key="`${item.step}-${item.targetId}-${item.field}-${item.key}-${index}`">{{ gapText(item) }}</li>
      </ul>

      <div class="wizard-footer">
        <p class="wizard-privacy">{{ t('wizard.lead') }}</p>
        <div class="wizard-actions">
          <button v-if="stepNumber > 1" class="button button-secondary" type="button" @click="state = openStep(state, WIZARD_STEPS[stepNumber - 2].id)">{{ t('action.back') }}</button>
          <button v-if="state.step !== 'generate'" class="button button-primary" type="submit" :disabled="state.step === 'check' && !generateEnabled" :aria-describedby="visibleGaps.length ? 'wizard-gaps' : undefined">{{ nextLabel }} <ArrowRight :size="16" aria-hidden="true" /></button>
          <button v-else class="button button-primary" type="submit" :disabled="!generateEnabled">{{ state.hasGenerated ? t('action.generateAgain') : t('action.generate') }}</button>
        </div>
      </div>
    </form>
  </div>
</template>
