/* Explicit imports keep these shared helpers available to the browser and the CLI. */
import { createPreferences } from '../utils/preferences.js'
import { applyModelProfile, applyStylePreset, canonicalAspect, canonicalModel, createStoryboard, normalizeProject, regenerateOneShot, regenerateShotPrompts, addShot, assignShotStages, refreshShotPrompt, retargetMode, serializeProject, STARTER, validateProject } from '../utils/prompt-engine.js'
import { profileFor } from '../utils/model-profiles.js'
import { LIGHTS, sequencePacks } from '../utils/scenario.js'
import { emptyLibrary, exportLibrary, importLibrary, readLibrary, saveCharacter, savePlace, saveStyle, writeLibrary } from '../utils/library.js'
import { exportAgentBoard } from '../utils/agent-board.js'
const clone = value => JSON.parse(JSON.stringify(value))
const STORAGE_KEY = 'shotboard.projects.v1'
const CURRENT_KEY = 'shotboard.current.v1'
const hasLocalStorage = () => typeof localStorage !== 'undefined'
export const GUEST_IDENTITY = Object.freeze({ id:'guest', name:'Guest', email:'guest@local', provider:'guest', verified:false, localOnly:true })
export function useProjectStore() {
  const project = useState('project', () => clone(STARTER))
  const identity = useState('workspace-identity', () => ({ ...GUEST_IDENTITY }))
  const libraryState = useState('moovicut-project-library', () => [])
  const savedProjects = computed({
    get: () => Array.isArray(libraryState.value) ? libraryState.value.filter(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string' && Array.isArray(item.shots)) : [],
    set: value => { libraryState.value = Array.isArray(value) ? value : [] }
  })
  const history = useState('projectHistory', () => [])
  const future = useState('projectFuture', () => [])
  const hydrated = useState('storeHydrated', () => false)
  const preferences = useState('workspace-preference-engine', () => createPreferences(typeof localStorage !== 'undefined' ? localStorage : undefined))
  const settings = computed(() => preferences.value.settings)
  const saving = ref(false)
  function setPreference(key, value) {
    const next = preferences.value.setPreference(key, value)
    preferences.value = { ...preferences.value, settings:next }
    return next
  }
  function attachReference(file) {
    if (!file || typeof file.name !== 'string') throw new Error('Choose a local reference image.')
    if (file.type && !file.type.startsWith('image/')) throw new Error('Choose an image file for your reference.')
    const reference = { name:file.name.slice(0,160), type:file.type || 'image', size:Number(file.size)||0, attachedAt:new Date().toISOString() }
    project.value = { ...project.value, reference }
    persist()
    return reference
  }
  const saveState = useState('project-save-state', () => ({ status: 'idle', message: '', savedAt: null }))
  const { notify } = useNotifier()
  const shotCount = computed(() => project.value.shots?.length || 0)
  const duration = computed(() => (project.value.shots || []).reduce((sum, shot) => sum + (Number(shot.duration) || 0), 0))
  const canUndo = computed(() => history.value.length > 0)
  function markSave(status, message) { saveState.value = { status, message, savedAt: status === 'saved' ? new Date().toISOString() : null } }
  function persist({ quiet = false, track = true } = {}) {
    const updated = clone(project.value)
    if (!hasLocalStorage()) { markSave('error', 'Local storage is unavailable. Download a backup to keep this job.'); return false }
    try {
      const nextLibrary = savedProjects.value.filter(item => item.id !== updated.id)
      if (track) nextLibrary.unshift(updated)
      const serialized = JSON.stringify(nextLibrary)
      // Write both keys before exposing the new in-memory version as saved.
      localStorage.setItem(STORAGE_KEY, serialized)
      localStorage.setItem(CURRENT_KEY, updated.id)
      savedProjects.value = track ? nextLibrary : nextLibrary.filter(item => item.id !== updated.id)
      saving.value = true
      markSave('saved', 'Saved on this device')
      if (!quiet) notify(`Job “${updated.title || 'Untitled story'}” saved on this device.`)
      setTimeout(() => { saving.value = false }, 350)
      return true
    } catch (error) {
      markSave('error', 'This browser could not save your job. Download a backup to keep it.')
      console.warn('Project save failed', error)
      return false
    }
  }
  function hydrate() {
    if (hydrated.value || !hasLocalStorage()) return
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      if (Array.isArray(stored)) savedProjects.value = stored.filter(item => { try { validateProject(item); return true } catch { return false } }).map(normalizeProject)
      const current = savedProjects.value.find(item => item.id === localStorage.getItem(CURRENT_KEY)) || savedProjects.value[0]
      if (current) project.value = normalizeProject(current)
      const storedIdentity = JSON.parse(localStorage.getItem('shotboard.identity') || 'null')
      if (storedIdentity) identity.value = normalizeIdentity(storedIdentity)
    } catch (error) {
      savedProjects.value = []
      project.value = clone(STARTER)
      identity.value = { ...GUEST_IDENTITY }
      console.warn('Local workspace was not available', error)
    }
    if (!project.value || !Array.isArray(project.value.shots)) project.value = clone(STARTER)
    personalLibrary.value = readLibrary(hasLocalStorage() ? localStorage : null)
    hydrated.value = true
  }
  function normalizeIdentity(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Identity details are invalid.')
    const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : ''
    if (!name) throw new Error('Enter a display name for this local workspace.')
    const email = typeof value.email === 'string' ? value.email.trim().slice(0, 160) : ''
    return { id: String(value.id || 'local-workspace'), name, email, role: ['Director', 'Storyboard artist', 'Writer', 'Producer', 'Creative developer'].includes(value.role) ? value.role : 'Director', provider: String(value.provider || 'local'), verified: !!value.verified, localOnly: true }
  }
  function setIdentity(value, { silent = false } = {}) {
    identity.value = normalizeIdentity(value)
    if (hasLocalStorage()) {
      try { localStorage.setItem('shotboard.identity', JSON.stringify(identity.value)) }
      catch { notify('Identity updated for this visit, but local identity storage is unavailable.', 'info'); return identity.value }
    }
    if (!silent) notify('Local identity updated on this device.')
    return identity.value
  }
  function saveLocalIdentity(name, details = {}) { return setIdentity({ ...identity.value, name, email: details.email ?? identity.value.email, role: details.role || identity.value.role, provider: 'local', verified: false }) }
  function setGuestIdentity() { return setIdentity({ ...GUEST_IDENTITY }) }
  function restoreBackup(backup) {
    if (!backup || !['shotboard.v1','shotboard.backup.v1'].includes(backup.schema) || !Array.isArray(backup.projects)) throw new Error('Choose a valid Moovicut workspace backup.')
    const restored = backup.projects.map(item => normalizeProject(validateProject(item).project))
    if (new Set(restored.map(item => item.id)).size !== restored.length) throw new Error('Backup project IDs must be unique.')
    const nextIdentity = backup.identity == null ? { ...GUEST_IDENTITY } : normalizeIdentity(backup.identity)
    // Validate everything before replacing any in-memory or persisted work.
    const previousLibrary = savedProjects.value
    const previousProject = project.value
    const previousIdentity = identity.value
    try {
      if (hasLocalStorage()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restored))
        if (restored[0]) localStorage.setItem(CURRENT_KEY, restored[0].id)
        else localStorage.removeItem(CURRENT_KEY)
        localStorage.setItem('shotboard.identity', JSON.stringify(nextIdentity))
      }
      savedProjects.value = restored
      project.value = restored[0] ? clone(restored[0]) : clone(STARTER)
      identity.value = nextIdentity
      history.value = []
      future.value = []
      markSave(restored.length ? 'saved' : 'idle', restored.length ? 'Backup restored on this device.' : '')
    } catch (error) {
      savedProjects.value = previousLibrary
      project.value = previousProject
      identity.value = previousIdentity
      throw new Error('This browser could not restore the backup. Your existing workspace was not replaced.')
    }
    return true
  }
  function commit(next, message) {
    const normalized = normalizeProject(validateProject({ ...clone(next), target_model: next.model || next.target_model, updatedAt: new Date().toISOString() }).project)
    history.value.push(clone(project.value)); if (history.value.length > 40) history.value.shift()
    future.value = []; project.value = normalized; persist()
    if (message) notify(message)
  }
  function mutate(callback, message) { const next = clone(project.value); callback(next); commit(next, message) }
  function createNew(premise, model = project.value.model, options = {}) {
    if (!premise?.trim() && !options.scenario && options.sequenceMode !== 'scenario') throw new Error('Start with a short premise for your story.')
    const next = createStoryboard({ ...options, premise: premise || '', model }); commit(next, 'Your storyboard is ready. Make it yours.'); return next
  }
  function selectModel(model) { const next = canonicalModel(model); if (!next || next === project.value.model) return; commit(applyModelProfile(project.value, next), `Prompts adapted for ${profileFor(next).label}. Prompts you edited stay as you left them.`) }
  function applyPromptSettings(patch = {}) {
    mutate(next => {
      if (patch.aspectRatio) next.aspectRatio = canonicalAspect(patch.aspectRatio)
      if (next.sequenceMode === 'continuous' && (patch.continuityStrength === 'strict' || patch.continuityStrength === 'standard')) next.continuityStrength = patch.continuityStrength
      if (patch.promptDensity === 'concise' || patch.promptDensity === 'standard') next.promptDensity = patch.promptDensity
      if (patch.density === 'concise' || patch.density === 'standard') next.promptDensity = patch.density
      next.shots = next.shots.map((shot, index) => refreshShotPrompt(shot, next, index))
      if (next.sequenceMode === 'scenario') next.sequences = sequencePacks(next)
    }, 'Shot prompts updated on this device. Prompts you edited stay as you left them.')
  }
  function updateContinuity(field, value) { mutate(next => {
    next.continuitySheet = { ...(next.continuitySheet || {}), [field]: value }
    if (next.filmSheet?.characters?.[0]) {
      if (field === 'character') next.filmSheet.characters[0].name = value
      if (field === 'appearance') { next.filmSheet.characters[0].look = value; next.filmSheet.characters[0].outfit = value }
    }
    if (field === 'place' && next.filmSheet?.places?.[0]) { next.filmSheet.places[0].name = value; next.filmSheet.places[0].description = value }
    if (field === 'style' && next.filmSheet) next.filmSheet.style = value
    if (field === 'time' && next.filmSheet) next.filmSheet.light = value
    next.shots = next.shots.map((shot, index) => refreshShotPrompt(shot, next, index))
  }, 'Continuity sheet updated. Generated prompts now match it. Prompts you edited stay as you left them.') }
  function patchFilmSheet(patch = {}) {
    mutate(next => {
      if (!next.filmSheet) return
      const light = typeof patch.light === 'string' ? patch.light : next.filmSheet.light
      next.filmSheet = {
        ...next.filmSheet,
        ...patch,
        characters: patch.characters || next.filmSheet.characters.map(item => ({ ...item })),
        places: patch.places || next.filmSheet.places.map(item => ({ ...item }))
      }
      if (typeof patch.light === 'string') {
        next.shots.forEach(shot => { if (!shot.light && !shot.promptEdited) shot.lighting = LIGHTS[light] || shot.lighting })
      }
      if (next.continuitySheet && next.filmSheet.characters?.[0]) {
        next.continuitySheet = { ...next.continuitySheet, character: next.filmSheet.characters[0].name, appearance: next.filmSheet.characters[0].look || next.filmSheet.characters[0].outfit || next.continuitySheet.appearance }
        if (next.filmSheet.places?.[0]) next.continuitySheet.place = next.filmSheet.places[0].name
      }
      next.shots = next.shots.map((shot, index) => refreshShotPrompt(shot, next, index))
      if (next.sequenceMode === 'scenario') next.sequences = sequencePacks(next)
    }, 'Film sheet updated. Generated prompts now match it. Prompts you edited stay as you left them.')
  }
  function setSequenceMode(mode) {
    commit(retargetMode(project.value, mode), 'The mode changed. The film sheet and your edited prompts stayed.')
  }
  function updateShot(id, field, value, regenerate = true) { mutate(next => {
    const index = next.shots.findIndex(shot => shot.id === id); if (index < 0) throw new Error(`Shot not found: ${id}`)
    const updated = { ...next.shots[index], [field]: value }
    if (field === 'prompt') updated.promptEdited = true
    const duration = Math.max(2, Math.min(15, Number(updated.duration) || 3)); updated.duration = duration; updated.duration_seconds = duration
    next.shots[index] = regenerate && field !== 'prompt' ? refreshShotPrompt(updated, next, index) : updated
    if (next.sequenceMode === 'scenario') next.sequences = sequencePacks(next)
  }) }
  function updateShotFields(id, patch) { mutate(next => {
    const index = next.shots.findIndex(shot => shot.id === id); if (index < 0) throw new Error(`Shot not found: ${id}`)
    const updated = { ...next.shots[index], ...patch }
    const duration = Math.max(2, Math.min(15, Number(patch.duration_seconds ?? patch.duration ?? updated.duration) || 3))
    updated.duration = duration; updated.duration_seconds = duration
    if ('prompt' in patch && !patch.prompt?.trim()) throw new Error('A shot prompt cannot be empty.')
    if ('prompt' in patch) updated.promptEdited = true
    next.shots[index] = 'prompt' in patch ? updated : refreshShotPrompt(updated, next, index)
    if (next.sequenceMode === 'scenario') next.sequences = sequencePacks(next)
  }) }
  function setStylePreset(family, genre) {
    mutate(next => {
      const updated = applyStylePreset(next, family, genre)
      Object.assign(next, updated)
      next.shots = updated.shots
    }, 'Style preset applied. Generated prompts now match it. Prompts you edited stay as you left them.')
  }
  function regenerateOne(id) {
    const result = regenerateOneShot(project.value, id)
    if (result.skipped) {
      notify('This prompt was edited by you, so it stayed as you left it.', 'info')
      return result
    }
    commit(result.project, 'This shot was regenerated. The other prompts stayed the same.')
    return result
  }
  function resetShotPrompt(id) { mutate(next => {
    const index = next.shots.findIndex(shot => shot.id === id || shot.shot_id === id)
    if (index < 0) throw new Error(`Shot not found: ${id}`)
    next.shots[index] = refreshShotPrompt(next.shots[index], next, index, { overwrite: true })
    if (next.sequenceMode === 'scenario') next.sequences = sequencePacks(next)
  }, 'Prompt reset to the generated text.') }
  function removeShot(id) { if (project.value.shots.length <= 1) { notify('Keep at least one shot in your storyboard.', 'info'); return }; mutate(next => { next.shots = next.shots.filter(shot => shot.id !== id); assignShotStages(next.shots) }, 'Shot removed. Undo is available.') }
  function moveShot(id, direction) { mutate(next => {
    const index = next.shots.findIndex(shot => shot.id === id); const target = index + direction
    if (index < 0) throw new Error(`Shot not found: ${id}`); if (target < 0 || target >= next.shots.length) return
    const [shot] = next.shots.splice(index, 1); next.shots.splice(target, 0, shot)
    assignShotStages(next.shots)
    next.shots.forEach((shot, index) => { shot.order = index + 1 })
  }) }
  function insertShot(id) {
    const index = project.value.shots.findIndex(shot => shot.id === id); if (index < 0) throw new Error(`Shot not found: ${id}`)
    mutate(next => next.shots = addShot(next, index + 1).shots, 'New shot added')
  }
  function addShotAtEnd() { mutate(next => next.shots = addShot(next).shots, 'Shot added to your board') }
  function undo() { if (!history.value.length) return; future.value.push(clone(project.value)); project.value = history.value.pop(); persist(); notify('Previous version restored', 'info') }
  function redo() { if (!future.value.length) return; history.value.push(clone(project.value)); project.value = future.value.pop(); persist() }
  function loadProject(item) {
    history.value.push(clone(project.value)); if (history.value.length > 40) history.value.shift()
    future.value = []; project.value = normalizeProject(clone(item)); persist(); notify(`Opened “${item.title}”`)
  }
  function removeSavedProject(id) {
    savedProjects.value = savedProjects.value.filter(item => item.id !== id)
    if (project.value.id === id) {
      if (savedProjects.value.length) loadProject(savedProjects.value[0])
      else {
        const cleared = persist({ quiet: true, track: false })
        if (!cleared) return false
        project.value = clone(STARTER); history.value = []; future.value = []
        if (hasLocalStorage()) { localStorage.setItem(STORAGE_KEY, '[]'); localStorage.removeItem(CURRENT_KEY) }
        markSave('idle', '')
        notify('Story removed from this device.', 'info')
        return true
      }
    }
    persist()
    notify('Story removed from this device.', 'info')
  }
  function resetWorkspace() {
    if (hasLocalStorage()) {
      try {
        localStorage.setItem(STORAGE_KEY, '[]')
        localStorage.removeItem(CURRENT_KEY)
      } catch {
        markSave('error', 'Local projects could not be deleted. Download a backup and check browser storage permissions.')
        notify('Projects were not deleted. Check browser storage permissions.', 'error')
        return false
      }
    }
    savedProjects.value = []
    project.value = clone(STARTER)
    history.value = []
    future.value = []
    markSave('idle', '')
    hydrated.value = true
    return true
  }
  function importProject(text) {
    if (typeof text !== 'string') throw new Error('Project import requires JSON text.')
    if (text.length > 1_000_000) throw new Error('Project file is larger than the 1 MB limit.')
    const validated = validateProject(JSON.parse(text)); const imported = normalizeProject(validated.project)
    imported.id = savedProjects.value.some(item => item.id === imported.id) ? `imported-${Date.now().toString(36)}` : imported.id
    commit({ ...imported, title: imported.title || 'Imported story' }, 'Storyboard imported successfully'); return imported
  }
  const personalLibrary = useState('shotboard-personal-library', () => emptyLibrary())
  function rememberLibrary(next, message) {
    personalLibrary.value = next
    if (hasLocalStorage()) writeLibrary(localStorage, next)
    notify(message)
    return next
  }
  function rememberCharacter(character) { return rememberLibrary(saveCharacter(personalLibrary.value, character), 'Character saved on this device.') }
  function rememberPlace(place) { return rememberLibrary(savePlace(personalLibrary.value, place), 'Place saved on this device.') }
  function rememberStyle(style) { return rememberLibrary(saveStyle(personalLibrary.value, style), 'Style saved on this device.') }
  function libraryFile() { return exportLibrary(personalLibrary.value) }
  function replaceLibrary(text) { return rememberLibrary(importLibrary(text), 'Library imported on this device.') }
  function agentBoard() { return exportAgentBoard(project.value) }
  const api = { project, hydrated, saving, saveState, settings, setPreference, attachReference, history, future, shotCount, duration, canUndo, hydrate, persist, commit, mutate, createNew, selectModel, applyPromptSettings, updateShot, updateShotFields, updateContinuity, patchFilmSheet, setSequenceMode, setStylePreset, regenerateOne, resetShotPrompt, removeShot, moveShot, insertShot, addShotAtEnd, undo, redo, loadProject, removeSavedProject, resetWorkspace, restoreBackup, setIdentity, saveLocalIdentity, setGuestIdentity, importProject, rememberCharacter, rememberPlace, rememberStyle, libraryFile, replaceLibrary, agentBoard, serialized: computed(() => serializeProject(project.value)) }
  Object.defineProperty(api, 'personalLibrary', { enumerable: true, get: () => personalLibrary.value })
  Object.defineProperty(api, 'identity', { enumerable: true, get: () => identity.value })
  // Return an array property, not a ref: Vue templates unwrap refs exposed from setup.
  // A single getter/setter keeps the page, store and storage lifecycle in agreement.
  Object.defineProperty(api, 'savedProjects', { enumerable: true, get: () => savedProjects.value, set: value => { savedProjects.value = value } })
  return api
}
