import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref, computed } from 'vue'
import { useProjectStore } from '../app/composables/useProjectStore.js'

function storeFixture() {
  const states = new Map()
  const data = new Map()
  globalThis.localStorage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  }
  globalThis.useState = (key, init) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  }
  globalThis.ref = ref
  globalThis.computed = computed
  globalThis.useNotifier = () => ({ notify() {} })
  const store = useProjectStore()
  store.hydrate()
  return store
}

test('add, undo, and redo restore the shot count and the history flags', () => {
  const store = storeFixture()
  const start = store.project.value.shots.length
  assert.equal(start >= 5, true)
  assert.equal(store.canUndo.value, false)
  assert.equal(store.future.value.length, 0)
  store.addShotAtEnd()
  assert.equal(store.project.value.shots.length, start + 1)
  assert.equal(store.canUndo.value, true)
  assert.equal(store.future.value.length, 0)
  store.undo()
  assert.equal(store.project.value.shots.length, start)
  assert.equal(store.canUndo.value, false)
  assert.equal(store.future.value.length, 1)
  store.redo()
  assert.equal(store.project.value.shots.length, start + 1)
  assert.equal(store.canUndo.value, true)
  assert.equal(store.future.value.length, 0)
})

test('undo and redo read top-level computeds, and a phone menu stays inside the modal sheet', () => {
  const editor = readFileSync('app/components/StudioEditor.vue', 'utf8')
  assert.match(editor, /const canUndo = computed\(\(\) => store\.canUndo\.value === true\)/)
  assert.match(editor, /const canRedo = computed\(\(\) => Array\.isArray\(store\.future\.value\) && store\.future\.value\.length > 0\)/)
  assert.match(editor, /:disabled="!canUndo"/)
  assert.match(editor, /:disabled="!canRedo"/)
  assert.doesNotMatch(editor, /:disabled="!store\.canUndo"/)
  assert.doesNotMatch(editor, /store\.future\.length/)
  const menu = readFileSync('app/components/ActionMenu.vue', 'utf8')
  assert.match(menu, /is-modal/)
  assert.match(menu, /portal\.value = modal \? dialog : 'body'/)
  assert.match(menu, /:class="\{ 'is-open': open && inDialog \}"/)
  const creation = readFileSync('app/components/StudioCreationPanel.vue', 'utf8')
  assert.match(creation, /Create a storyboard before applying a style preset\./)
  assert.match(creation, /presetNeedsBoard/)
  const sheets = readFileSync('app/components/CharacterSheets.vue', 'utf8')
  assert.match(sheets, /\{name\} reference image, \{slot\}/)
  const css = readFileSync('app/assets/css/main.css', 'utf8')
  assert.match(css, /:is\(h1, h2, h3, h4, h5, h6\):not\(\.sr-only\) \{ font-family:var\(--display\)/)
  assert.match(css, /\.footer-bar a \{[^}]*min-height:44px/)
  assert.match(css, /\.language-switcher-select \{[^}]*min-height:44px/)
  assert.match(css, /\.side-sheet-body a \{[^}]*min-height:44px/)
})
