import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DYNAMIC_KEYS } from './dynamic-keys.js'
import { WIZARD_STRINGS } from '../utils/wizard-strings.js'

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, files)
    else if (/\.(vue|js|mjs|ts)$/.test(path) && !path.includes(`${join('i18n', 'locales')}`)) files.push(path)
  }
  return files
}

function unescape(value) {
  return value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
}

/** Every catalog key the interface asks for. English text is the key. */
export function collectKeys(root = 'app') {
  const keys = new Set([...DYNAMIC_KEYS, ...Object.values(WIZARD_STRINGS)])
  const call = /(?:\$th|\$t|\bt)\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1/g
  for (const file of walk(root)) {
    if (file.endsWith('collect-keys.js') || file.endsWith('dynamic-keys.js') || file.endsWith('logic.js')) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(call)) keys.add(unescape(match[2]))
  }
  const field = /(?:premise|name|detail|text|alt|caption|title|genre|intro)\s*:\s*'((?:\\'|[^'])*)'/g
  for (const file of ['app/pages/index.vue', 'app/utils/reference-content.js']) {
    const source = readFileSync(file, 'utf8')
    const pattern = file.endsWith('reference-content.js')
      ? /(?:title|genre|alt|caption)\s*:\s*'((?:\\'|[^'])*)'/g
      : field
    for (const match of source.matchAll(pattern)) {
      if (file.endsWith('reference-content.js') && match[0].startsWith('premise')) continue
      keys.add(unescape(match[1]))
    }
  }
  for (const file of ['app/pages/faq.vue', 'app/pages/index.vue', 'app/pages/[slug].vue', 'app/pages/credits.vue']) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\[\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*\]/g)) {
      keys.add(unescape(match[1]))
      keys.add(unescape(match[2]))
    }
  }
  for (const file of walk(root)) {
    if (!/\/(components|pages|composables|plugins)\//.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/notify\(\s*'((?:\\'|[^'])*)'/g)) keys.add(unescape(match[1]))
    for (const match of source.matchAll(/uploadError\.value\s*=\s*'((?:\\'|[^'])*)'/g)) keys.add(unescape(match[1]))
    for (const match of source.matchAll(/\|\|\s*'((?:\\'|[^'])*)'/g)) keys.add(unescape(match[1]))
    for (const match of source.matchAll(/throw new Error\(\s*'((?:\\'|[^'])*)'/g)) keys.add(unescape(match[1]))
  }
  const agents = readFileSync('app/pages/agents.vue', 'utf8')
  for (const match of agents.matchAll(/const copy\d+ = `([\s\S]*?)`/g)) keys.add(match[1])
  const skip = new Set(['/', '[]', '{}', 'en', 'null', 'jpg', 'webp', ...Object.keys(WIZARD_STRINGS)])
  return [...keys].filter(key => {
    if (!key || skip.has(key) || key.includes('{{') || key.includes('</label>')) return false
    if (/=>|\bfunction\b|\bconst\b|\breturn\b|\bmutate\(/.test(key)) return false
    return true
  }).sort()
}
