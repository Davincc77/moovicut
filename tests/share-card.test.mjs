import test from 'node:test'
import assert from 'node:assert/strict'
import { shareCardLines, wrapShareLine } from '../app/utils/share-card.js'
import { createStoryboard } from '../app/utils/prompt-engine.js'

test('a share card lists every shot locally without a network call', () => {
  const project = createStoryboard({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon before a fishing boat reaches the rocks.', style: 'Fun', count: 3 })
  const lines = shareCardLines(project)
  assert.equal(lines[0], 'Moovicut')
  assert.equal(lines.filter(line => /^\d{2}\s/.test(line)).length, 3)
  assert.match(lines.join('\n'), /Playful and lighthearted/)
  assert.ok(wrapShareLine('one two three four', 10).length > 1)
})
