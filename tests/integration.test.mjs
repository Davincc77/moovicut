import test from 'node:test'
import assert from 'node:assert/strict'
import { joinAppPath } from '../app/utils/urls.js'
import { createModelRegistry } from '../app/integrations/models/model-registry.js'
import { MODEL_IDS } from '../app/utils/prompt-engine.js'
import { readFileSync } from 'node:fs'
import { parse, walkSync, ELEMENT_NODE } from 'ultrahtml'

test('application routes remain inside a configurable mount', () => {
  assert.equal(joinAppPath('/', 'pricing'), '/pricing')
  assert.equal(joinAppPath('/shotboard/', '/auth/callback'), '/shotboard/auth/callback')
  assert.equal(joinAppPath('/shotboard/', '/pricing'), '/shotboard/pricing')
})

test('model selectors and formatters come from a replaceable adapter registry', () => {
  const adapter = { id: 'custom', label: 'Custom model', note: 'Host supplied', mark: 'C', markClass: 'custom-glyph', compose: () => 'custom prompt' }
  const registry = createModelRegistry([adapter])
  assert.deepEqual(registry.ids, ['custom'])
  assert.equal(registry.options[0].label, 'Custom model')
  assert.equal(registry.get('custom').compose(), 'custom prompt')
  assert.deepEqual(MODEL_IDS, ['grok', 'google'])
})

test('the restored creation form generates one editable storyboard per submit', () => {
  const studio = readFileSync('app/pages/studio.vue', 'utf8')
  assert.doesNotMatch(studio, /useAssetUrls/)
  const creation = readFileSync('app/components/StudioCreationPanel.vue', 'utf8')
  assert.match(studio, /<StudioCreationPanel \/>/)
  assert.match(creation, /<form[^>]*@submit\.prevent="createStoryboard"/)
  assert.match(creation, /<form class="studio-create-form"[\s\S]*<\/form><\/div>[\s\S]*<form class="studio-bottom-composer"/)
  const template = creation.match(/<template>([\s\S]*)<\/template>/)[1]
  const forms = []
  walkSync(parse(template), node => {
    if (node.type === ELEMENT_NODE && node.name === 'form') forms.push(node)
  })
  assert.equal(forms.length, 2)
  for (const name of ['studio-create-form', 'studio-bottom-composer']) {
    const form = forms.find(item => item.attributes.class === name)
    assert.ok(form, name)
    assert.match(form.attributes['@submit.prevent'], /createStoryboard/)
  }
  assert.equal(forms.filter(form => form.parent?.name === 'form').length, 0, 'Forms remain siblings rather than nested')
  assert.match(creation, /function createStoryboard\(\)\{[\s\S]*store\.createNew\(premise\.value,model\.value/)
  assert.match(readFileSync('server/prod-server.mjs', 'utf8'), /legacyRedirectTarget/)
  assert.doesNotMatch(readFileSync('app/components/AppHeader.vue', 'utf8'), /\/dashboard\/ai-video\/home/)
})

test('favicon is joined to the configured mount rather than the nested document', () => {
  const config = readFileSync('nuxt.config.ts', 'utf8')
  assert.match(config, /href: joinAppPath\(baseURL, '\/favicon\.svg'\)/)
  assert.doesNotMatch(config, /href: '\.\/favicon\.svg'/)
})
