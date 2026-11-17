import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { downloadBody } from '../app/composables/useNotifier.js'
import { legacyRedirectTarget } from '../server/prod-server.mjs'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { createStoryboard } from '../app/utils/prompt-engine.js'
import {
  blankWizard,
  setIdea,
  setModel,
  setPromptStyle,
  setAspect,
  setStyle,
  setGenre,
  setLight,
  setMood,
  setCharacterField,
  addCharacter,
  setPlaceField,
  setShotField,
  toggleShotCharacter,
  addWizardShot,
  setNoCharacter,
  setShotNoCharacter,
  gapsFor,
  gapFieldId,
  revealGap,
  canGenerate,
  projectFromWizard
} from '../app/utils/wizard.js'

const source = path => readFileSync(path, 'utf8')

function post(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function landscapeBoard() {
  let state = setAspect(setPromptStyle(setModel(setIdea(blankWizard(), 'Fog rolls across an empty city street at dusk.'), 'grok'), 'short'), '16:9')
  state = setNoCharacter(state, true)
  state = setGenre(setStyle(state, 'cinema'), 'drama')
  state = setMood(setLight(state, 'dusk'), 'quiet')
  const place = state.places[0].id
  state = setPlaceField(state, place, 'name', 'Empty city')
  state = setPlaceField(state, place, 'description', 'a wide empty street')
  const shot = state.shots[0].id
  state = setShotField(state, shot, 'placeId', place)
  state = setShotField(state, shot, 'action', 'Fog rolls across the empty street')
  state = setShotField(state, shot, 'framing', 'wide')
  return state
}

test('download text unwraps a ref and never writes [object Object]', () => {
  assert.equal(downloadBody('{"title":"City"}'), '{"title":"City"}')
  assert.equal(downloadBody({ value: '{"title":"City"}' }), '{"title":"City"}')
  const json = downloadBody({ value: { title: 'City', shots: [{ order: 1 }] } })
  assert.equal(json.includes('[object Object]'), false)
  assert.equal(JSON.parse(json).title, 'City')
  assert.match(source('app/pages/studio.vue'), /downloadBody\(store\.serialized\)/)
  assert.match(source('app/components/StudioEditor.vue'), /downloadBody\(store\.serialized\)/)
  assert.match(source('app/components/StudioCreationPanel.vue'), /downloadBody\(store\.serialized\)/)
  assert.doesNotMatch(source('app/pages/studio.vue'), /downloadText\([^)]*store\.serialized\)/)
  assert.doesNotMatch(source('app/components/StudioEditor.vue'), /downloadText\([^)]*store\.serialized\)/)
})

test('the library modal is an opaque studio dialog and can close', () => {
  const modal = source('app/components/AppModal.vue')
  const css = source('app/assets/css/main.css')
  assert.match(modal, /class="modal-panel"/)
  assert.match(modal, /'studio-dialog':onStudio/)
  assert.match(modal, /\/studio/)
  assert.doesNotMatch(modal, /startsWith\('\/dashboard'\)/)
  assert.match(modal, /event\.key==='Escape'/)
  assert.match(modal, /@mousedown\.self="emit\('close'\)"/)
  assert.match(modal, /aria-modal="true"/)
  assert.match(modal, /@click="emit\('close'\)"/)
  assert.match(css, /\.modal-panel \{[^}]*background:var\(--surface\)/)
  assert.match(css, /\.modal-panel \.modal-content \{ padding:24px; \}/)
})

test('optional character fields do not block, and a missing required field can be focused', () => {
  let state = setAspect(setPromptStyle(setModel(setIdea(blankWizard(), 'Maya meets Rui on the rainy quay and hands him a letter.'), 'grok'), 'short'), '16:9')
  state = setGenre(setStyle(state, 'cinema'), 'drama')
  state = setMood(setLight(state, 'day'), 'grounded')
  const first = state.characters[0].id
  state = ['name', 'age', 'build', 'hair', 'outfit', 'colors', 'mark'].reduce((next, field) => setCharacterField(next, first, field, field === 'name' ? 'Maya' : 'filled'), state)
  state = addCharacter(state)
  const second = state.characters[1].id
  state = setCharacterField(state, second, 'name', 'Rui')
  state = { ...state, step: 'characters', characterIndex: 0 }
  const droppedColor = setCharacterField(state, first, 'colors', '   ')
  const droppedMark = setCharacterField(state, first, 'mark', '')
  assert.equal(gapsFor(droppedColor, 'characters').some(gap => gap.field === 'colors'), false)
  assert.equal(gapsFor(droppedMark, 'characters').some(gap => gap.field === 'mark'), false)
  const missingHair = setCharacterField(state, second, 'hair', '')
  const gaps = gapsFor(missingHair, 'characters')
  const hair = gaps.find(gap => gap.field === 'hair' && gap.targetId === second)
  assert.ok(hair)
  assert.equal(gapFieldId(missingHair, hair), `${second}-hair`)
  const revealed = revealGap(missingHair, hair)
  assert.equal(revealed.characterIndex, 1)
  assert.match(source('app/components/StudioWizard.vue'), /revealGap/)
  assert.match(source('app/components/StudioWizard.vue'), /getElementById\(target\)/)
  assert.doesNotMatch(source('app/components/StudioWizard.vue'), /:disabled="gaps\.length > 0/)
})

test('a story with no character generates in English and Portuguese without a lock line', () => {
  const state = landscapeBoard()
  assert.equal(gapsFor(state, 'characters').length, 0)
  assert.equal(gapsFor(state, 'shots').some(gap => gap.field === 'who'), false)
  assert.equal(canGenerate(state), true)
  for (const lang of ['en', 'pt']) {
    const project = projectFromWizard(state, { promptLanguage: lang })
    assert.equal(project.filmSheet.characters.length, 0)
    assert.equal(project.noCharacter, true)
    const prompt = project.shots.map(shot => shot.prompt).join('\n')
    assert.match(prompt, /Fog rolls across the empty street/)
    assert.match(prompt, /Empty city/)
    assert.doesNotMatch(prompt, / — |People:|SUBJECT:/)
    if (lang === 'en') assert.match(prompt, /Wide shot|wide shot/)
    if (lang === 'pt') assert.match(prompt, /Plano geral|plano geral/)
  }
  const api = {
    premise: 'Fog rolls across an empty city street at dusk.',
    model: 'grok',
    mode: 'scenario',
    scenario: {
      characters: [],
      places: [{ name: 'Empty city', description: 'a wide empty street' }],
      light: 'dusk',
      mood: 'quiet',
      scenes: [{ where: 'Empty city', what: 'Fog rolls across the empty street' }]
    }
  }
  for (const promptLanguage of ['en', 'pt']) {
    const planned = post({ ...api, promptLanguage })
    assert.equal(planned.status, 200, planned.body.message)
    assert.equal(planned.body.filmSheet.characters.length, 0)
    const prompt = planned.body.shots.map(shot => shot.prompt).join('\n')
    assert.match(prompt, /Fog rolls across the empty street/)
    assert.doesNotMatch(prompt, / — |People:|SUBJECT:/)
    const direct = createStoryboard({ ...api, sequenceMode: 'scenario', promptLanguage })
    assert.equal(direct.shots[0].noCharacter, true)
    assert.doesNotMatch(direct.shots[0].prompt, / — /)
  }
  const advanced = createStoryboard({
    premise: 'Fog rolls across an empty city street at dusk.',
    model: 'grok',
    sequenceMode: 'continuous',
    noCharacter: true
  })
  assert.equal(advanced.noCharacter, true)
  assert.equal(advanced.filmSheet.characters.length, 0)
  const advancedPrompt = advanced.shots.map(shot => shot.prompt).join('\n')
  assert.doesNotMatch(advancedPrompt, /Same character:|People:|SUBJECT:| — /)
})

test('one shot can omit the character while another shot keeps the lock line', () => {
  let state = setAspect(setPromptStyle(setModel(setIdea(blankWizard(), 'A paper boat drifts, then Maya waves from the quay.'), 'grok'), 'short'), '16:9')
  state = setGenre(setStyle(state, 'cinema'), 'drama')
  state = setMood(setLight(state, 'day'), 'quiet')
  const maya = state.characters[0].id
  state = ['name', 'age', 'build', 'hair', 'outfit'].reduce((next, field) => setCharacterField(next, maya, field, field === 'name' ? 'Maya' : 'ink black coat'), state)
  const place = state.places[0].id
  state = setPlaceField(state, place, 'name', 'Quay')
  state = setPlaceField(state, place, 'description', 'a stone quay')
  const first = state.shots[0].id
  state = setShotNoCharacter(state, first, true)
  state = setShotField(state, first, 'placeId', place)
  state = setShotField(state, first, 'action', 'A paper boat drifts past the posts')
  state = setShotField(state, first, 'framing', 'wide')
  state = addWizardShot(state)
  const secondId = state.shots[1].id
  let next = state
  next = setShotField(next, secondId, 'placeId', place)
  next = setShotField(next, secondId, 'action', 'Maya waves once')
  next = setShotField(next, secondId, 'framing', 'medium')
  next = toggleShotCharacter(next, secondId, maya)
  assert.equal(canGenerate(next), true)
  const project = projectFromWizard(next)
  assert.equal(project.shots[0].noCharacter, true)
  assert.doesNotMatch(project.shots[0].prompt, /Maya|ink black coat| — /)
  assert.match(project.shots[1].prompt, /Maya/)
  assert.match(source('app/components/StudioWizard.vue'), /id="wizard-no-character"/)
  assert.match(source('app/components/StudioWizard.vue'), /setShotNoCharacter/)
  assert.match(source('app/i18n/locales/pt.json'), /Sem personagem/)
  assert.match(source('app/i18n/locales/pt.json'), /Sem personagem neste plano/)
})

test('header, footer, skip target, theme, install worker, and /en redirect are wired', () => {
  const pages = ['app/pages/index.vue', 'app/pages/studio.vue', 'app/pages/faq.vue', 'app/pages/agents.vue', 'app/pages/credits.vue', 'app/pages/readme.vue', 'app/pages/skill.vue', 'app/pages/[slug].vue']
  for (const file of pages) assert.match(source(file), /id="main-content"/, file)
  assert.match(source('app/pages/studio.vue'), /class="skip-link" href="#main-content"/)
  assert.match(source('app/components/AppHeader.vue'), /<ThemeToggle \/>/)
  assert.match(source('app/components/AppHeader.vue'), /<InstallButton \/>/)
  assert.match(source('app/components/WorkspaceHeader.vue'), /<ThemeToggle \/>/)
  assert.match(source('app/components/WorkspaceHeader.vue'), /<InstallButton \/>/)
  assert.match(source('app/components/ThemeToggle.vue'), /setPreference\('darkMode'/)
  const footer = source('app/components/SiteFooter.vue')
  for (const name of ['privacy', 'terms', 'content-policy']) assert.match(footer, new RegExp(`pageHref\\('${name}'\\)`))
  assert.match(source('app/pages/[slug].vue'), /page\.missing \? '\/' : '\/studio'/)
  assert.equal(legacyRedirectTarget('/en'), '/')
  assert.equal(legacyRedirectTarget('/en/'), '/')
  assert.equal(legacyRedirectTarget('/en/studio'), '/studio')
  assert.equal(legacyRedirectTarget('/en/privacy'), '/privacy')
  assert.equal(legacyRedirectTarget('/pt'), '/')
  assert.equal(legacyRedirectTarget('/studio'), '')
  assert.match(source('app/pages/[slug].vue'), /'en'/)
  const css = source('app/assets/css/main.css')
  assert.doesNotMatch(css, /cursor:\s*wait/)
  assert.match(css, /button:disabled,\s*button\[disabled\] \{ cursor:not-allowed; \}/)
  assert.match(css, /button\.button-primary:disabled[\s\S]*background:#2a2824/)
  const worker = source('public/sw.js')
  assert.match(worker, /addEventListener\('fetch'/)
  assert.doesNotMatch(worker, /caches\.put|caches\.add|caches\.match/)
  assert.match(worker, /caches\.delete/)
  assert.match(source('app/plugins/install.client.js'), /import\.meta\.dev/)
  assert.match(source('app/plugins/install.client.js'), /sw\.js/)
  assert.match(source('app/pages/studio.vue'), /moovicut-focus-idea/)
  assert.match(source('app/components/StudioWizard.vue'), /wizard-idea/)
  assert.match(css, /\.shot-thumbnail \{[^}]*max-height:180px[^}]*overflow:hidden/)
  assert.match(css, /\.modal-panel img,\s*\.modal-panel video \{[^}]*max-height:min\(200px,36vh\)/)
  assert.match(source('app/pages/studio.vue'), /function openProjects\(\)\{showMoreTools\.value=false/)
  assert.match(source('app/pages/studio.vue'), /function openEditor\(\)\{panel\.value=null/)
  assert.match(source('app/components/StudioCreationPanel.vue'), /id="advanced-no-character"/)
})
