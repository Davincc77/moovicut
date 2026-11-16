import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { CJK_NAME_TIPS, cjkNameTip } from '../app/utils/cjk-name-tip.js'

function page(locale) {
  const text = cjkNameTip(locale)
  return createSSRApp({
    setup() {
      return () => h('div', [
        h('textarea', { id: 'studio-idea' }),
        text ? h('p', { class: 'studio-soft-hint', 'data-cjk-name-tip': '' }, text) : '',
        h('p', 'after')
      ])
    }
  })
}

test('the name-detection tip renders in Simplified Chinese and not in English or Japanese', async () => {
  const ja = await renderToString(page('ja'))
  const zh = await renderToString(page('zh-Hans'))
  const en = await renderToString(page('en'))
  const bare = await renderToString(createSSRApp({
    setup() {
      return () => h('div', [h('textarea', { id: 'studio-idea' }), h('p', 'after')])
    }
  }))
  assert.equal(cjkNameTip('en'), '')
  assert.equal(cjkNameTip('fr'), '')
  assert.equal(cjkNameTip('ja'), '')
  assert.equal(cjkNameTip('it'), '')
  assert.equal(CJK_NAME_TIPS.ja, undefined)
  assert.equal(cjkNameTip('zh-Hans'), CJK_NAME_TIPS['zh-Hans'])
  assert.equal(ja.includes('data-cjk-name-tip'), false)
  assert.ok(zh.includes(`data-cjk-name-tip>${CJK_NAME_TIPS['zh-Hans']}</p>`))
  assert.equal(en.includes('data-cjk-name-tip'), false)
  assert.equal(en, bare)
  for (const file of [
    'app/components/StudioWizard.vue',
    'app/components/StudioCreationPanel.vue',
    'app/components/StudioScenario.vue'
  ]) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /<CjkNameTip\b/)
  }
  const wizard = readFileSync('app/components/StudioWizard.vue', 'utf8')
  assert.ok(wizard.indexOf('id="wizard-idea"') < wizard.indexOf('<CjkNameTip'))
  const creation = readFileSync('app/components/StudioCreationPanel.vue', 'utf8')
  assert.ok(creation.indexOf('id="studio-idea"') < creation.indexOf('<CjkNameTip'))
  const scenario = readFileSync('app/components/StudioScenario.vue', 'utf8')
  assert.ok(scenario.indexOf('v-model="prose"') < scenario.indexOf('<CjkNameTip'))
  assert.match(readFileSync('app/components/CjkNameTip.vue', 'utf8'), /if \(!text\) return ''/)
  assert.match(readFileSync('app/components/CjkNameTip.vue', 'utf8'), /cjkNameTip\(props\.locale\)/)
})
