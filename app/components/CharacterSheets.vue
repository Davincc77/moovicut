<script setup>
import { asCharacter, lockLineFor } from '~/utils/character-lock.js'
import { characterPacket, characterPacketDocument, characterPacketMarkdown } from '~/utils/character-packet.js'

const store = useProjectStore()
const project = store.project
const { notify, copyText, downloadText } = useNotifier()
const packetDialog = ref(null)
const drafts = reactive({})
const fields = [
  ['body', 'Body / age'],
  ['face', 'Face'],
  ['hair', 'Hair'],
  ['colors', 'Colors'],
  ['marks', 'Marks'],
  ['look', 'Look'],
  ['outfit', 'Outfit']
]
const turnaround = [
  ['front', 'Front'],
  ['side', 'Side'],
  ['back', 'Back'],
  ['expressions', 'Expressions'],
  ['palette', 'Palette'],
  ['props', 'Props']
]

const cast = computed(() => (project.value.filmSheet?.characters || []).map(asCharacter))
function slotKey(slot) {
  if (slot === 'front') return 'Front reference'
  if (slot === 'side') return 'Side reference'
  return 'Back reference'
}

function patchAt(index, patch) {
  const characters = (project.value.filmSheet?.characters || []).map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : { ...item })
  store.patchFilmSheet({ characters })
}

function editField(index, field, value) {
  patchAt(index, { [field]: value })
}

function editLock(index, value) {
  patchAt(index, { lockLine: value.trim(), lockEdited: true })
}

function resetLock(index) {
  const current = { ...(project.value.filmSheet.characters[index] || {}) }
  delete current.lockLine
  delete current.lockEdited
  const characters = project.value.filmSheet.characters.map((item, itemIndex) => itemIndex === index ? current : item)
  store.patchFilmSheet({ characters })
}

function editTurn(index, key, value) {
  const current = project.value.filmSheet.characters[index]
  patchAt(index, { sheet: { ...(current.sheet || {}), [key]: value } })
}

function setRef(index, slot, patch) {
  const current = project.value.filmSheet.characters[index]
  const refs = [...(current.sheet?.refs || []).filter(item => item.slot !== slot), { slot, name: '', note: '', ...patch }]
  editTurn(index, 'refs', refs)
}

function readRef(index, slot, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    notify('Choose a PNG, JPEG, WebP, or GIF.', 'info')
    return
  }
  if (file.size > 120000) {
    notify('Use a reference under 120 KB. It stays on this device.', 'info')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result || '')
    if (!dataUrl.startsWith('data:image/') || dataUrl.length > 180000) {
      notify('That image is too large to keep on this device.', 'info')
      return
    }
    setRef(index, slot, { name: file.name, dataUrl })
  }
  reader.readAsDataURL(file)
}

function clearRef(index, slot) {
  const current = project.value.filmSheet.characters[index]
  const refs = (current.sheet?.refs || []).filter(item => item.slot !== slot)
  editTurn(index, 'refs', refs)
}

function addState(index) {
  const draft = drafts[index] || {}
  const change = String(draft.change || '').trim()
  const fromOrder = Math.max(1, Math.min(999, Math.round(Number(draft.fromOrder) || 1)))
  if (!change) {
    notify('Describe the wardrobe change first.', 'info')
    return
  }
  const current = project.value.filmSheet.characters[index]
  const states = [...(current.states || []).filter(item => Number(item.fromOrder) !== fromOrder), { fromOrder, change }]
  patchAt(index, { states })
  drafts[index] = { fromOrder: fromOrder + 1, change: '' }
}

function removeState(index, fromOrder) {
  const current = project.value.filmSheet.characters[index]
  patchAt(index, { states: (current.states || []).filter(item => Number(item.fromOrder) !== Number(fromOrder)) })
}

function copyPacket(kind) {
  if (kind === 'json') copyText(JSON.stringify(characterPacket(project.value)), 'Character packet copied.')
  else copyText(characterPacketMarkdown(project.value), 'Character packet copied as Markdown.')
}

function downloadPacket(kind) {
  if (kind === 'json') downloadText('moovicut-character-packet.json', JSON.stringify(characterPacket(project.value), null, 2), 'application/json')
  else downloadText('moovicut-character-packet.md', characterPacketMarkdown(project.value), 'text/markdown')
}

function openPacket() {
  packetDialog.value?.showModal()
}

function printPacket() {
  const frame = window.open('', '_blank', 'noopener,noreferrer')
  if (!frame) {
    notify('Allow pop-ups to print, or download the Markdown.', 'info')
    return
  }
  frame.document.write(characterPacketDocument(project.value))
  frame.document.close()
  frame.focus()
  frame.print()
}
</script>

<template>
  <div class="character-sheet-block">
    <p class="character-sheet-lead">{{ $t('One lock line per character. It is pasted unchanged into every shot they appear in.') }}</p>
    <article v-for="(character, index) in cast" :key="`${character.name}-${index}`" class="character-sheet-card">
      <header class="character-sheet-head">
        <h4>{{ character.name }}</h4>
        <p>{{ $t('Shot 1 lock') }}</p>
      </header>
      <label :for="`lock-${index}`">{{ $t('Lock line') }}</label>
      <textarea :id="`lock-${index}`" :value="character.lockEdited ? character.lockLine : lockLineFor(character, 1)" rows="3" @change="editLock(index, $event.target.value)"></textarea>
      <button type="button" class="text-button" @click="resetLock(index)">{{ $t('Use the sheet again') }}</button>
      <div class="character-sheet-fields">
        <div v-for="[field, label] in fields" :key="field">
          <label :for="`char-${index}-${field}`">{{ $t(label) }}</label>
          <input :id="`char-${index}-${field}`" :value="character[field]" @change="editField(index, field, $event.target.value)" />
        </div>
      </div>
      <details>
        <summary>{{ $t('Turnaround, expressions, palette') }}</summary>
        <div class="character-sheet-fields">
          <div v-for="[field, label] in turnaround" :key="field">
            <label :for="`turn-${index}-${field}`">{{ $t(label) }}</label>
            <textarea :id="`turn-${index}-${field}`" rows="2" :value="character.sheet[field]" @change="editTurn(index, field, $event.target.value)"></textarea>
          </div>
        </div>
      </details>
      <details>
        <summary>{{ $t('Reference images you supply') }}</summary>
        <p>{{ $t('These stay in this browser. Moovicut does not upload them or call an image API.') }}</p>
        <div class="character-ref-slots">
          <div v-for="ref in character.sheet.refs" :key="ref.slot">
            <label :for="`ref-${index}-${ref.slot}`">{{ $t(slotKey(ref.slot)) }}</label>
            <img v-if="ref.dataUrl" :src="ref.dataUrl" :alt="ref.name || $t('{name} {slot} reference', { name: character.name, slot: $t(slotKey(ref.slot)) })" />
            <input :id="`ref-${index}-${ref.slot}`" type="file" accept="image/png,image/jpeg,image/webp,image/gif" :aria-label="$t('{name} reference image, {slot}', { name: character.name || $t('Character'), slot: $t(slotKey(ref.slot)) })" @change="readRef(index, ref.slot, $event)" />
            <label :for="`ref-note-${index}-${ref.slot}`">{{ $t('Note') }}</label>
            <input :id="`ref-note-${index}-${ref.slot}`" :value="ref.note" @change="setRef(index, ref.slot, { name: ref.name, note: $event.target.value, dataUrl: ref.dataUrl })" />
            <button v-if="ref.dataUrl || ref.note" type="button" class="text-button" @click="clearRef(index, ref.slot)">{{ $t('Remove {slot}', { slot: ref.slot }) }}</button>
          </div>
        </div>
      </details>
      <div class="character-wardrobe">
        <h5>{{ $t('Wardrobe change') }}</h5>
        <p>{{ $t('A change starts at one shot and carries forward. The face and hair stay locked.') }}</p>
        <ul v-if="character.states.length">
          <li v-for="state in character.states" :key="`${state.fromOrder}-${state.change}`">
            {{ $t('From shot {order}: {change}', { order: state.fromOrder, change: state.change }) }}
            <button type="button" class="text-button" @click="removeState(index, state.fromOrder)">{{ $t('Remove') }}</button>
          </li>
        </ul>
        <div class="character-wardrobe-form">
          <div>
            <label :for="`state-from-${index}`">{{ $t('From shot') }}</label>
            <input :id="`state-from-${index}`" type="number" min="1" max="999" :value="drafts[index]?.fromOrder || 1" @input="drafts[index] = { ...(drafts[index] || {}), fromOrder: $event.target.value }" />
          </div>
          <div>
            <label :for="`state-change-${index}`">{{ $t('Change') }}</label>
            <input :id="`state-change-${index}`" :value="drafts[index]?.change || ''" :placeholder="$t('coat removed')" @input="drafts[index] = { ...(drafts[index] || {}), change: $event.target.value }" />
          </div>
          <button type="button" @click="addState(index)">{{ $t('Carry forward') }}</button>
        </div>
      </div>
    </article>
    <div class="character-packet-actions">
      <button type="button" @click="copyPacket('json')">{{ $t('Copy packet JSON') }}</button>
      <button type="button" @click="downloadPacket('json')">{{ $t('Download packet JSON') }}</button>
      <button type="button" @click="copyPacket('markdown')">{{ $t('Copy packet Markdown') }}</button>
      <button type="button" @click="downloadPacket('markdown')">{{ $t('Download packet Markdown') }}</button>
      <button type="button" @click="openPacket">{{ $t('Preview printable packet') }}</button>
    </div>
    <dialog ref="packetDialog" class="character-packet-dialog">
      <form method="dialog">
        <header>
          <h2>{{ $t('Character packet') }}</h2>
          <button value="close">{{ $t('Close') }}</button>
        </header>
      </form>
      <article>
        <section v-for="person in cast" :key="person.name">
          <h3>{{ person.name }}</h3>
          <p class="character-lock-preview">{{ person.lockEdited ? person.lockLine : lockLineFor(person, 1) }}</p>
        </section>
        <section v-for="(shot, index) in project.shots" :key="shot.id">
          <h3>{{ $t('Shot {n}', { n: index + 1 }) }}</h3>
          <pre>{{ shot.prompt }}</pre>
        </section>
      </article>
      <button type="button" @click="printPacket">{{ $t('Print') }}</button>
    </dialog>
  </div>
</template>
