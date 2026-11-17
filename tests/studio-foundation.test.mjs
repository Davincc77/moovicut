import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WIZARD_STRINGS } from '../app/utils/wizard-strings.js'

const read = path => readFileSync(path, 'utf8')
const css = read('app/assets/css/main.css')
const wizard = read('app/components/StudioWizard.vue')
const studio = read('app/pages/studio.vue')
const editor = read('app/components/StudioEditor.vue')
const sidebar = read('app/components/WorkspaceSidebar.vue')
const en = JSON.parse(read('app/i18n/locales/en.json'))
const pt = JSON.parse(read('app/i18n/locales/pt.json'))

const keptControls = [
  ['app/components/StudioCreationPanel.vue', ['Quick idea', 'Scenario', 'Ad', 'Series', 'Explainer', 'Step-by-step storyboard', 'Create storyboard', 'Upload reference image', 'Prompt target']],
  ['app/components/StudioEditor.vue', ['store.undo()', 'store.redo()', 'store.persist()', 'store.addShotAtEnd', 'Export', 'Import']],
  ['app/pages/studio.vue', ['exportJson', 'exportLibrary', 'importProject', 'Save current project', 'Storyboard', 'My Projects', 'Advanced mode']],
  ['app/components/WorkspaceSidebar.vue', ["$t('Create')", "$t('Storyboard')", "$t('My Projects')", 'SupportLink']],
  ['app/components/StudioWizard.vue', ['action.addCharacter', 'action.addPlace', 'action.addShot', 'action.generate', 'action.regenerate', 'split.accept']]
]

test('studio accent matches the home gold and the dead light modal tokens are gone', () => {
  assert.match(css, /--accent:#f0b429/)
  assert.match(css, /--accent-hover:#f6c85a/)
  assert.match(css, /--gold:#f0b429/)
  assert.doesNotMatch(css, /--accent:#d4a054/)
  assert.doesNotMatch(css, /\.studio-modal\s*\{/)
  assert.doesNotMatch(css, /\.moovicut-dark|\.theme-toggle|\.workspace-theme/)
})

test('the storyboard meta line unwraps the computed duration', () => {
  assert.match(editor, /const totalSeconds = computed\(\(\) => Number\(store\.duration\.value\) \|\| 0\)/)
  assert.match(editor, /seconds: totalSeconds/)
  assert.doesNotMatch(editor, /seconds: store\.duration\b/)
})

test('the guide keeps every step and shows the idea error only after Next or blur', () => {
  for (const key of ['step.idea', 'step.characters', 'step.places', 'step.shots', 'step.check', 'step.generate']) {
    assert.ok(WIZARD_STRINGS[key], key)
  }
  assert.match(wizard, /ideaFeedback/)
  assert.match(wizard, /@blur="onIdeaBlur"/)
  assert.match(wizard, /showIdeaError/)
  assert.doesNotMatch(wizard, /heading\.value\?\.focus\(\)/)
  assert.match(wizard, /settingsOpen/)
  assert.match(wizard, /wizard-footer/)
  assert.match(wizard, /action\.nextStep/)
  assert.equal(WIZARD_STRINGS['missing.ideaShort'], 'Add a little more detail. The idea needs at least 8 characters.')
})

test('Storyboard is the only name for the local editor', () => {
  assert.doesNotMatch(studio, /Board tools/)
  assert.doesNotMatch(sidebar, /Board tools/)
  assert.match(studio, /eyebrow="Storyboard"/)
  assert.match(sidebar, /\$t\('Storyboard'\)/)
  assert.equal(en['Storyboard'], 'Storyboard')
  assert.equal(pt['Storyboard'], 'Storyboard')
  assert.equal(en['Board tools'], undefined)
  assert.equal(pt['Board tools'], undefined)
})

test('new studio strings exist in English and Portuguese with the same placeholders', () => {
  const added = [
    'Guided',
    'Change settings',
    'Short prompts',
    'Detailed prompts',
    'Settings: {model} · {aspect} · {style}',
    'Next: {step}',
    'Step {current} of {total} · {label}',
    'Go to {label}'
  ]
  const names = value => [...String(value).matchAll(/\{([A-Za-z]+)\}/g)].map(match => match[1]).sort()
  assert.deepEqual(Object.keys(en).sort(), Object.keys(pt).sort())
  for (const key of added) {
    assert.equal(en[key], key, key)
    assert.ok(pt[key] && pt[key] !== key, key)
    assert.deepEqual(names(pt[key]), names(key), key)
  }
})

test('pre-existing studio controls stay in the source', () => {
  for (const [file, needles] of keptControls) {
    const source = read(file)
    for (const needle of needles) assert.ok(source.includes(needle), `${file} ${needle}`)
  }
})
