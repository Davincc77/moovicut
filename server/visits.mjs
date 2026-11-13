import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, existsSync, accessSync, constants } from 'node:fs'
import { dirname } from 'node:path'

const BOT = /bot\b|crawl|spider|slurp|preview|headless|facebookexternalhit|embedly|quora|whatsapp|telegram|slackbot|discord|linkedinbot|twitterbot|applebot|bingbot|googlebot|duckduck|baidu|yandex|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|amazonbot|wget|curl\b|python-requests|go-http-client/i
const VIEW_CAP = 60

export function isBot(userAgent = '') {
  return BOT.test(String(userAgent || ''))
}

export function normalizePath(input) {
  if (typeof input !== 'string' || !input.startsWith('/')) return '/'
  const bare = input.split(/[?#]/)[0]
  let decoded = bare
  try { decoded = decodeURIComponent(bare) } catch { return '/' }
  if (decoded.includes('\0') || decoded.includes('\\')) return '/'
  const parts = decoded.split('/').filter(Boolean)
  if (parts.some(part => part === '.' || part === '..')) return '/'
  const path = `/${parts.join('/')}`
  if (path === '/stats' || path.startsWith('/api/')) return ''
  return path.length > 180 ? path.slice(0, 180) : path
}

export function referrerHost(input) {
  if (typeof input !== 'string' || !input.trim()) return 'direct'
  try {
    const host = new URL(input).hostname.toLowerCase()
    if (!host || host.length > 253 || host.includes('@')) return 'direct'
    return host
  } catch {
    return 'direct'
  }
}

export function tokensMatch(provided, expected) {
  if (!expected || !provided) return false
  const left = createHash('sha256').update(String(provided)).digest()
  const right = createHash('sha256').update(String(expected)).digest()
  return timingSafeEqual(left, right)
}

function directoryWritable(directory) {
  try {
    if (!directory || !existsSync(directory)) return false
    accessSync(directory, constants.W_OK)
    return true
  } catch {
    return false
  }
}

function readState(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
    if (!parsed || parsed.version !== 1 || !Number.isInteger(parsed.total) || !parsed.days || typeof parsed.days !== 'object') return null
    return { total: parsed.total, days: parsed.days }
  } catch {
    return null
  }
}

function writeAtomic(filePath, value) {
  const temporary = `${filePath}.tmp`
  writeFileSync(temporary, JSON.stringify(value), 'utf8')
  renameSync(temporary, filePath)
}

function emptyDay(salt) {
  return { views: 0, uniques: 0, salt, seen: {}, pages: {}, referrers: {} }
}

export function createVisitStore({ filePath = '', now = () => new Date(), random = () => randomBytes(32).toString('hex') } = {}) {
  const state = { total: 0, days: {} }
  let persistent = Boolean(filePath) && directoryWritable(dirname(filePath))
  if (persistent) {
    const loaded = readState(filePath)
    if (loaded) {
      state.total = loaded.total
      state.days = loaded.days
    }
  }

  function dayKey(date) {
    return date.toISOString().slice(0, 10)
  }

  function todayBucket(date) {
    const key = dayKey(date)
    for (const [day, bucket] of Object.entries(state.days)) {
      if (day === key) continue
      delete bucket.salt
      delete bucket.seen
      for (const page of Object.values(bucket.pages || {})) delete page.seen
    }
    if (!state.days[key]) state.days[key] = emptyDay(random())
    if (!state.days[key].salt) state.days[key].salt = random()
    if (!state.days[key].seen) state.days[key].seen = {}
    return state.days[key]
  }

  function persist() {
    if (!persistent) return
    try { writeAtomic(filePath, { version: 1, total: state.total, days: state.days }) }
    catch { persistent = false }
  }

  function record({ address = '', userAgent = '', path = '/', referrer = '', purpose = '' } = {}) {
    if (isBot(userAgent) || /prefetch/i.test(String(purpose || ''))) return { counted: false, total: state.total }
    const pagePath = normalizePath(path)
    if (!pagePath) return { counted: false, total: state.total }
    const bucket = todayBucket(now())
    const page = bucket.pages[pagePath] || (bucket.pages[pagePath] = { views: 0, uniques: 0, seen: {} })
    const visitor = address ? createHmac('sha256', bucket.salt).update(String(address)).digest('hex') : ''
    const prior = visitor ? bucket.seen[visitor] || 0 : 0
    if (visitor && prior >= VIEW_CAP) return { counted: false, total: state.total }
    const host = referrerHost(referrer)
    bucket.views += 1
    page.views += 1
    state.total += 1
    bucket.referrers[host] = (bucket.referrers[host] || 0) + 1
    if (visitor) {
      bucket.seen[visitor] = prior + 1
      if (prior === 0) bucket.uniques += 1
      if (!page.seen[visitor]) {
        page.seen[visitor] = true
        page.uniques += 1
      }
    }
    persist()
    return { counted: true, total: state.total }
  }

  function stats() {
    const days = Object.entries(state.days).map(([date, bucket]) => ({
      date, views: bucket.views || 0, uniques: bucket.uniques || 0
    })).sort((left, right) => right.date.localeCompare(left.date)).slice(0, 90)
    const pages = new Map()
    const referrers = new Map()
    for (const bucket of Object.values(state.days)) {
      for (const [path, page] of Object.entries(bucket.pages || {})) {
        const current = pages.get(path) || { path, views: 0, uniques: 0 }
        current.views += page.views || 0
        current.uniques += page.uniques || 0
        pages.set(path, current)
      }
      for (const [host, views] of Object.entries(bucket.referrers || {})) referrers.set(host, (referrers.get(host) || 0) + views)
    }
    return {
      total: state.total,
      persistent,
      days,
      pages: [...pages.values()].sort((left, right) => right.views - left.views).slice(0, 20),
      referrers: [...referrers.entries()].map(([host, views]) => ({ host, views })).sort((left, right) => right.views - left.views).slice(0, 20)
    }
  }

  todayBucket(now())
  if (persistent) persist()

  return {
    record,
    publicTotal: () => ({ total: state.total }),
    stats,
    snapshot: () => JSON.stringify({ version: 1, total: state.total, days: state.days }),
    persistent: () => persistent
  }
}
