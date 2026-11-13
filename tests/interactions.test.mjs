import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { ref } from 'vue'
import { SCENE_STUDIES } from '../app/utils/prompt-engine.js'
import { STUDIO_INSPIRATIONS, EXTERNAL_MODEL_DIRECTORY } from '../app/utils/reference-content.js'
import { toggleDisclosure, toggleFlag } from '../app/composables/useDisclosure.js'

test('FAQ buttons and header controls compile against canonical bindings', () => {
  for (const file of ['app/pages/index.vue', 'app/pages/studio.vue', 'app/pages/faq.vue', 'app/components/FaqDisclosure.vue', 'app/components/AppHeader.vue']) {
    const source = readFileSync(file, 'utf8')
    const { descriptor } = parse(source, { filename: file })
    const script = compileScript(descriptor, { id: 'control' })
    const result = compileTemplate({ id: 'control', filename: file, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } })
    assert.equal(result.errors.length, 0)
    if (file === 'app/pages/faq.vue') continue
    assert.ok(result.code.includes('onClick') || result.code.includes('onClick:'), file)
  }
  const source = readFileSync('app/pages/index.vue', 'utf8')
  const script = compileScript(parse(source, { filename: 'index.vue' }).descriptor, { id: 'landing' })
  for (const binding of ['store', 'appBaseURL', 'SCENE_STUDIES']) assert.ok(script.bindings[binding], `${binding} must be explicitly bound for the compiled template`)
  assert.match(source, /'What is Moovicut\?'/)
  assert.match(source, /<FaqDisclosure v-for="\[question,answer\] in faqs"/)
  const disclosure = readFileSync('app/components/FaqDisclosure.vue', 'utf8')
  assert.match(disclosure, /<h3 class="faq-question"><button[^>]+:aria-expanded="open"[^>]+:aria-controls="answerId"/)
  assert.match(disclosure, /<div v-show="open" :id="answerId"[^>]+role="region"[^>]+:aria-labelledby="questionId"/)
  assert.match(readFileSync('app/components/SupportLink.vue', 'utf8'), /href="https:\/\/buymeacoffee.com\/enzoc1977r" target="_blank" rel="noopener"/)
  assert.match(source, /<h1 id="hero-title">Plan a storyboard<\/h1>/)
  assert.match(source, /v-for="example in examples"/)
  const css = readFileSync('app/assets/css/main.css', 'utf8')
  assert.match(css, /\.faq-question > button/)
  assert.match(css, /\.faq-item\.open \.faq-question > button svg/)
  assert.doesNotMatch(readFileSync('app/components/AppHeader.vue', 'utf8'), /LanguagePicker/)
  assert.match(readFileSync('app/components/AppHeader.vue', 'utf8'), /aria-label="Mobile navigation"/)
  const language = ref(false)
  toggleFlag(language)
  assert.equal(language.value, true)
  toggleFlag(language)
  assert.equal(language.value, false)
  const faq = ref(null)
  toggleDisclosure(faq, 2)
  assert.equal(faq.value, 2)
  toggleDisclosure(faq, 2)
  assert.equal(faq.value, null)
  assert.match(readFileSync('app/utils/prompt-engine.js', 'utf8'), /Is an account required\?/)
  assert.doesNotMatch(readFileSync('public/faq.md', 'utf8'), /Profile page|affiliated with/)
  assert.match(readFileSync('app/components/SiteFooter.vue', 'utf8'), /not affiliated with/)
})

test('saved project library uses the array-returning public property', () => {
  const source = readFileSync('app/composables/useProjectStore.js', 'utf8')
  assert.match(source, /Object\.defineProperty\(api, 'savedProjects'/)
  assert.match(source, /get: \(\) => savedProjects\.value/)
  assert.match(source, /Array\.isArray\(libraryState\.value\)/)
})

test('the eight named scene studies remain available to home and CLI', () => {
  assert.deepEqual(SCENE_STUDIES, ['Snow Fight', 'Dragon Chase', 'The Lab', 'The Climb', 'Mech Reveal', 'Solo Corridor', 'Machine Room', 'High Country'])
})
