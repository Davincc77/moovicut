export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  const store = useProjectStore()
  store.hydrate()
  const respond = operation => {
    try {
      operation()
      return { ok: true, project: JSON.parse(store.serialized.value) }
    } catch (error) {
      return { ok: false, error: { code: error.code || 'invalid_request', message: error.message } }
    }
  }
  const requireShot = id => {
    if (!store.project.shots.some(shot => shot.id === id)) {
      const error = new Error(`No shot exists with ID ${String(id)}.`)
      error.code = 'shot_not_found'
      throw error
    }
  }
  const requireDirection = direction => {
    if (direction !== 1 && direction !== -1) {
      const error = new Error('Direction must be exactly -1 or 1.')
      error.code = 'invalid_direction'
      throw error
    }
  }
  // Documented, page-local automation: same store and validation as the editor.
  // Each mutation returns { ok, project } or { ok: false, error }.
  window.Shotboard = Object.freeze({
    version: 'shotboard.v1',
    capabilities: () => ({ models: ['grok', 'google', 'sora', 'kling', 'runway', 'luma', 'wan', 'generic'], actions: ['get_project', 'create_project', 'update_shot', 'reorder_shot', 'delete_shot', 'export_json'], promptFields: ['title', 'action', 'camera', 'lighting', 'continuity', 'prompt'], videoGeneration: false, persistence: 'browser-local', authentication: false }),
    getProject: () => JSON.parse(store.serialized.value),
    createProject: input => respond(() => store.createNew(input?.premise, input?.model, input)),
    updateShot: (shotId, patch) => respond(() => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Provide a shot patch object.')
      const allowed = ['title', 'action', 'camera', 'lighting', 'continuity', 'prompt', 'sound', 'framing', 'lens', 'duration', 'duration_seconds']
      const entries = Object.entries(patch).filter(([field]) => allowed.includes(field))
      if (entries.length !== Object.keys(patch).length) throw new Error('The patch contains an unsupported field.')
      for (const [field, value] of entries) if (field.startsWith('duration') ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== 'string') throw new Error(`Invalid value for ${field}.`)
      if (!entries.length) throw new Error('Include at least one supported field to edit.')
      requireShot(shotId)
      store.updateShotFields(shotId, Object.fromEntries(entries))
    }),
    reorderShot: (shotId, direction) => respond(() => { requireDirection(direction); requireShot(shotId); store.moveShot(shotId, direction) }),
    deleteShot: shotId => respond(() => { requireShot(shotId); store.removeShot(shotId) }),
    exportJSON: () => store.serialized.value
  })
  window.Moovicut = window.Shotboard
})
