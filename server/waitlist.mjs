/** Moovicut Long waitlist store (lot 8) — mirrors the visits.mjs conventions:
 *  atomic write-tmp-then-rename, memory fallback when /data is absent, never
 *  crashes on corrupt state. Stores lowercased emails; nothing else. */
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const EMAIL_RX = /^[^\s@,;:<>"'\[\]\\]+@[^\s@,;:<>"'\[\]\\]+\.[A-Za-z]{2,}$/
const MAX_EMAIL = 254
const MAX_BODY = 2048

export function validEmail(input) {
  if (typeof input !== 'string') return false
  const email = input.trim().toLowerCase()
  return email.length <= MAX_EMAIL && EMAIL_RX.test(email)
}

export function createWaitlistStore({
  filePath,
  now = () => Date.now(),
  perMinute = 5,
  cap = 10000,
} = {}) {
  let emails = []
  let persistent = Boolean(filePath && typeof filePath === 'string')
  let recent = [] // timestamps of accepted attempts this minute

  if (persistent) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8'))
      if (Array.isArray(raw?.emails)) emails = raw.emails.filter(e => typeof e === 'string')
    } catch {
      try {
        readFileSync(filePath, 'utf8')
        // exists but corrupt: quarantine, restart clean
        renameSync(filePath, `${filePath}.corrupt-${now()}`)
      } catch { /* no file yet: fine */ }
    }
    try { mkdirSync(dirname(filePath), { recursive: true }) } catch { persistent = false }
  }

  function flush() {
    if (!persistent) return
    try {
      const tmp = `${filePath}.tmp-${process.pid}`
      writeFileSync(tmp, JSON.stringify({ version: 1, emails }, null, 1))
      renameSync(tmp, filePath)
    } catch { persistent = false }
  }

  return {
    persistent: () => persistent,
    total: () => emails.length,
    parseBody(text) {
      if (typeof text !== 'string') return { status: 400 }
      if (text.length > MAX_BODY) return { status: 413 }
      try {
        const body = JSON.parse(text)
        return { email: typeof body?.email === 'string' ? body.email : '', website: typeof body?.website === 'string' ? body.website : '' }
      } catch { return { status: 400 } }
    },
    async add(input, honeypot = '') {
      if (String(honeypot).trim() !== '') return { ok: true, duplicate: true } // bots fill every field: swallow quietly
      const email = String(input ?? '').trim().toLowerCase()
      if (!validEmail(email)) return { ok: false, status: 400, reason: 'invalid email' }
      if (emails.includes(email)) return { ok: true, duplicate: true }
      const t = now()
      recent = recent.filter(x => t - x < 60000)
      if (recent.length >= perMinute) return { ok: false, status: 429, reason: 'too many requests' }
      if (emails.length >= cap) return { ok: false, status: 507, reason: 'waitlist full' }
      recent.push(t)
      emails.push(email)
      flush()
      return { ok: true, duplicate: false }
    },
  }
}
