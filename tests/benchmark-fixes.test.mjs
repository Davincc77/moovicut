import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard } from '../app/utils/prompt-engine.js'
import { detectProse } from '../app/utils/prose-detect.js'
import { dispatchAgentRequest, scenePlanGaps } from '../server/agent-api.mjs'

function post(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

const cast = [
  { name: 'Nils', age: 'in his early fifties', role: 'fisherman', look: 'weathered face', outfit: 'oilskin coat' },
  { name: 'Lia', age: 'early thirties', role: 'teacher', look: 'dark hair', outfit: 'blue sweater' }
]
const dock = [{ name: 'Dock', description: 'a wooden dock at dusk' }]

test('top-level characters, places, and scenes are misplaced_scenario_fields, not a template board', () => {
  const planned = post({
    premise: 'A quiet evening on the dock.',
    model: 'generic',
    characters: cast,
    places: dock,
    scenes: [{ who: ['Nils', 'Lia'], where: 'Dock', what: 'They stand face to face without touching' }]
  })
  assert.equal(planned.status, 400)
  assert.equal(planned.body.error, 'misplaced_scenario_fields')
  for (const field of ['characters', 'places', 'scenes']) {
    assert.match(planned.body.message, new RegExp(`\\b${field}\\b`))
    assert.ok(planned.body.errors.some(item => item.field === field), field)
  }
  assert.match(planned.body.message, /inside scenario/)
  assert.match(planned.body.message, /"scenario"/)
  assert.match(planned.body.message, /"what"/)
  assert.equal(planned.body.shots, undefined)
  assert.doesNotMatch(planned.body.message, /entering the frame/)
})

test('misplaced scenario fields outrank a missing premise', () => {
  const planned = post({
    characters: [{ name: 'Nils', look: 'weathered face', outfit: 'oilskin coat' }],
    places: dock,
    scenes: [{ who: 'Nils', where: 'Dock', what: 'He mends a net' }]
  })
  assert.equal(planned.status, 400)
  assert.equal(planned.body.error, 'misplaced_scenario_fields')
  assert.doesNotMatch(planned.body.message, /at least 8 characters/)
  const short = post({ premise: 'Too short', characters: cast })
  assert.equal(short.status, 400)
  assert.equal(short.body.error, 'misplaced_scenario_fields')
  const missing = post({ premise: 'Short' })
  assert.equal(missing.status, 400)
  assert.equal(missing.body.error, 'invalid_premise')
  const custom = post({
    premise: 'A lighthouse keeper races the dusk to repair a failing beacon.',
    scenes: [{ action: 'The keeper looks up at the lamp.', duration: 3, framing: 'close-up' }]
  })
  assert.equal(custom.status, 200, custom.body.message)
  assert.match(custom.body.shots[0].prompt, /looks up at the lamp/)
})

test('invalid_plan counts names and actions given in scene what', () => {
  const project = createStoryboard({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.' })
  const gaps = scenePlanGaps({
    scenes: [
      { who: 'Nils', what: 'Nils mends a net on the quay' },
      { who: ['Lia'], what: 'Lia reads the letter.' }
    ]
  }, project)
  assert.ok(gaps.names.includes('Nils'))
  assert.ok(gaps.names.includes('Lia'))
  assert.ok(gaps.actions.includes('Nils mends a net on the quay'))
  assert.ok(gaps.actions.includes('Lia reads the letter'))
  const wrapped = post({
    model: 'generic',
    scenario: {
      characters: cast,
      places: dock,
      scenes: [
        { who: 'Nils', where: 'Dock', what: 'Nils mends a net on the quay' },
        { who: 'Lia', where: 'Dock', what: 'Lia reads the letter' }
      ]
    }
  })
  assert.equal(wrapped.status, 200, wrapped.body.message)
  assert.match(wrapped.body.shots.map(shot => shot.prompt).join('\n'), /mends a net on the quay/)
  assert.match(wrapped.body.shots.map(shot => shot.prompt).join('\n'), /reads the letter/)
})

test('a negative physical constraint stays in the short and detailed prompts in every language', () => {
  const lines = [
    ['en', 'They walk to the end of the dock. They stand face to face. Without touching.', /without touching/i],
    ['pt', 'Eles caminham até o fim do cais. Ficam frente a frente. Sem se tocar.', /sem se tocar/i],
    ['zh-Hans', '两人走到码头尽头。面对面站着。不接触。', /不接触/]
  ]
  for (const code of ['fr', 'ja', 'it']) {
    const removed = post({ model: 'generic', promptLanguage: code, scenario: { characters: [{ name: 'Nils', look: 'weathered face', outfit: 'oilskin coat' }], places: dock, scenes: [{ who: 'Nils', where: 'Dock', what: 'He waits' }] } })
    assert.equal(removed.status, 400, code)
    assert.match(removed.body.message, /en, zh-Hans, pt/)
  }
  for (const [promptLanguage, what, pattern] of lines) {
    for (const prompt_style of ['short', 'detailed']) {
      const planned = post({
        model: 'generic',
        promptLanguage,
        prompt_style,
        scenario: {
          characters: [
            { name: 'Nils', look: 'weathered face', outfit: 'oilskin coat' },
            { name: 'Lia', look: 'dark hair', outfit: 'blue sweater' }
          ],
          places: dock,
          scenes: [{ who: ['Nils', 'Lia'], where: 'Dock', what, duration: 6 }]
        }
      })
      assert.equal(planned.status, 200, `${promptLanguage} ${prompt_style} ${planned.body.message}`)
      const prompts = planned.body.shots.map(shot => shot.prompt).join('\n')
      assert.match(prompts, pattern, `${promptLanguage} ${prompt_style}\n${prompts}`)
    }
  }
})

test('the lock line keeps age and role in every prompt language', () => {
  const prose = detectProse('Nils, in his early fifties, fisherman, weathered face, oilskin coat, mends a net on the dock. Lia, early thirties, teacher, dark hair, blue sweater, waits beside him.')
  const nils = prose.characters.find(person => person.name === 'Nils')
  const lia = prose.characters.find(person => person.name === 'Lia')
  assert.ok(nils, prose.characters.map(person => person.name).join(','))
  assert.match(nils.look, /early fifties/)
  assert.match(nils.look, /fisherman/)
  assert.match(nils.look, /weathered face/)
  assert.match(lia.look, /early thirties/)
  assert.match(lia.look, /teacher/)
  for (const promptLanguage of ['en', 'zh-Hans', 'pt']) {
    const planned = post({
      model: 'generic',
      promptLanguage,
      format: 'agent',
      scenario: { characters: cast, places: dock, scenes: [{ who: ['Nils', 'Lia'], where: 'Dock', what: 'They stand side by side', duration: 4 }] }
    })
    assert.equal(planned.status, 200, planned.body.message)
    const line = planned.body.filmSheet.characters.find(person => person.name === 'Nils').lockLine
    assert.match(line, /in his early fifties/)
    assert.match(line, /fisherman/)
    assert.match(line, /weathered face/)
    assert.match(planned.body.shots[0].prompt, /in his early fifties/)
    assert.match(planned.body.shots[0].prompt, /fisherman/)
    const detailed = post({
      model: 'generic',
      promptLanguage,
      prompt_style: 'detailed',
      scenario: { characters: cast, places: dock, scenes: [{ who: 'Nils', where: 'Dock', what: 'He mends a net', duration: 4 }] }
    })
    assert.match(detailed.body.shots[0].prompt, /in his early fifties/)
    assert.match(detailed.body.shots[0].prompt, /fisherman/)
  }
})

test('a shot size written in the action is not repeated', () => {
  const samples = [
    ['en', 'Close-up, day, calm: Lea sets the cup down', /close-up/i, /medium shot/i],
    ['pt', 'Grande plano, dia, calmo: Lia pousa a chávena', /grande plano/i, /plano médio/i],
    ['zh-Hans', '特写，白天，平静：莉亚放下杯子', /特写/, /中景/]
  ]
  for (const [promptLanguage, what, kept, dropped] of samples) {
    const planned = post({
      model: 'generic',
      promptLanguage,
      scenario: {
        characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
        places: [{ name: 'Café', description: 'a small morning cafe' }],
        scenes: [{ who: 'Léa', where: 'Café', what }]
      }
    })
    assert.equal(planned.status, 200, `${promptLanguage} ${planned.body.message}`)
    const opening = planned.body.shots[0].prompt.split('\n')[0]
    assert.match(opening, kept, opening)
    assert.equal((opening.match(new RegExp(kept.source, kept.flags.includes('g') ? kept.flags : `${kept.flags}g`)) || []).length, 1, opening)
    assert.doesNotMatch(opening, dropped, opening)
    assert.ok(planned.body.warnings.some(item => item.code === 'shot_size_in_action'), promptLanguage)
  }
  const conflict = post({
    model: 'generic',
    promptLanguage: 'pt',
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small morning cafe' }],
      scenes: [{ who: 'Léa', where: 'Café', what: 'Grande plano: Léa pousa a chávena', framing: 'wide shot' }]
    }
  })
  const line = conflict.body.shots[0].prompt.split('\n')[0]
  assert.match(line, /grande plano/i)
  assert.doesNotMatch(line, /plano geral|wide shot/i)
  const note = conflict.body.warnings.find(item => item.code === 'shot_size_in_action')
  assert.match(note.message, /wide shot/i)
})
