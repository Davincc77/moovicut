/** Join a route onto the configured site mount. */
export function joinAppPath(baseURL = '/', route = '') {
  const base = `/${String(baseURL).replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')
  return `${base}${String(route).replace(/^\/+/, '')}`
}
