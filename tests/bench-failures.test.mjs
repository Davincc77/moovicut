import test from 'node:test'
import assert from 'node:assert/strict'
import { detectGenre } from '../app/utils/prompt-engine.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

const JAPANESE_PREMISE = '和紙の漉き場と川辺の晒し筏。文子は四十代で、右の眉尻に小さな欠けがあり、藍のエプロンと腕カバー、黄色い手ぬぐいをつけている。悟は四十代で、短い黒髪に作業着を着ている。夜明け、文子は漉き場で竹の簀を上げて紙をすくう。文子は濡れた紙を板に移す。悟は川辺の晒し筏で紙を広げる。悟は竿で筏を押す。夕方、文子と悟は漉き場で紙を数える。'

const CHINESE_PREMISE = '四十多岁的茶青看管人圆脸。卫明四十多岁，圆脸，头顶发髻，锈红色的腕带。黎明，卫明在焙茶房掀开一个竹焙笼的盖。卫明和茶青在焙茶房的长案两侧比对叶片。卫明把焙好的叶子倒进陶罐并盖上盖子。'

function post(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

test('a named Chinese premise that cannot be planned is 400, not a template board', () => {
  const removed = post({ premise: JAPANESE_PREMISE, promptLanguage: 'ja', format: 'agent', model: 'generic' })
  assert.equal(removed.status, 400)
  assert.equal(removed.body.error, 'invalid_prompt_language')
  assert.match(removed.body.message, /en, zh-Hans, pt/)
  assert.doesNotMatch(removed.body.message, /\bja\b/)
  for (const [premise, promptLanguage, name] of [
    [CHINESE_PREMISE, 'zh-Hans', '卫明']
  ]) {
    const planned = post({ premise, promptLanguage, format: 'agent', model: 'generic' })
    assert.equal(planned.status, 400, planned.body.message)
    assert.equal(planned.body.error, 'invalid_plan')
    assert.match(planned.body.message, new RegExp(name))
    assert.match(planned.body.message, /scenario/i)
    assert.match(planned.body.message, /who may be a string or a list of names/)
    assert.match(planned.body.message, /look/)
    assert.ok(Array.isArray(planned.body.errors) && planned.body.errors.length >= 2)
    assert.equal(planned.body.shots, undefined)
    assert.doesNotMatch(planned.body.message, /entering the frame|retro-futurism|フレームに入る/)
  }
  const lighthouse = post({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.', model: 'grok', compact: true })
  assert.equal(lighthouse.status, 200)
  assert.equal(lighthouse.body.shots.length, 5)
})

test('invalid_plan names every dropped person and quotes every dropped action', () => {
  const people = ['Maya', 'Rui', 'Nia']
  const actions = [
    'Maya hands Rui a letter on the quay',
    'Rui reads the letter',
    'Rui walks away',
    'Nia opens the door'
  ]
  const planned = post({ premise: `${actions.join('. ')}.`, model: 'generic', format: 'agent' })
  assert.equal(planned.status, 400, planned.body.message)
  assert.equal(planned.body.error, 'invalid_plan')
  for (const name of people) {
    assert.match(planned.body.message, new RegExp(`${name} was not planned into a shot`))
    assert.ok(planned.body.errors.some(item => item.name === name && item.field === 'characters'), name)
  }
  for (const action of actions) {
    const line = `This action was not planned: "${action}".`
    assert.ok(planned.body.message.includes(line), planned.body.message)
    assert.ok(planned.body.errors.some(item => item.action === action && item.message === line), action)
  }
  assert.equal(planned.body.errors.filter(item => item.field === 'characters').length, people.length)
  assert.equal(planned.body.errors.filter(item => item.field === 'scenes').length, actions.length)
  assert.doesNotMatch(planned.body.message, /The premise has \d+ actions/)
})

test('a Japanese loanword does not select the science-fiction style', () => {
  assert.notEqual(detectGenre('文子は藍のエプロンをつけている。'), 'scifi')
  assert.equal(detectGenre('ロボットが宇宙船を修理する。'), 'scifi')
})

test('a scenario plans every named person and every action, and who may be a list', () => {
  const planned = post({
    model: 'generic',
    promptLanguage: 'zh-Hans',
    format: 'agent',
    scenario: {
      characters: [
        { name: '文子', look: '四十代、右の眉尻に小さな欠け', outfit: '藍の前掛け、腕カバー、黄色い手ぬぐい' },
        { name: '悟', look: '四十代、短い黒髪', outfit: '作業着' }
      ],
      places: [
        { name: '漉き場', description: '夜明けの和紙の漉き場' },
        { name: '晒し筏', description: '川辺の晒し筏' }
      ],
      scenes: [
        { who: '文子', where: '漉き場', what: '文子は竹の簀を上げて紙をすくう' },
        { who: '文子', where: '漉き場', what: '文子は濡れた紙を板に移す' },
        { who: '悟', where: '晒し筏', what: '悟は紙を広げる' },
        { w: ['悟'], where: '晒し筏', what: '悟は竿で筏を押す' },
        { who: ['文子', '悟'], where: '漉き場', what: '文子と悟は紙を数える' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  assert.equal(planned.body.shots.length, 5)
  const names = planned.body.filmSheet.characters.map(person => person.name)
  assert.deepEqual(names, ['文子', '悟'])
  const actions = planned.body.shots.map(shot => shot.what).join('\n')
  for (const action of ['紙をすくう', '板に移す', '紙を広げる', '竿で筏を押す', '紙を数える']) assert.match(actions, new RegExp(action))
  assert.match(planned.body.shots[4].who, /文子/)
  assert.match(planned.body.shots[4].who, /悟/)
  const sheetPlaces = planned.body.filmSheet.places.map(place => place.name).join(' ')
  assert.doesNotMatch(sheetPlaces, /眉|腕カバー/)
  assert.doesNotMatch(planned.body.shots.map(shot => shot.prompt).join('\n'), /entering the frame|フレームに入る|retro-futurism/)
})

test('an unsupported who shape names the expected shape', () => {
  const planned = post({
    scenario: {
      characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
      places: [{ name: 'Café', description: 'a small morning cafe' }],
      scenes: [
        { who: { name: 'Léa' }, where: 'Café', what: 'She pours a latte' },
        { w: 3, where: 'Café', what: 'She laughs' }
      ]
    }
  })
  assert.equal(planned.status, 400)
  assert.equal(planned.body.error, 'invalid_scenario')
  assert.match(planned.body.message, /scenes\[0\]\.who must be a string or a list of names, not an object/)
  assert.match(planned.body.message, /scenes\[1\]\.who must be a string or a list of names, not a number/)
  assert.doesNotMatch(planned.body.message, /missing who/)
})

test('a Chinese short prompt keeps the subject, the place, and the action in one clause', () => {
  const planned = post({
    model: 'grok',
    promptLanguage: 'zh-Hans',
    scenario: {
      characters: [
        { name: '卫明', look: '四十多岁，圆脸，发髻', outfit: '锈红色的腕带' },
        { name: '茶青', look: '四十多岁，圆脸，短发', outfit: '靛蓝围裙' }
      ],
      places: [{ name: '焙茶房', description: '室内的焙茶房，竹焙笼和陶罐' }],
      scenes: [
        { who: '卫明', where: '焙茶房', what: '掀开一个竹焙笼的盖', camera: 'close' },
        { who: ['卫明', '茶青'], where: '焙茶房', what: '在长案两侧比对叶片', framing: '特写' },
        { who: '卫明', where: '焙茶房', what: '把焙好的叶子倒进陶罐并盖上盖子', camera: 'close-up' }
      ]
    }
  })
  assert.equal(planned.status, 200, planned.body.message)
  const lines = planned.body.shots.map(shot => shot.prompt.split('\n')[0])
  assert.match(lines[0], /特写: 卫明在焙茶房掀开一个竹焙笼的盖/)
  assert.doesNotMatch(lines[0], /卫明\./)
  assert.match(lines[1], /特写: 卫明和茶青在焙茶房长案两侧比对叶片/)
  assert.doesNotMatch(lines[1], /在焙茶房在/)
  assert.match(lines[2], /特写: 卫明在焙茶房把焙好的叶子倒进陶罐并盖上盖子/)
  assert.match(planned.body.shots[0].prompt, /焙茶房/)
  assert.match(planned.body.shots[0].prompt, /锈红色的腕带/)
})

test('format agent warns when characters or places come out empty', () => {
  const warnings = assessProject({
    id: 'empty',
    sequenceMode: 'scenario',
    filmSheet: { characters: [{ name: '' }], places: [{ name: '', description: '' }] },
    shots: [{ id: 'shot-01', order: 1, who: '', where: '', what: 'wait' }]
  })
  assert.ok(warnings.some(item => item.code === 'empty_characters' && item.fix))
  assert.ok(warnings.some(item => item.code === 'empty_places' && item.fix))
  assert.ok(warnings.some(item => item.code === 'empty_who'))
  assert.ok(warnings.some(item => item.code === 'empty_where'))
  const planned = post({
    schema: 'shotboard.compact.v1',
    title: 'Empty sheet',
    premise: 'A quiet room with nobody in it yet.',
    model: 'grok',
    aspectRatio: '16:9',
    mode: 'scenario',
    filmSheet: { characters: [], places: [] },
    shots: [{ id: 'shot-01', order: 1, duration: 3, who: '', where: '', what: 'The room stays empty.', prompt: 'KEEP', promptEdited: true }]
  })
  assert.equal(planned.status, 200, planned.body.message)
  const codes = (planned.body.warnings || []).map(item => item.code)
  assert.ok(codes.includes('empty_characters'), codes.join(','))
  assert.ok(codes.includes('empty_places'), codes.join(','))
  assert.ok(codes.includes('empty_who'), codes.join(','))
  assert.ok(codes.includes('empty_where'), codes.join(','))
})
