import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCounterShutdown, createVisitStore, normalizePath, tokensMatch, visitCounterPath } from './visits.mjs'
import { legacyRedirectTarget } from './prod-server.mjs'
import { createRateLimiter, handleAgentHttp, isAgentPath, isLimitedPath, publicOrigin, clientAddress } from './agent-api.mjs'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
}

function appBase(value = '/') {
  const trimmed = `/${String(value || '/').replace(/^\/+|\/+$/g, '')}`
  return trimmed === '/' ? '/' : trimmed
}

function stripBase(urlPath, base) {
  if (base !== '/' && (urlPath === base || urlPath.startsWith(`${base}/`))) return urlPath.slice(base.length) || '/'
  return urlPath
}

function withBase(base, location) {
  if (base === '/') return location
  const queryAt = location.indexOf('?')
  const path = queryAt === -1 ? location : location.slice(0, queryAt)
  const search = queryAt === -1 ? '' : location.slice(queryAt)
  const joined = path === '/' ? base : `${base}${path}`
  return `${joined}${search}`
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > 1024) {
        reject(new Error('too_large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function staticFile(staticRoot, urlPath) {
  const relative = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '')
  if (relative.split('/').includes('..')) return ''
  const base = resolve(staticRoot)
  for (const candidate of [join(base, relative), join(base, relative, 'index.html')]) {
    const file = resolve(candidate)
    if (file !== base && !file.startsWith(base + sep)) continue
    if (existsSync(file) && statSync(file).isFile()) return file
  }
  return ''
}

export function statsPage(base) {
  const api = `${base === '/' ? '' : base}/api/stats`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Visit stats — Moovicut</title>
<style>
  body { margin:0; background:#0a0a0a; color:#eae7df; font:16px/1.5 "IBM Plex Sans",Inter,sans-serif; }
  main { max-width:880px; margin:0 auto; padding:48px 20px 72px; }
  h1 { font:600 32px/1.2 "Space Grotesk",Inter,sans-serif; }
  p, li { color:#9a9486; }
  form { display:flex; gap:8px; flex-wrap:wrap; margin:24px 0; }
  input { min-width:240px; flex:1; padding:10px 12px; border:1px solid #eae7df1f; border-radius:8px; background:#141414; color:#eae7df; }
  button { padding:10px 16px; border:0; border-radius:8px; background:#d4a054; color:#181818; font-weight:600; }
  table { width:100%; border-collapse:collapse; margin:0 0 28px; }
  th, td { padding:8px 10px; border-bottom:1px solid #eae7df1f; text-align:left; }
  .error { color:#ef4444; }
</style>
</head>
<body>
<main>
  <h1>Visit stats</h1>
  <p>Daily page views, unique visitors, top pages, and referrer hosts. This page is not linked from the site.</p>
  <form id="unlock">
    <input id="token" type="password" autocomplete="current-password" aria-label="Stats token" placeholder="Stats token">
    <button type="submit">Show stats</button>
  </form>
  <p id="status" role="status"></p>
  <div id="report"></div>
</main>
<script>
  const status = document.querySelector('#status')
  const report = document.querySelector('#report')
  document.querySelector('#unlock').addEventListener('submit', async (event) => {
    event.preventDefault()
    const token = document.querySelector('#token').value
    status.textContent = 'Loading stats.'
    report.textContent = ''
    try {
      const response = await fetch(${JSON.stringify(api)}, { headers: { authorization: 'Bearer ' + token }, credentials: 'omit' })
      if (!response.ok) { status.textContent = 'Stats are unavailable.'; return }
      const data = await response.json()
      status.textContent = data.persistent ? 'Stored on the server disk.' : 'Stored in memory for this process only.'
      report.innerHTML = section('Days', data.days, ['date','views','uniques']) + section('Pages', data.pages, ['path','views','uniques']) + section('Referrers', data.referrers, ['host','views'])
    } catch {
      status.textContent = 'Stats are unavailable.'
    }
  })
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]))
  }
  function section(title, rows, keys) {
    const body = (rows || []).map(row => '<tr>' + keys.map(key => '<td>' + escapeHtml(row[key]) + '</td>').join('') + '</tr>').join('')
    return '<h2>' + escapeHtml(title) + '</h2><table><thead><tr>' + keys.map(key => '<th>' + escapeHtml(key) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>'
  }
</script>
</body>
</html>`
}

export function createVisitServer({ store, token = '', staticRoot = join(rootDir, 'dist'), baseURL = '/', logger = () => {}, limiter = createRateLimiter() } = {}) {
  const base = appBase(baseURL)
  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost')
    const route = stripBase(url.pathname, base)
    logger(`${request.method} ${route}`)
    try {
      if (isLimitedPath(route) && request.method !== 'OPTIONS' && !limiter.allow(clientAddress(request.headers, request.socket?.remoteAddress))) {
        sendJson(response, 429, { error: 'rate_limited', message: 'Too many requests from this address. Try again in a minute.' })
        return
      }
      if (isAgentPath(route)) {
        await handleAgentHttp(request, response, { pathname: route, searchParams: url.searchParams, origin: publicOrigin(request.headers), limiter: { allow: () => true } })
        return
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        const redirect = legacyRedirectTarget(route, url.search)
        if (redirect) {
          response.writeHead(301, {
            location: withBase(base, redirect),
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff'
          })
          response.end()
          return
        }
      }
      if (request.method === 'GET' && (route === '/healthz' || url.pathname === '/healthz')) {
        sendJson(response, 200, { ok: true })
        return
      }
      if (request.method === 'GET' && route === '/stats') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' })
        response.end(statsPage(base))
        return
      }
      if (route === '/api/visits' && request.method === 'GET') {
        sendJson(response, 200, store.publicTotal())
        return
      }
      if (route === '/api/visits' && request.method === 'POST') {
        let payload = {}
        try { payload = JSON.parse(await readBody(request) || '{}') } catch { sendJson(response, 400, { error: 'invalid_json' }); return }
        const result = store.record({
          address: clientAddress(request.headers, request.socket?.remoteAddress),
          userAgent: request.headers['user-agent'] || '',
          path: payload.path,
          referrer: payload.referrer,
          purpose: `${request.headers.purpose || ''} ${request.headers['sec-purpose'] || ''}`
        })
        sendJson(response, 200, result)
        return
      }
      if (route === '/api/stats' && request.method === 'GET') {
        const header = String(request.headers.authorization || '')
        const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
        if (!tokensMatch(provided, token)) {
          sendJson(response, 404, { error: 'not_found' })
          return
        }
        sendJson(response, 200, store.stats())
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 404, { error: 'not_found' })
        return
      }
      const file = staticFile(staticRoot, route)
      if (!file) {
        const missing = staticFile(staticRoot, '/404.html')
        response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
        if (missing) createReadStream(missing).pipe(response)
        else response.end('Not found')
        return
      }
      const type = TYPES[file.slice(file.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream'
      const cached = file.includes(`${sep}_nuxt${sep}`)
        ? 'public, max-age=31536000, immutable'
        : (file.includes(`${sep}media${sep}`) || file.includes(`${sep}brand${sep}`) ? 'public, max-age=2592000' : 'no-cache')
      response.writeHead(200, { 'content-type': type, 'cache-control': cached })
      if (request.method === 'HEAD') response.end()
      else createReadStream(file).pipe(response)
    } catch {
      if (!response.headersSent) sendJson(response, 500, { error: 'unavailable' })
    }
  })
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const token = process.env.STATS_TOKEN || ''
  const filePath = visitCounterPath()
  const store = createVisitStore({ filePath })
  const server = createVisitServer({
    store,
    token,
    staticRoot: process.env.STATIC_ROOT || join(rootDir, 'dist'),
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  })
  const shutdown = createCounterShutdown(store, { close: callback => server.close(callback) })
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  const port = Number(process.env.PORT || 3000)
  server.listen(port, () => {
    console.log(`Moovicut listening on ${port}. Visit storage: ${store.persistent() ? filePath : 'memory until the /data volume is mounted'}. Private stats: ${token ? 'enabled' : 'disabled until STATS_TOKEN is set'}.`)
  })
}
