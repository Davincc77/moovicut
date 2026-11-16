/**
 * Rebuild app/data/place-lexicon.json.
 *
 *   WORDNET_TAR=/tmp/wn.tar.gz OMW_ZIP=/tmp/omw.zip ODENET_XML=/tmp/odenet.xml \
 *     node scripts/build-place-lexicon.mjs
 *
 * Sources and licences: docs/place-library.md
 */
import { execFileSync } from 'node:child_process'

execFileSync('python3', ['scripts/build-place-lexicon.py'], { stdio: 'inherit' })
