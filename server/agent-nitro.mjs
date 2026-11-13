import { getRequestHeaders, getRequestIP, getRequestURL, readRawBody, setResponseHeader, setResponseStatus } from 'h3'
import { createRateLimiter, dispatchAgentRequest, publicOrigin, clientAddress, STORYBOARD_BODY_LIMIT, MCP_BODY_LIMIT } from './agent-api.mjs'

const limiter = createRateLimiter()

export async function serveAgent(event, limit = STORYBOARD_BODY_LIMIT) {
  const url = getRequestURL(event)
  const method = event.method
  const headers = getRequestHeaders(event)
  let body = ''
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    body = await readRawBody(event, 'utf8') || ''
    if (Buffer.byteLength(body) > limit) {
      setResponseStatus(event, 413)
      setResponseHeader(event, 'content-type', 'application/json; charset=utf-8')
      return { error: 'payload_too_large', message: 'The request body is too large.' }
    }
  }
  const result = dispatchAgentRequest({
    method,
    pathname: url.pathname,
    searchParams: url.searchParams,
    headers,
    body,
    origin: publicOrigin(headers, url.origin),
    limiter,
    ip: clientAddress(headers, getRequestIP(event) || '')
  })
  setResponseStatus(event, result?.status || 404)
  for (const [key, value] of Object.entries(result?.headers || {})) setResponseHeader(event, key, value)
  if (!result?.body || method === 'HEAD' || result.status === 204) return null
  return JSON.parse(result.body)
}

export { MCP_BODY_LIMIT }
