/** Print cold-start, one-request latency, and heap when the local NER weights load. */
import { verifyCandidates, setVerifierEnabled } from '../app/utils/ner-verifier.js'

const text = 'Hope waits in the kitchen. That night, Hope waits in the garden.'
const people = [{ name: 'Hope' }]
const places = [{ name: 'Kitchen' }, { name: 'Garden' }]
setVerifierEnabled(true)
const before = process.memoryUsage().heapUsed
const cold = await verifyCandidates(text, people, places, { enabled: true })
const warm = await verifyCandidates(text, people, places, { enabled: true })
const after = process.memoryUsage().heapUsed
console.log(JSON.stringify({
  coldMs: cold.ms,
  warmMs: warm.ms,
  used: cold.used,
  fallback: cold.fallback || false,
  reason: cold.reason || '',
  heapBeforeMb: Math.round(before / 1048576),
  heapAfterMb: Math.round(after / 1048576)
}, null, 2))
