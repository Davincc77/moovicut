export const DEFAULT_PREFERENCES = Object.freeze({ autoSave:true, darkMode:false, notifications:false, emailUpdates:false })

/** Device-only settings. Injected storage makes browser and Node behavior identical. */
export function createPreferences(storage = undefined, initial = undefined) {
  const settings = { ...DEFAULT_PREFERENCES }
  try {
    const saved = initial ?? (storage ? JSON.parse(storage.getItem('shotboard.preferences.v1') || 'null') : null)
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const key of Object.keys(DEFAULT_PREFERENCES)) if (typeof saved[key] === 'boolean') settings[key] = saved[key]
    }
  } catch { /* Blocked or malformed storage keeps defaults. */ }
  function setPreference(key, value) {
    if (!Object.hasOwn(DEFAULT_PREFERENCES, key) || typeof value !== 'boolean') throw new Error('Choose a supported local preference.')
    settings[key] = value
    if (storage) {
      try { storage.setItem('shotboard.preferences.v1', JSON.stringify(settings)) }
      catch { /* Keep the preference for this visit if persistence is blocked. */ }
    }
    return { ...settings }
  }
  return { settings, setPreference }
}
