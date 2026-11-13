import { serveAgent } from '../../agent-nitro.mjs'

export default defineEventHandler(event => serveAgent(event))
