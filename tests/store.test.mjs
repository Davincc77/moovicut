import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref, computed } from 'vue'
import { createStoryboard, normalizeProject } from '../app/utils/prompt-engine.js'
import { createPreferences } from '../app/utils/preferences.js'
import { useProjectStore } from '../app/composables/useProjectStore.js'

// Real Vue store with Nuxt's small primitives supplied, plus a localStorage double.
// This tests no rendered pixels; runtime browser verification remains separate.
function localStorageDouble() {
  const data = new Map()
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }
}
function storeFixture() {
  const states = new Map()
  const data = new Map()
  globalThis.localStorage = { getItem:key=>data.has(key)?data.get(key):null, setItem:(key,value)=>data.set(key,String(value)), removeItem:key=>data.delete(key) }
  globalThis.useState = (key, init) => { if (!states.has(key)) states.set(key, ref(init())); return states.get(key) }
  globalThis.ref = ref
  globalThis.computed = computed
  globalThis.useNotifier = () => ({ notify: () => {} })
  globalThis.useHead = () => {}
  const store = useProjectStore(); store.hydrate(); return store
}

test('local references retain metadata without storing image bytes', () => {
  const store = storeFixture()
  const reference = store.attachReference({ name:'storyboard-reference.png', type:'image/png', size:2048 })
  assert.equal(reference.name, 'storyboard-reference.png')
  assert.equal(reference.type, 'image/png')
  assert.equal(store.project.value.reference.size, 2048)
  const saved = JSON.parse(localStorage.getItem('shotboard.projects.v1'))
  assert.equal(saved[0].reference.name, 'storyboard-reference.png')
  assert.equal(saved[0].reference.data, undefined)
  assert.throws(() => store.attachReference({ name:'document.txt', type:'text/plain' }), /image file/)
})
test('preferences survive the portable engine and reject unknown settings', () => {
  const data = new Map()
  const storage = { getItem:key => data.has(key) ? data.get(key) : null, setItem:(key,value) => data.set(key,String(value)) }
  const preferences = createPreferences(storage)
  assert.equal(preferences.settings.darkMode, false)
  assert.equal(preferences.setPreference('darkMode', true).darkMode, true)
  assert.equal(JSON.parse(data.get('shotboard.preferences.v1')).darkMode, true)
  assert.equal(createPreferences(storage).settings.darkMode, true)
  assert.throws(() => preferences.setPreference('unknown', true), /supported local preference/)
})

test('free shot creation and project library are not capped by a plan', () => {
  const project=createStoryboard({premise:'A lighthouse keeper charts a safe passage through the storm.',count:10})
  assert.equal(project.shots.length,10)
  assert.ok(project.shots[9].prompt.includes('continue the story'))
  const store=storeFixture()
  for(let index=0;index<45;index++)store.createNew(`A lighthouse keeper records story number ${index} before the storm.`)
  assert.equal(store.savedProjects.length,45)
  store.hydrated.value=false;store.hydrate();assert.equal(store.savedProjects.length,45)
  for(let index=0;index<50;index++)store.addShotAtEnd()
  assert.ok(store.project.value.shots.length>48)
  const backup={schema:'shotboard.v1',projects:store.savedProjects,identity:store.identity}
  assert.equal(store.restoreBackup(backup),true)
})

test('reordering preserves exact prompt edits and uses consecutive order', () => {
  const project = createStoryboard({ premise: 'A violinist plays for passengers on the last ferry.', count: 4 })
  project.shots[0].prompt = 'A director-specific edit that must not be regenerated.'
  const next = JSON.parse(JSON.stringify(project)); const [shot] = next.shots.splice(0, 1); next.shots.splice(2, 0, shot)
  const result = normalizeProject(next)
  assert.equal(result.shots[2].id, shot.id); assert.equal(result.shots[2].prompt, shot.prompt)
  assert.deepEqual(result.shots.map(shot => shot.order), [1, 2, 3, 4])
})

test('real store persists projects, switches safely, undoes edits and reloads', () => {
  const store = storeFixture()
  const first = store.createNew('A lighthouse keeper repairs a failing beacon at dusk.', 'grok')
  const firstId = first.id
  const second = store.createNew('A cartographer discovers a valley missing from every map.', 'google')
  assert.equal(store.savedProjects.length, 2)
  assert.equal(store.project.value.id, second.id)
  assert.equal(store.savedProjects.find(item => item.id === firstId).model, 'grok')
  store.updateShotFields(second.shots[0].id, { sound: 'a distant radio beneath the wind', duration: 11 })
  assert.equal(store.project.value.shots[0].sound, 'a distant radio beneath the wind')
  assert.equal(store.project.value.shots[0].duration_seconds, 11)
  assert.ok(store.project.value.shots[0].prompt.includes('11 seconds'))
  store.undo(); assert.equal(store.project.value.shots[0].duration, 6)
  store.redo(); assert.equal(store.project.value.shots[0].duration, 11)
  const custom = 'A deliberately edited full prompt for the second shot.'
  const id = store.project.value.shots[1].id; store.updateShotFields(id, { prompt: custom }); store.moveShot(id, -1)
  assert.equal(store.project.value.shots[0].prompt, custom)
  assert.deepEqual(store.project.value.shots.map(shot => shot.order), store.project.value.shots.map((_, index) => index + 1))
  store.loadProject(store.savedProjects.find(item => item.id === firstId))
  assert.equal(store.project.value.id, firstId)
  assert.equal(store.savedProjects.find(item => item.id === second.id).model, 'google')
  const id2 = store.project.value.id
  store.removeSavedProject(id2)
  assert.equal(store.project.value.id, second.id)
  assert.ok(!store.savedProjects.some(item => item.id === id2))
  store.hydrated.value = false; store.hydrate(); assert.equal(store.project.value.id, second.id)
  store.removeSavedProject(second.id)
  assert.equal(store.project.value.id, 'starter-project'); assert.equal(store.savedProjects.length, 0)
  assert.equal(localStorage.getItem('shotboard.current.v1'), null)
  store.resetWorkspace()
  assert.equal(store.savedProjects.length, 0)
  assert.equal(localStorage.getItem('shotboard.current.v1'), null)
})

test('workspace backup restores validated projects and identity without raw library access', () => {
  const store = storeFixture()
  store.saveLocalIdentity('Local director')
  store.createNew('A violinist plays for passengers on the last ferry.', 'grok')
  const backup = { schema:'shotboard.backup.v1', identity:store.identity, projects:store.savedProjects }
  const id = store.project.value.id
  store.resetWorkspace()
  assert.equal(store.restoreBackup(backup), true)
  assert.equal(store.identity.name, 'Local director')
  assert.equal(store.savedProjects[0].id, id)
  assert.equal(store.project.value.id, id)
  assert.equal(localStorage.getItem('shotboard.current.v1'), id)
  store.setGuestIdentity()
  assert.equal(store.identity.provider, 'guest')
  assert.throws(() => store.restoreBackup({ schema:'wrong', projects:[] }), /valid Moovicut workspace backup/)
})

test('failed workspace deletion preserves saved projects', () => {
  const store = storeFixture()
  store.createNew('A cartographer discovers a valley missing from every map.', 'google')
  const count = store.savedProjects.length
  globalThis.localStorage.setItem = () => { throw new Error('Storage denied') }
  assert.equal(store.resetWorkspace(), false)
  assert.equal(store.savedProjects.length, count)
  assert.equal(store.saveState.value.status, 'error')
})

test('malformed saved libraries stay array-shaped during hydration and loading', () => {
  globalThis.localStorage = localStorageDouble()
  globalThis.localStorage.setItem('shotboard.projects.v1', '{bad json')
  const store = storeFixture()
  assert.ok(store.project.value && !Array.isArray(store.project.value))
  assert.equal(store.project.value.id, 'starter-project')
  assert.ok(Array.isArray(store.savedProjects))
  store.createNew('A lighthouse keeper repairs a failing beacon at dusk.', 'grok')
  store.resetWorkspace()
  assert.ok(store.savedProjects && typeof store.savedProjects.find === 'function' && typeof store.savedProjects.slice === 'function')
})

test('a saved library backup restores projects without a profile page', () => {
  const store = storeFixture()
  store.createNew('A lighthouse keeper repairs a failing beacon at dusk.', 'grok')
  const backup = { schema:'shotboard.backup.v1', projects: store.savedProjects, settings: store.settings }
  store.resetWorkspace()
  assert.equal(store.restoreBackup(backup), true)
  assert.ok(store.savedProjects.some(item => item.premise?.includes('lighthouse') || item.title))
})

test('footer does not offer other languages', () => {
  const footer = readFileSync('app/components/SiteFooter.vue', 'utf8')
  assert.match(footer, /© 2026 Moovicut/)
  assert.doesNotMatch(footer, /footer-language-menu|v-for="language in languages"/)
})

test('saved project library stays an array after repeated loads and deletions', () => {
  const store = storeFixture()
  store.createNew('A lighthouse keeper repairs a failing beacon at dusk.', 'grok')
  store.hydrated.value = false
  store.hydrate()
  assert.ok(Array.isArray(store.savedProjects))
  const saved = store.savedProjects.find(item => item.id !== 'starter-project')
  if (saved) store.removeSavedProject(saved.id)
  assert.ok(store.savedProjects && typeof store.savedProjects.find === 'function' && typeof store.savedProjects.slice === 'function')
})

test('store rejects bad agent-shaped patches and preserves model selection', () => {
  const store = storeFixture()
  store.createNew('An astronaut repairs the last telescope above the clouds.', 'grok')
  const id = store.project.value.shots[0].id
  store.selectModel('google'); assert.equal(store.project.value.target_model, 'google'); assert.match(store.project.value.shots[0].prompt, /^Idea: /); assert.match(store.project.value.shots[0].prompt, /\nSCENE:/)
  assert.throws(() => store.updateShotFields(id, { prompt: '' }), /cannot be empty/)
  assert.throws(() => store.updateShotFields('missing-shot', { title: 'No shot' }), /not found/)
})

test('save reports blocked browser storage instead of falsely claiming success', () => {
  const store = storeFixture()
  store.createNew('A director keeps a precious unfinished short film.', 'grok')
  assert.equal(store.persist().valueOf(), true)
  assert.equal(store.saveState.value.status, 'saved')
  globalThis.localStorage.setItem = () => { throw new Error('Storage full') }
  store.project.value.title = 'Unsaved backup needed'
  assert.equal(store.persist(), false)
  assert.equal(store.saveState.value.status, 'error')
  assert.match(store.saveState.value.message, /backup/)
  assert.equal(store.project.value.title, 'Unsaved backup needed')
})
