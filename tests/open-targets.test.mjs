import test from 'node:test'
import assert from 'node:assert/strict'
import { OPEN_TARGETS, orderedOpenTargets, openTargetPlan, runOpenTarget, combinedShotPrompts } from '../app/utils/open-targets.js'

test('open targets have equal labels and do not prefill a prompt url', () => {
  assert.deepEqual(OPEN_TARGETS.map(target => target.label), ['Open in Grok Imagine', 'Open in Google'])
  assert.deepEqual(orderedOpenTargets(0).map(target => target.id), ['grok', 'google'])
  assert.deepEqual(orderedOpenTargets(1).map(target => target.id), ['google', 'grok'])
  for (const id of ['grok', 'google']) {
    const plan = openTargetPlan(id)
    assert.equal(plan.copy, true)
    assert.equal(plan.toast, 'Prompt copied')
    assert.doesNotMatch(plan.href, /[?&](q|prompt)=/)
  }
  assert.equal(openTargetPlan('grok').href, 'https://grok.com/imagine')
  assert.equal(openTargetPlan('google').href, 'https://labs.google/fx/tools/flow')
})

test('opening copies the prompt before the site is opened', async () => {
  const events = []
  const result = await runOpenTarget({
    id: 'google',
    prompt: 'Idea: a quiet harbour',
    copyText: async (text, message) => {
      events.push(['copy', text, message])
      return true
    },
    open: url => events.push(['open', url]),
    pauseMs: 0
  })
  assert.equal(result.opened, true)
  assert.deepEqual(events, [
    ['copy', 'Idea: a quiet harbour', 'Prompt copied'],
    ['open', 'https://labs.google/fx/tools/flow']
  ])
  const blocked = []
  const failed = await runOpenTarget({
    id: 'grok',
    prompt: 'Shot prompt',
    copyText: async () => false,
    open: url => blocked.push(url)
  })
  assert.equal(failed.opened, false)
  assert.deepEqual(blocked, [])
  const board = combinedShotPrompts({ shots: [{ prompt: 'one' }, { prompt: 'two' }] })
  assert.match(board, /Shot 1\none\n\nShot 2\ntwo/)
})
