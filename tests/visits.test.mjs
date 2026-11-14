import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCounterShutdown, createVisitStore, visitCounterPath } from '../server/visits.mjs'
import { createVisitServer } from '../server/index.mjs'
import { createProdServer } from '../server/prod-server.mjs'

const browser = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const quiet = { warn() {} }

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

function close(server) {
  return new Promise(resolve => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close(() => resolve())
  })
}

test('a visitor is counted once per day and the raw address is never stored', () => {
  const dates = [new Date('2026-11-12T10:00:00Z'), new Date('2026-11-13T01:00:00Z')]
  let index = 0
  const store = createVisitStore({ now: () => dates[Math.min(index, dates.length - 1)], filePath: '' })
  const first = store.record({ address: '203.0.113.5', userAgent: browser, path: '/studio?project=1', referrer: 'https://user:secret@news.example/story?token=abc' })
  const second = store.record({ address: '203.0.113.5', userAgent: browser, path: '/faq', referrer: '' })
  assert.equal(first.counted, true)
  assert.equal(second.total, 2)
  assert.equal(store.stats().days.find(day => day.date === '2026-11-12').uniques, 1)
  assert.equal(store.stats().pages.find(page => page.path === '/studio').views, 1)
  assert.deepEqual(store.stats().referrers[0], { host: 'news.example', views: 1 })
  const saved = store.snapshot()
  assert.doesNotMatch(saved, /203\.0\.113\.5|secret|token=abc/)
  assert.equal(store.publicTotal().total, 2)
  assert.equal(JSON.stringify(store.publicTotal()), '{"total":2}')
  index = 1
  store.record({ address: '203.0.113.9', userAgent: browser, path: '/privacy' })
  const later = JSON.parse(store.snapshot())
  assert.equal(later.days['2026-11-12'].uniques, 1)
  assert.equal(later.days['2026-11-12'].salt, undefined)
  assert.equal(later.days['2026-11-12'].seen, undefined)
  assert.equal(later.days['2026-11-13'].uniques, 1)
  assert.doesNotMatch(JSON.stringify(store.stats()), /salt|seen|203\.0\.113/)
})

test('bots, prefetch, and the private stats path are not counted', () => {
  const store = createVisitStore({ filePath: '' })
  assert.equal(store.record({ address: '203.0.113.8', userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)', path: '/' }).counted, false)
  assert.equal(store.record({ address: '203.0.113.8', userAgent: browser, path: '/', purpose: 'prefetch' }).counted, false)
  assert.equal(store.record({ address: '203.0.113.8', userAgent: browser, path: '/stats' }).counted, false)
  assert.equal(store.record({ address: '203.0.113.8', userAgent: browser, path: '/../secret' }).counted, true)
  assert.equal(store.publicTotal().total, 1)
  assert.equal(store.stats().pages[0].path, '/')
  assert.doesNotMatch(store.snapshot(), /\.\./)
})

test('missing storage keeps the counter in memory', async () => {
  const warnings = []
  const store = createVisitStore({
    filePath: '/tmp/moovicut-missing-volume/visits.json',
    logger: { warn: message => warnings.push(message) }
  })
  assert.equal(store.persistent(), false)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /Visit counter: cannot write/)
  assert.equal(store.record({ address: '2001:db8::1', userAgent: browser, path: '/' }).counted, true)
  assert.equal(store.publicTotal().total, 1)
  assert.doesNotMatch(store.snapshot(), /2001:db8/)
  await store.flush()
  assert.equal(warnings.length, 1)
})

test('a writable directory restores totals without keeping yesterday hashes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-visits-'))
  const filePath = join(directory, 'visits.json')
  try {
    const first = createVisitStore({ filePath, now: () => new Date('2026-11-12T08:00:00Z'), logger: quiet })
    first.record({ address: '198.51.100.4', userAgent: browser, path: '/' })
    await first.flush()
    const second = createVisitStore({ filePath, now: () => new Date('2026-11-12T09:00:00Z'), logger: quiet })
    second.record({ address: '198.51.100.4', userAgent: browser, path: '/' })
    assert.equal(second.publicTotal().total, 2)
    assert.equal(second.stats().days[0].uniques, 1)
    await second.flush()
    const nextDay = createVisitStore({ filePath, now: () => new Date('2026-11-13T09:00:00Z'), logger: quiet })
    const stored = JSON.parse(readFileSync(filePath, 'utf8'))
    assert.equal(stored.days['2026-11-12'].salt, undefined)
    assert.equal(nextDay.publicTotal().total, 2)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('COUNTER_FILE selects the counter path', () => {
  assert.equal(visitCounterPath({}), '/data/visits.json')
  assert.equal(visitCounterPath({ COUNTER_FILE: '' }), '/data/visits.json')
  assert.equal(visitCounterPath({ COUNTER_FILE: '/tmp/visits.json' }), '/tmp/visits.json')
  assert.equal(visitCounterPath({ STATS_DATA_PATH: '/tmp/legacy.json' }), '/tmp/legacy.json')
  assert.equal(visitCounterPath({ COUNTER_FILE: '/tmp/visits.json', STATS_DATA_PATH: '/tmp/legacy.json' }), '/tmp/visits.json')
})

test('COUNTER_FILE keeps the visit count across a restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-counter-'))
  const staticRoot = mkdtempSync(join(tmpdir(), 'moovicut-counter-static-'))
  writeFileSync(join(staticRoot, 'index.html'), '<!doctype html><title>Home</title>')
  const previous = process.env.COUNTER_FILE
  process.env.COUNTER_FILE = join(directory, 'visits.json')
  const servers = []
  try {
    const filePath = visitCounterPath()
    assert.equal(filePath, process.env.COUNTER_FILE)
    const warnings = []
    const firstStore = createVisitStore({
      filePath,
      debounceMs: 60_000,
      logger: { warn: message => warnings.push(message) }
    })
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /missing/)
    const first = createProdServer({ staticRoot, visits: firstStore })
    servers.push(first)
    const base = await listen(first)
    const posted = await fetch(`${base}/api/visits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': browser, 'x-forwarded-for': '203.0.113.40' },
      body: JSON.stringify({ path: '/studio', referrer: '' })
    })
    assert.equal(posted.status, 200)
    assert.match(posted.headers.get('content-type'), /application\/json/)
    assert.deepEqual(await posted.json(), { counted: true, total: 1 })
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).total, 0)
    await firstStore.flush()
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).total, 1)
    assert.equal(existsSync(`${filePath}.${process.pid}.tmp`), false)
    const secondStore = createVisitStore({ filePath: visitCounterPath(), logger: quiet })
    assert.equal(secondStore.publicTotal().total, 1)
    assert.equal(secondStore.persistent(), true)
    const second = createProdServer({ staticRoot, visits: secondStore })
    servers.push(second)
    const restarted = await listen(second)
    assert.deepEqual(await (await fetch(`${restarted}/api/visits`)).json(), { total: 1 })
    const head = await fetch(`${restarted}/api/visits`, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
  } finally {
    await Promise.all(servers.map(server => close(server)))
    if (previous === undefined) delete process.env.COUNTER_FILE
    else process.env.COUNTER_FILE = previous
    rmSync(directory, { recursive: true, force: true })
    rmSync(staticRoot, { recursive: true, force: true })
  }
})

test('a corrupt counter file falls back to 0 without throwing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-counter-'))
  const filePath = join(directory, 'visits.json')
  try {
    writeFileSync(filePath, '{not json')
    const warnings = []
    const store = createVisitStore({ filePath, logger: { warn: message => warnings.push(message) } })
    assert.equal(store.publicTotal().total, 0)
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /unreadable/)
    assert.equal(store.record({ address: '203.0.113.41', userAgent: browser, path: '/' }).counted, true)
    await store.flush()
    assert.equal(warnings.length, 1)
    const restarted = createVisitStore({ filePath, logger: quiet })
    assert.equal(restarted.publicTotal().total, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('an unwritable counter path does not crash', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-counter-'))
  const blocker = join(directory, 'not-a-directory')
  writeFileSync(blocker, 'nope')
  const warnings = []
  try {
    const store = createVisitStore({
      filePath: join(blocker, 'visits.json'),
      logger: { warn: message => warnings.push(message) }
    })
    assert.equal(store.persistent(), false)
    assert.equal(store.publicTotal().total, 0)
    assert.equal(warnings.length, 1)
    assert.match(warnings[0], /cannot write/)
    assert.equal(store.record({ address: '203.0.113.42', userAgent: browser, path: '/faq' }).total, 1)
    await store.flush()
    assert.equal(store.publicTotal().total, 1)
    assert.equal(warnings.length, 1)
    assert.equal(existsSync(join(blocker, 'visits.json')), false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('shutdown flushes a debounced visit before exit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-counter-'))
  const filePath = join(directory, 'visits.json')
  try {
    const store = createVisitStore({ filePath, debounceMs: 60_000, logger: quiet })
    store.record({ address: '203.0.113.43', userAgent: browser, path: '/' })
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).total, 0)
    let exited = null
    const shutdown = createCounterShutdown(store, {
      close(callback) { callback() },
      exit(code) { exited = code }
    })
    await shutdown()
    assert.equal(exited, 0)
    await shutdown()
    assert.equal(exited, 0)
    const restarted = createVisitStore({ filePath, logger: quiet })
    assert.equal(restarted.publicTotal().total, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a visit is written on its own after the debounce', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-counter-'))
  const filePath = join(directory, 'visits.json')
  try {
    const store = createVisitStore({ filePath, debounceMs: 30, logger: quiet })
    const before = readFileSync(filePath, 'utf8')
    store.record({ address: '203.0.113.44', userAgent: browser, path: '/' })
    assert.equal(readFileSync(filePath, 'utf8'), before)
    const started = Date.now()
    while (JSON.parse(readFileSync(filePath, 'utf8')).total !== 1) {
      if (Date.now() - started > 2000) assert.fail('debounced counter write did not land')
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('production and npm start flush the counter file on shutdown', () => {
  const prod = readFileSync('server/prod-server.mjs', 'utf8')
  const visitServer = readFileSync('server/index.mjs', 'utf8')
  assert.match(prod, /visitCounterPath\(\)/)
  assert.match(prod, /createCounterShutdown/)
  assert.match(prod, /SIGTERM/)
  assert.match(prod, /SIGINT/)
  assert.match(visitServer, /visitCounterPath\(\)/)
  assert.match(visitServer, /createCounterShutdown/)
  assert.match(readFileSync('README.md', 'utf8'), /COUNTER_FILE/)
  assert.match(readFileSync('README.md', 'utf8'), /\/data/)
})

test('private stats require the environment token and the server never logs it', async () => {
  const token = 'stats-token-should-never-be-logged'
  const logs = []
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-static-'))
  const store = createVisitStore({ filePath: '' })
  const server = createVisitServer({ store, token, staticRoot: directory, logger: message => logs.push(message) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`
  const recorded = await fetch(`${base}/api/visits`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': browser, 'x-forwarded-for': '192.0.2.10' }, body: JSON.stringify({ path: '/', referrer: 'https://example.com/a?q=1' }) })
  assert.equal(recorded.headers.get('set-cookie'), null)
  assert.equal((await recorded.json()).total, 1)
  assert.equal((await (await fetch(`${base}/api/visits`)).json()).total, 1)
  assert.equal((await fetch(`${base}/api/stats`)).status, 404)
  assert.equal((await fetch(`${base}/api/stats`, { headers: { authorization: 'Bearer wrong-token' } })).status, 404)
  const stats = await fetch(`${base}/api/stats`, { headers: { authorization: `Bearer ${token}` } })
  const body = await stats.json()
  assert.equal(stats.status, 200)
  assert.equal(body.total, 1)
  assert.equal(body.referrers[0].host, 'example.com')
  assert.doesNotMatch(JSON.stringify(body), /192\.0\.2\.10|salt/)
  const page = await fetch(`${base}/stats`)
  assert.equal(page.status, 200)
  assert.doesNotMatch(await page.text(), new RegExp(token))
  assert.equal(logs.some(line => line.includes(token)), false)
  writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Moovicut</title>')
  const health = await fetch(`${base}/healthz`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).ok, true)
  const visit = await fetch(`${base}/api/visits`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': browser }, body: '{}' })
  assert.equal(visit.headers.get('content-type').includes('application/json'), true)
  assert.equal(typeof (await visit.json()).total, 'number')
  const missing = await fetch(`${base}/this-page-is-not-real`)
  assert.equal(missing.status, 404)
  assert.doesNotMatch(await missing.text(), /<title>Moovicut<\/title>/)
  server.close()
  rmSync(directory, { recursive: true, force: true })
})

test('the public footer shows the total and does not link to private stats', () => {
  const footer = readFileSync('app/components/SiteFooter.vue', 'utf8')
  const plugin = readFileSync('app/plugins/visits.client.js', 'utf8')
  const server = readFileSync('server/index.mjs', 'utf8')
  assert.match(readFileSync('app/config/social.js', 'utf8'), /SOCIAL_X_URL = 'https:\/\/x\.com\/davincc'/)
  assert.match(footer, /Follow on X \(it's free!\)/)
  assert.match(footer, /Follow on X \(it's free!\)<\/a><a href="https:\/\/github\.com\/Davincc77\/moovicut" target="_blank" rel="noopener" aria-label="Moovicut on GitHub">GitHub<\/a>/)
  assert.doesNotMatch(footer, /agent-links|llms\.txt|>English<|Contact on X/)
  assert.doesNotMatch(footer, new RegExp(['mail', 'to:'].join('') + '|' + ['@shot', 'board'].join('')))
  assert.match(footer, /target="_blank" rel="noopener"/)
  assert.match(readFileSync('app/components/StudioCreationPanel.vue', 'utf8'), /SOCIAL_X_URL[\s\S]*target="_blank" rel="noopener">Follow on X/)
  assert.match(footer, /visitLabel/)
  assert.match(footer, /visit' : 'visits'/)
  assert.doesNotMatch(footer, /\/stats|STATS_TOKEN/)
  assert.doesNotMatch(plugin, /STATS_TOKEN|document\.cookie/)
  assert.match(server, /process\.env\.STATS_TOKEN/)
  assert.doesNotMatch(server, /stats-token-should-never-be-logged/)
})
