/**
 * Rebuild app/data/place-lexicon.json from Princeton WordNet 3.0.
 *
 *   curl -fsSL -o /tmp/wn.tar.gz https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz
 *   WORDNET_TAR=/tmp/wn.tar.gz node scripts/build-place-lexicon.mjs
 *
 * WordNet licence: https://wordnet.princeton.edu/license-and-commercial-use
 * The script walks noun hyponyms of building, room, structure, facility,
 * workplace, housing, way, road, geographical area, body of water, and land.
 *
 * Optional later sources, not required for this build:
 * - Open Multilingual Wordnet (same synset offsets, other languages)
 * - OdeNet (German WordNet), CC-BY-SA
 * - Wikidata labels for subclasses of architectural structure Q811979
 *   and geographic feature types, CC0
 * When those files are passed as ODENET_JSON or WIKIDATA_JSON (arrays of strings),
 * their lemmas are merged in.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const tarPath = process.env.WORDNET_TAR
if (!tarPath) {
  console.error('Set WORDNET_TAR to WNdb-3.0.tar.gz')
  process.exit(1)
}
const script = `
import json, os, tarfile
from collections import defaultdict
tar = tarfile.open(os.environ['WORDNET_TAR'])
lines = tar.extractfile('dict/data.noun').read().decode('latin1').splitlines()
syn, children = {}, defaultdict(list)
for line in lines:
    if not line or line.startswith('  '):
        continue
    parts = line.split()
    if len(parts) < 6 or parts[2] != 'n':
        continue
    offset, wcnt = parts[0], int(parts[3], 16)
    words, i = [], 4
    for _ in range(wcnt):
        words.append(parts[i].replace('_', ' '))
        i += 2
    pcnt = int(parts[i]); i += 1
    for _ in range(pcnt):
        if parts[i] == '@':
            children[parts[i+1]].append(offset)
        i += 4
    syn[offset] = words
want = {'building','room','structure','geographical area','body of water','land','facility','workplace','housing','way','road'}
roots = [off for off, words in syn.items() if any(w.lower() in want for w in words)]
seen, stack = set(), list(roots)
while stack:
    off = stack.pop()
    if off in seen: continue
    seen.add(off)
    stack.extend(children.get(off, []))
lemmas = set()
for off in seen:
    for word in syn.get(off, []):
        if word.replace(' ', '').replace('-', '').isalpha() and 3 <= len(word) <= 40:
            lemmas.add(word.lower())
for word in ['quay','pier','wharf','cafe','rink','boathouse']:
    lemmas.add(word)
print(json.dumps(sorted(lemmas)))
`
const raw = execFileSync('python3', ['-c', script], { env: { ...process.env, WORDNET_TAR: tarPath }, encoding: 'utf8' })
const lemmas = JSON.parse(raw)
for (const file of [process.env.ODENET_JSON, process.env.WIKIDATA_JSON]) {
  if (!file) continue
  const more = JSON.parse(readFileSync(file, 'utf8'))
  if (Array.isArray(more)) more.forEach(item => lemmas.push(String(item).toLowerCase()))
}
const payload = {
  name: 'moovicut-place-lexicon',
  builtFrom: 'Princeton WordNet 3.0 noun hyponyms of building, room, structure, facility, workplace, housing, way, road, geographical area, body of water, and land. British spellings quay, pier, wharf, cafe, rink, and boathouse are included from the same database when the hypernym walk missed them.',
  license: 'WordNet License: https://wordnet.princeton.edu/license-and-commercial-use',
  attribution: 'Princeton University WordNet. OdeNet (CC-BY-SA) and Wikidata labels (CC0) for architectural structure Q811979 and geographic features can be merged by setting ODENET_JSON or WIKIDATA_JSON to a JSON array of strings. This build used WordNet only.',
  lemmas
}
writeFileSync(new URL('../app/data/place-lexicon.json', import.meta.url), JSON.stringify(payload, null, 2) + '\n')
console.log(`wrote ${lemmas.length} lemmas`)
