import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryboard, refreshShotPrompt } from '../app/utils/prompt-engine.js'
import { termById } from '../app/utils/framing.js'
import { detectProse, textLanguageHint } from '../app/utils/prose-detect.js'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { PROMPT_LANGUAGES } from '../app/utils/prompt-lang.js'
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
  projectFromWizard
} from '../app/utils/wizard.js'

const lighthouse = 'A lighthouse keeper races the dusk to repair a failing beacon before a fishing boat reaches the rocks.'
const ENGLISH_SHOT = 'SHOT: Wide shot: A wide view of Lighthouse at dusk, with Lighthouse keeper entering the frame.\nLighthouse keeper — wool jacket, knit cap, weathered boots.\nPLACE: Lighthouse.\nLIGHT: Dusk, warm amber light, deep shadows and muted gold.\nCAMERA: locked-off camera.\nSTYLE: realistic photographic cinema, natural skin, muted earth tones and soft contrast.'

function fillCharacter(state, id, fields) {
  return Object.entries(fields).reduce((next, [field, value]) => setCharacterField(next, id, field, value), state)
}

function completeBoard() {
  let state = setAspect(setPromptStyle(setModel(setIdea(blankWizard(), 'Maya meets Rui on the rainy quay and hands him a letter before he walks away.'), 'grok'), 'short'), '16:9')
  state = setGenre(setStyle(state, 'cinema'), 'drama')
  state = setMood(setLight(state, 'dusk'), 'tense')
  const maya = state.characters[0].id
  state = fillCharacter(state, maya, {
    name: 'Maya',
    age: 'early 30s',
    build: 'round face',
    hair: 'short black pixie cut',
    outfit: 'charcoal wool coat',
    colors: 'charcoal and black',
    mark: 'round glasses'
  })
  state = addCharacter(state)
  const rui = state.characters[1].id
  state = fillCharacter(state, rui, {
    name: 'Rui',
    age: '50s',
    build: 'grey stubble',
    hair: 'short grey hair',
    outfit: 'navy peacoat',
    colors: 'navy and rust',
    mark: 'rust-red scarf'
  })
  const place = state.places[0].id
  state = setPlaceField(state, place, 'name', 'Rainy quay')
  state = setPlaceField(state, place, 'description', 'a wet stone quay at the harbour')
  const first = state.shots[0].id
  state = toggleShotCharacter(state, first, maya)
  state = setShotField(state, first, 'placeId', place)
  state = setShotField(state, first, 'action', 'She hands him a letter')
  state = setShotField(state, first, 'framing', 'close')
  state = addWizardShot(state)
  const second = state.shots[1].id
  state = toggleShotCharacter(state, second, rui)
  state = setShotField(state, second, 'placeId', place)
  state = setShotField(state, second, 'action', 'He walks away')
  state = setShotField(state, second, 'framing', 'tracking')
  return state
}

function engineFrom(state, promptLanguage) {
  const scenario = {
    characters: [
      { name: 'Maya', look: 'early 30s, round face, short black pixie cut', outfit: 'charcoal wool coat', body: 'early 30s', face: 'round face', hair: 'short black pixie cut', colors: 'charcoal and black', marks: 'round glasses' },
      { name: 'Rui', look: '50s, grey stubble, short grey hair', outfit: 'navy peacoat', body: '50s', face: 'grey stubble', hair: 'short grey hair', colors: 'navy and rust', marks: 'rust-red scarf' }
    ],
    places: [{ name: 'Rainy quay', description: 'a wet stone quay at the harbour' }],
    light: 'dusk',
    mood: 'tense',
    scenes: [
      { who: 'Maya', where: 'Rainy quay', what: 'She hands him a letter', duration: 3 },
      { who: 'Rui', where: 'Rainy quay', what: 'He walks away', duration: 3 }
    ]
  }
  const existing = createStoryboard({
    id: 'parity',
    premise: state.idea,
    model: 'grok',
    sequenceMode: 'scenario',
    scenario,
    style: 'cinema',
    genre: 'drama',
    aspectRatio: '16:9',
    promptStyle: 'short',
    duration: 3,
    promptLanguage
  })
  const framings = ['close', 'tracking']
  const shots = existing.shots.map((shot, index) => {
    const term = termById(framings[index])
    return { ...shot, framingTerm: term.id, framingChosen: true, framing: term.label }
  })
  const stamped = { ...existing, shots }
  stamped.shots = shots.map((shot, index) => refreshShotPrompt(shot, stamped, index))
  return stamped
}

test('English prompts stay byte-identical when the language is omitted or en', () => {
  const plain = createStoryboard({ premise: lighthouse, style: 'cinema', genre: 'drama', sequenceMode: 'continuous' })
  const english = createStoryboard({ premise: lighthouse, style: 'cinema', genre: 'drama', sequenceMode: 'continuous', promptLanguage: 'en' })
  assert.equal(plain.promptLanguage, undefined)
  assert.equal(english.promptLanguage, undefined)
  assert.equal(plain.shots[0].prompt, ENGLISH_SHOT)
  assert.equal(english.shots.map(shot => shot.prompt).join('\n'), plain.shots.map(shot => shot.prompt).join('\n'))
  assert.throws(() => createStoryboard({ premise: lighthouse, promptLanguage: 'es' }), error => error.status === 400 && /zh-Hans/.test(error.message))
})

test('the wizard and the advanced editor build the same prompts in every language', () => {
  const state = completeBoard()
  for (const lang of PROMPT_LANGUAGES) {
    const fromWizard = projectFromWizard(state, { id: 'parity', promptLanguage: lang })
    const fromEditor = engineFrom(state, lang)
    assert.equal(fromWizard.shots.map(shot => shot.prompt).join('\n'), fromEditor.shots.map(shot => shot.prompt).join('\n'), lang)
  }
  const french = projectFromWizard(state, { promptLanguage: 'fr' })
  assert.match(french.shots[0].prompt, /Maya hands him a letter/)
  assert.match(french.shots[0].prompt, /Rainy quay, a wet stone quay at the harbour/)
  assert.match(french.shots[0].prompt, /charcoal wool coat/)
  assert.match(french.shots[0].prompt, /Gros plan:/)
  assert.match(french.shots[0].prompt, /caméra fixe/)
  assert.match(french.shots[0].prompt, /Mains simples/)
  assert.doesNotMatch(french.shots[0].prompt, /locked-off camera|Close-up:|Dusk light/)
  const chinese = projectFromWizard(state, { promptLanguage: 'zh-Hans' })
  assert.match(chinese.shots[0].prompt, /特写: Maya hands him a letter/)
  assert.match(chinese.shots[1].prompt, /跟踪镜头: Rui walks away/)
  assert.ok(chinese.shots[0].prompt.indexOf('Maya hands him a letter') < chinese.shots[0].prompt.indexOf('Rainy quay'))
})

test('the API keeps English output unless promptLanguage is set', () => {
  const base = { premise: lighthouse, style: 'cinema', genre: 'drama', sequenceMode: 'continuous', compact: true }
  const plain = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify(base) })
  const english = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify({ ...base, prompt_language: 'en' }) })
  assert.equal(plain.status, 200)
  const plainBody = JSON.parse(plain.body)
  const englishBody = JSON.parse(english.body)
  assert.deepEqual(Object.keys(plainBody).sort(), ['aspectRatio', 'model', 'premise', 'shots', 'studioUrl', 'title'])
  assert.equal(plainBody.shots[0].prompt, englishBody.shots[0].prompt)
  assert.equal(plainBody.shots[0].prompt, ENGLISH_SHOT)
  const rejected = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify({ ...base, promptLanguage: 'es' }) })
  const german = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify({ ...base, promptLanguage: 'de' }) })
  assert.equal(german.status, 400)
  assert.match(JSON.parse(german.body).message, /promptLanguage must be one of/)
  assert.doesNotMatch(JSON.parse(german.body).message, /\bde\b/)
  assert.equal(rejected.status, 400)
  assert.match(JSON.parse(rejected.body).message, /promptLanguage must be one of/)
  const french = dispatchAgentRequest({ method: 'POST', pathname: '/api/v1/storyboard', body: JSON.stringify({ premise: lighthouse, promptLanguage: 'fr', format: 'agent', style: 'cinema', genre: 'drama', sequenceMode: 'continuous' }) })
  const board = JSON.parse(french.body)
  assert.equal(board.promptLanguage, 'fr')
  assert.match(board.shots[0].prompt, /Plan large:/)
  assert.doesNotMatch(board.shots[0].prompt, /^Wide shot:/)
})

const SAMPLES = {
  pt: 'Maya tem cerca de 30 anos, cabelo preto curto e um casaco de lã cinza. Rui tem 50 anos, barba por fazer e um casaco azul-marinho. No cais chuvoso, Maya entrega uma carta a Rui. Rui lê a carta. Rui afasta-se pelo cais. No café pequeno, Maya observa Rui da porta.',
  it: 'Maya ha poco più di trent’anni, un caschetto nero e un cappotto di lana antracite. Rui ha 50 anni, la barba incolta e un cappotto blu. Sul molo sotto la pioggia, Maya porge una lettera a Rui. Rui legge la lettera. Rui si allontana. Nel piccolo caffè, Maya guarda Rui dalla porta.',
  ja: '「麻耶」は三十代前半で、短い黒髪、チャコールグレーのウールコート。「ルイ」は五十代で、白い無精ひげ、ネイビーのピーコート。雨の埠頭で麻耶はルイに手紙を渡す。ルイは手紙を読む。ルイは歩き去る。小さなカフェで麻耶は扉からルイを見る。',
  'zh-Hans': '「玛雅」三十出头，黑色短发，炭灰色羊毛大衣。「睿」五十多岁，灰白胡茬，海军蓝大衣。在雨中的码头，玛雅把信交给睿。睿读了信。睿走开了。在小咖啡馆，玛雅在门口看着睿。'
}

test('free-prose detection reads each site language without calling a model', () => {
  const report = {}
  for (const [language, text] of Object.entries(SAMPLES)) {
    const detected = detectProse(text)
    const names = language === 'ja' ? ['麻耶', 'ルイ'] : language === 'zh-Hans' ? ['玛雅', '睿'] : ['Maya', 'Rui']
    const nameHits = names.filter(name => detected.characters.some(item => item.name === name)).length
    const lookHits = detected.characters.filter(item => names.includes(item.name) && item.look).length
    const outfitHits = detected.characters.filter(item => names.includes(item.name) && item.outfit).length
    report[language] = {
      language: detected.language,
      reliable: detected.reliable,
      confidence: detected.confidence,
      characters: `${nameHits}/2`,
      look: `${lookHits}/2`,
      outfit: `${outfitHits}/2`,
      places: detected.places.length,
      actions: detected.scenes.length
    }
    assert.equal(detected.language, language)
    assert.equal(nameHits, 2, language)
    assert.equal(lookHits, 2, language)
    assert.equal(outfitHits, 2, language)
    assert.equal(detected.places.length, 2, language)
    assert.equal(detected.scenes.length, 4, language)
    assert.equal(detected.reliable, true, language)
  }
  const unmarked = detectProse('今日はいい天気です。公園を歩きました。')
  assert.equal(unmarked.language, 'ja')
  assert.equal(unmarked.reliable, false)
  assert.ok(textLanguageHint('Elle entre au café avec un parapluie rouge.', 'en'))
  assert.equal(textLanguageHint('She walks into the cafe with a red umbrella.', 'en'), null)
  assert.equal(report.ja.characters, '2/2')
  assert.equal(report['zh-Hans'].actions, 4)
})
