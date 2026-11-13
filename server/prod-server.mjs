import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
}

const SECURITY = { 'x-content-type-options': 'nosniff' }

export function resolveStaticRoot(env = process.env, root = rootDir) {
  if (env.STATIC_ROOT) return resolve(env.STATIC_ROOT)
  const generated = join(root, '.output', 'public')
  if (existsSync(join(generated, 'index.html'))) return generated
  const dist = join(root, 'dist')
  if (existsSync(join(dist, 'index.html'))) return dist
  return generated
}

const LOCALES = new Set(['zh', 'ru', 'de', 'fr', 'ja', 'ko', 'es', 'pt', 'tr'])
const STUDIO_PATHS = new Set([
  '/dashboard/ai-video/home',
  '/pricing',
  '/profile',
  '/developers',
  '/login',
  '/signin',
  '/auth',
  '/auth/login',
  '/auth/signin',
  '/auth/callback',
  '/desktop'
])
const KEPT_PAGES = new Set(['privacy', 'terms', 'content-policy', 'faq', 'studio'])

function withoutTrailingSlash(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

export function legacyRedirectTarget(pathname, search = '') {
  let path = pathname || '/'
  let fromShotboard = false
  if (path === '/shotboard' || path === '/shotboard/') {
    path = '/'
    fromShotboard = true
  } else if (path.startsWith('/shotboard/')) {
    path = path.slice('/shotboard'.length) || '/'
    fromShotboard = true
  }
  const normalized = withoutTrailingSlash(path)
  let target = ''
  if (STUDIO_PATHS.has(normalized)) target = '/studio'
  else {
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length && LOCALES.has(parts[0])) {
      const rest = `/${parts.slice(1).join('/')}`
      if (parts.length === 1) target = '/'
      else if (STUDIO_PATHS.has(rest)) target = '/studio'
      else if (parts.length === 2 && KEPT_PAGES.has(parts[1])) target = `/${parts[1]}`
    }
  }
  if (!target && fromShotboard) target = normalized
  if (!target || (!fromShotboard && withoutTrailingSlash(pathname) === target)) return ''
  return `${target}${search || ''}`
}

export function legacyShotboardTarget(pathname, search = '') {
  return legacyRedirectTarget(pathname, search)
}

function insideRoot(root, candidate) {
  const file = resolve(candidate)
  if (file !== root && !file.startsWith(root + sep)) return ''
  if (existsSync(file) && statSync(file).isFile()) return file
  return ''
}

export function staticFile(staticRoot, urlPath) {
  let decoded
  try { decoded = decodeURIComponent(String(urlPath || '/').split('?')[0]) } catch { return '' }
  if (decoded.includes('\0')) return ''
  const relative = decoded.replace(/^\/+/, '')
  if (relative.split('/').includes('..')) return ''
  const root = resolve(staticRoot)
  const extension = extname(relative)
  const candidates = []
  if (relative) candidates.push(join(root, relative))
  if (!extension) {
    candidates.push(join(root, relative, 'index.html'))
    if (relative) candidates.push(join(root, `${relative}.html`))
  }
  for (const candidate of candidates) {
    const file = insideRoot(root, candidate)
    if (file) return file
  }
  return ''
}

function send(response, status, headers, body, method) {
  response.writeHead(status, headers)
  response.end(method === 'HEAD' ? undefined : body)
}

function cacheControl(file, root) {
  const relative = file.slice(root.length)
  if (relative.includes(`${sep}_nuxt${sep}`)) return 'public, max-age=31536000, immutable'
  if (extname(file) === '.html') return 'no-cache'
  return 'public, max-age=3600'
}

export function createProdServer({ staticRoot, logger = () => {} } = {}) {
  const root = resolve(staticRoot)
  return createServer((request, response) => {
    let url
    try { url = new URL(request.url || '/', 'http://localhost') } catch {
      send(response, 400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...SECURITY }, 'Bad request', request.method)
      return
    }
    const { pathname, search } = url
    logger(`${request.method} ${pathname}`)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD', 'cache-control': 'no-store', ...SECURITY }, 'Method not allowed', request.method)
      return
    }
    if (pathname === '/healthz') {
      send(response, 200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...SECURITY }, 'ok', request.method)
      return
    }
    const redirect = legacyRedirectTarget(pathname, search)
    if (redirect) {
      send(response, 301, { location: redirect, 'cache-control': 'no-store', ...SECURITY }, '', request.method)
      return
    }
    let file = staticFile(root, pathname)
    if (!file) {
      const extension = extname(pathname)
      if (pathname.startsWith('/_nuxt/') || (extension && extension !== '.html')) {
        send(response, 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache', ...SECURITY }, 'Not found', request.method)
        return
      }
      file = staticFile(root, '/200.html') || staticFile(root, '/index.html')
    }
    if (!file) {
      send(response, 404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache', ...SECURITY }, 'Not found', request.method)
      return
    }
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream'
    response.writeHead(200, { 'content-type': type, 'cache-control': cacheControl(file, root), ...SECURITY })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const stream = createReadStream(file)
    stream.on('error', () => {
      if (!response.headersSent) response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY })
      response.end()
    })
    stream.pipe(response)
  })
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const staticRoot = resolveStaticRoot()
  const server = createProdServer({ staticRoot })
  const port = Number(process.env.PORT || 3000)
  server.listen(port, () => {
    console.log(`Moovicut listening on ${port}, serving ${staticRoot}`)
  })
}
