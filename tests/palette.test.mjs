import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PALETTE = new Set([
  '0a0a0a', '0f0f0f', '141414', '1b1b1b', 'eae7df', '9a9486',
  'f0b429', 'f6c85a', '1a1408', 'ef4444', '000000', 'ffffff'
])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.output' || name === '.nuxt') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, files)
    else if (/\.(css|vue)$/.test(path)) files.push(path)
  }
  return files
}

function rgb(hex) {
  let body = hex.slice(1).toLowerCase()
  if (body.length === 3 || body.length === 4) body = [...body].map(char => char + char).join('')
  if (body.length === 8) body = body.slice(0, 6)
  return body
}

test('CSS and Vue colours stay inside the token palette', () => {
  const files = [...new Set([...walk('app'), 'app.vue'])]
  const offenders = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g)) {
      if (!PALETTE.has(rgb(match[0]))) offenders.push(`${file} ${match[0]}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('form controls that used to be browser-grey use the palette tokens', () => {
  const css = readFileSync('app/assets/css/main.css', 'utf8')
  const rules = [
    ['.studio-step-actions button', /background:\s*var\(--surface\)/, /color:\s*var\(--text\)/, /border:\s*1px solid var\(--border\)/],
    ['.library-open', /background:\s*var\(--surface\)/, /color:\s*var\(--text\)/, /border:\s*1px solid var\(--border\)/],
    ['dialog.confirm-dialog button', /background:\s*var\(--surface\)/, /color:\s*var\(--text\)/, /border:\s*1px solid var\(--border\)/],
    ['.copy-prompt-button', /background:\s*var\(--surface\)/, /color:\s*var\(--text\)/, /border:\s*1px solid var\(--border\)/],
    ['.studio-sequence-mode :is(input, textarea, select)', /background:\s*var\(--bg\)/, /color:\s*var\(--text\)/, /border:\s*1px solid var\(--border\)/],
    ['.studio-scenario textarea', /background:\s*var\(--bg\)/, /color:\s*var\(--text\)/, /border:\s*1px solid var\(--border\)/]
  ]
  for (const [selector, background, color, border] of rules) {
    const start = css.indexOf(selector)
    assert.ok(start >= 0, `${selector} is missing`)
    const body = css.slice(start, css.indexOf('}', start))
    assert.match(body, background, selector)
    assert.match(body, color, selector)
    assert.match(body, border, selector)
    assert.doesNotMatch(body, /buttonface|canvastext|graytext|#808080|#d3d3d3/i, selector)
  }
})

test('colour tokens are defined on :root', () => {
  const css = readFileSync('app/assets/css/main.css', 'utf8')
  assert.match(css, /:root \{[^}]*--bg:#0a0a0a/)
  assert.match(css, /:root \{[^}]*--gold:#f0b429/)
  assert.match(css, /:root \{[^}]*--on-gold:#1a1408/)
  assert.match(css, /:root \{[^}]*--error:#ef4444/)
  assert.match(css, /:root \{[^}]*--display:/)
})
