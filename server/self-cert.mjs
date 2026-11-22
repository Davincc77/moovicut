/** Self-certification : chaque réponse de succès porte sha256 = hash de sa forme canonique sans sha256.
 *  La forme canonique trie les clés à chaque niveau, conserve l'ordre des tableaux, encode en UTF-8.
 *  Un client recalcule : parse -> copie sans sha256 -> canonicalJson -> sha256 hex -> compare. */
import { createHash } from 'node:crypto'

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function selfSha(payload) {
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')
}

/** Le sha porte sur le CONTENU : le contenu est déterministe, pas l'enveloppe.
 *  Ces clés top-level volatiles sont exclues du canonique (documenté dans le manifest). */
export const VOLATILE_KEYS = ['id', 'createdAt', 'updatedAt']

export function withoutVolatile(payload) {
  const copy = { ...payload }
  for (const key of VOLATILE_KEYS) delete copy[key]
  return copy
}

/** Ajoute le champ sha256 au payload de succès (content-addressed, métadonnées exclues). */
export function withSelfSha(payload) {
  return { ...payload, sha256: selfSha(withoutVolatile(payload)) }
}
