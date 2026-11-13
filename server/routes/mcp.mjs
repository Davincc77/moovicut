import { serveAgent, MCP_BODY_LIMIT } from '../agent-nitro.mjs'

export default defineEventHandler(event => serveAgent(event, MCP_BODY_LIMIT))
