import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStoryboard, durationPlans, retargetMode } from '../app/utils/prompt-engine.js'
import { detectProse } from '../app/utils/prose-detect.js'
import { assessProject } from '../app/utils/shot-risk.js'
import { exportAgentBoard, importAgentBoard } from '../app/utils/agent-board.js'
import { clientAddress, createRateLimiter, dispatchAgentRequest } from '../server/agent-api.mjs'
import { createProdServer } from '../server/prod-server.mjs'
import { parseSeries } from '../app/utils/preset-modes.js'

const mara = 'Mara, a young baker with red hair and a flour-dusted apron, walks through the sleepy village of Brindle at dawn. She opens her bakery on Maple Street and meets old Tom. Later in the village square they board up the windows before the storm.'
const lena = 'Lena, a young baker with flour on her apron, opens her tiny bakery in Lisbon before sunrise. Her grumpy neighbour Rui knocks on the window. She hands him a warm pastry. Later, in the rain-soaked street, Rui returns with an umbrella for her.'
const premise = 'A lighthouse keeper finds a glowing bottle washed up after a storm.'

test('prose detection keeps Mara and Lena on the right people, places, and scenes', () => {
  const first = detectProse(mara)
  assert.deepEqual(first.characters.map(item => item.name), ['Mara', 'Tom'])
  assert.match(first.characters[0].look, /young/)
  assert.match(first.characters[0].look, /red hair/)
  assert.match(first.characters[0].look, /baker/)
  assert.match(first.characters[0].outfit, /flour-dusted apron/)
  assert.match(first.characters[1].look, /old/)
  assert.ok(first.places.some(place => place.name === 'Brindle' && /village/i.test(place.description)))
  assert.ok(first.places.some(place => place.name === 'Maple Street'))
  assert.ok(first.places.some(place => /bakery/i.test(place.name)))
  assert.ok(first.places.some(place => /square/i.test(place.name)))
  assert.equal(first.characters.some(item => item.name === 'Brindle' || item.name === 'Maple'), false)
  assert.equal(first.scenes.length, 3)

  const second = detectProse(lena)
  assert.deepEqual(second.characters.map(item => item.name), ['Lena', 'Rui'])
  assert.equal(second.characters.some(item => item.name === 'Lisbon'), false)
  assert.ok(second.places.some(place => place.name === 'Lisbon'))
  assert.ok(second.places.some(place => /bakery/i.test(place.name)))
  assert.ok(second.places.some(place => /street/i.test(place.name)))
  assert.equal(second.places.some(place => /window/i.test(place.name)), false)
  assert.equal(second.scenes.length, 4)
  assert.match(second.scenes[0].what, /opens her tiny bakery/)
  assert.match(second.scenes[1].what, /knocks on the window/)
  assert.match(second.scenes[2].what, /hands him a warm pastry/)
  assert.match(second.scenes[3].what, /returns with an umbrella/)
  assert.equal(first.scenes.length, 3)
})

test('a style family locks every mode, manga aliases anime, and an unknown family is 400', () => {
  for (const sequenceMode of ['continuous', 'varied', undefined]) {
    const board = createStoryboard({ premise, style: 'anime', genre: 'shonen', sequenceMode })
    assert.equal(board.preset.family, 'anime')
    assert.equal(board.preset.genre, 'shonen')
    assert.match(board.shots[0].prompt, /Style lock: bold ink line art/)
    assert.doesNotMatch(board.shots[0].prompt, /Style lock: grounded cinematic realism/)
  }
  const documentary = createStoryboard({ premise, style: 'documentary', genre: 'nature' })
  assert.equal(documentary.preset.family, 'documentary')
  assert.match(documentary.shots[0].prompt, /Style lock:/)
  const manga = createStoryboard({ premise, style: 'manga', genre: 'shojo', sequenceMode: 'varied' })
  assert.equal(manga.style, 'anime')
  assert.equal(manga.preset.family, 'anime')
  assert.equal(manga.preset.genre, 'shojo')
  const switched = retargetMode(manga, 'continuous')
  assert.match(switched.shots[0].prompt, /Style lock: fine ink line art/)
  assert.throws(() => createStoryboard({ premise, style: 'oilpaint' }), error => error.status === 400 && /anime, cinema, documentary/.test(error.message))
  const scenario = dispatchAgentRequest({
    method: 'POST', pathname: '/api/v1/storyboard', origin: 'https://moovicut.studio',
    body: JSON.stringify({
      premise: 'A short cafe story for the board.',
      style: 'manga',
      scenario: {
        characters: [{ name: 'Léa', look: 'curly hair', outfit: 'green apron' }],
        places: [{ name: 'Café', description: 'a small cafe' }],
        scenes: [{ who: 'Léa', where: 'Café', what: 'She pours a latte' }]
      }
    })
  })
  assert.equal(scenario.status, 200)
  const scenarioBody = JSON.parse(scenario.body)
  assert.equal(scenarioBody.preset.family, 'anime')
  assert.equal(scenarioBody.style, 'anime')
  assert.match(scenarioBody.shots[0].prompt, /fine ink line art|Style lock:/)
  const unknown = dispatchAgentRequest({
    method: 'POST', pathname: '/api/v1/storyboard', origin: 'https://moovicut.studio',
    body: JSON.stringify({ premise, style: 'oilpaint' })
  })
  assert.equal(unknown.status, 400)
})

test('risk warnings show for generated and hand-edited prompts, and Sora warns once', () => {
  const risky = 'Taylor Swift fights a gory brutal battle with blood and a Nike logo, Disney characters watching.'
  const board = createStoryboard({ premise: risky, count: 3 })
  const codes = assessProject(board).map(item => item.code)
  for (const code of ['celebrity', 'gore', 'brand_logo', 'copyrighted_character']) assert.ok(codes.includes(code), code)
  board.shots[1].prompt = 'A quiet room, then Taylor Swift appears with a Nike logo.'
  board.shots[1].promptEdited = true
  assert.ok(assessProject(board).some(item => item.shotId === board.shots[1].id && item.code === 'celebrity'))
  const calm = createStoryboard({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.' })
  assert.deepEqual(assessProject(calm), [])
  const sora = createStoryboard({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.', model: 'sora', duration: 12, count: 3 })
  assert.equal(assessProject(sora).filter(item => item.code === 'sora_long_clip').length, 1)
})

test('Google duration plans are 3 x 4s for the short board, and storm prompts stay specific', () => {
  assert.deepEqual(durationPlans('google')[0], { id: '15s', label: '12s', total: 12, count: 3, duration: 4 })
  assert.deepEqual(durationPlans('grok')[0], { id: '15s', label: '15s', total: 15, count: 5, duration: 3 })
  const board = createStoryboard({
    premise: 'A lighthouse keeper finds a bottle message during a storm.',
    sequenceMode: 'continuous',
    style: 'Normal',
    model: 'google',
    count: 3,
    duration: 4
  })
  assert.equal(board.continuitySheet.time, 'storm')
  assert.equal(board.shots.length, 3)
  assert.equal(board.shots[0].duration, 4)
  assert.doesNotMatch(board.shots[0].prompt, /Lighthouse, Lighthouse/)
  assert.doesNotMatch(board.shots[0].prompt, /Grounded and clear:/)
  assert.doesNotMatch(board.shots[0].prompt, /Outfit:/)
  assert.match(board.shots[0].prompt, /Wardrobe:/)
  assert.match(board.shots[0].prompt, /Same wardrobe:/)
  const ad = createStoryboard({ mode: 'ad', product: 'Sunlit pear', benefit: 'A cold pear that stays crisp in the sun.', model: 'grok' })
  assert.doesNotMatch(ad.shots.map(shot => shot.action).join('\n'), /The want is clear/)
  assert.equal(ad.shots.every(shot => shot.prompt.includes('Sunlit pear')), true)
  const series = parseSeries({ series: { title: 'Morning shift', hook: 'The same barista opens the same cafe.', episodes: 3 } })
  assert.equal(series.shots.length, 9)
})

test('overwritePrompt regenerates a posted agent board and otherwise keeps the edit', () => {
  const board = createStoryboard({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon before the boats arrive.', count: 2 })
  board.shots[0].prompt = 'HAND EDITED'
  board.shots[0].promptEdited = true
  const exported = exportAgentBoard(board)
  const kept = importAgentBoard(exported)
  assert.equal(kept.shots[0].prompt, 'HAND EDITED')
  assert.equal(kept.shots[0].promptEdited, true)
  const replaced = importAgentBoard(exported, { overwritePrompt: true })
  assert.equal(replaced.shots[0].promptEdited, undefined)
  assert.doesNotMatch(replaced.shots[0].prompt, /HAND EDITED/)
  assert.match(replaced.shots[0].prompt, /Idea:/)
  const response = dispatchAgentRequest({
    method: 'POST', pathname: '/api/v1/storyboard', origin: 'https://moovicut.studio',
    body: JSON.stringify({ ...exported, overwritePrompt: true })
  })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.body)
  assert.notEqual(body.shots[0].prompt, 'HAND EDITED')
})

test('the rate limit uses X-Real-IP and ignores X-Forwarded-For', async () => {
  assert.equal(clientAddress({ 'x-real-ip': '203.0.113.8', 'x-forwarded-for': '1.2.3.4, 198.51.100.1' }), '203.0.113.8')
  assert.equal(clientAddress({ 'x-forwarded-for': '1.2.3.4, 198.51.100.1' }, '203.0.113.8'), '203.0.113.8')
  assert.equal(clientAddress({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4' }), '203.0.113.9')
  const directory = mkdtempSync(join(tmpdir(), 'moovicut-xff-'))
  const server = createProdServer({ staticRoot: directory, limiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) })
  const base = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
  function once(path, realIp, forwarded) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, base)
      const body = JSON.stringify({ premise: 'A lighthouse keeper races the dusk to repair a failing beacon.' })
      const headers = { 'x-real-ip': realIp, 'x-forwarded-for': forwarded, connection: 'close' }
      if (!path.endsWith('/mcp')) {
        headers['content-type'] = 'application/json'
        headers['content-length'] = Buffer.byteLength(body)
      }
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: path.endsWith('/mcp') ? 'GET' : 'POST', headers
      }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)) })
      req.on('error', reject)
      if (!path.endsWith('/mcp')) req.write(body)
      req.end()
    })
  }
  try {
    assert.equal(await once('/api/v1/storyboard', '203.0.113.50', '8.8.8.8, 198.51.100.1'), 200)
    assert.equal(await once('/api/v1/storyboard', '203.0.113.50', '9.9.9.9, 198.51.100.2'), 200)
    assert.equal(await once('/api/v1/storyboard', '203.0.113.50', '7.7.7.7'), 429)
    assert.equal(await once('/api/v1/storyboard', '203.0.113.51', '203.0.113.50'), 200)
    assert.equal(await once('/mcp', '203.0.113.70', '1.1.1.1'), 200)
    assert.equal(await once('/mcp', '203.0.113.70', '2.2.2.2, 198.51.100.9'), 200)
    assert.equal(await once('/mcp', '203.0.113.70', '3.3.3.3'), 429)
    assert.equal(await once('/mcp', '203.0.113.71', '203.0.113.70'), 200)
  } finally {
    server.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the studio copy matches the fixes', () => {
  const creation = readFileSync('app/components/StudioCreationPanel.vue', 'utf8')
  const scenario = readFileSync('app/components/StudioScenario.vue', 'utf8')
  const fields = readFileSync('app/components/StudioPresetFields.vue', 'utf8')
  const header = readFileSync('app/components/WorkspaceHeader.vue', 'utf8')
  const css = readFileSync('app/assets/css/main.css', 'utf8')
  const faq = readFileSync('app/pages/faq.vue', 'utf8')
  const home = readFileSync('app/pages/index.vue', 'utf8')
  assert.match(creation, /Agent JSON copied\./)
  assert.match(creation, /restorePromptUndo/)
  assert.match(creation, /durationPlans/)
  assert.match(creation, /studio-risk-summary/)
  assert.match(creation, /studio-soft-hint/)
  assert.doesNotMatch(scenario, /studio-scenario-example/)
  assert.match(scenario, /Scene 1 — Lea — Cafe/)
  assert.match(scenario, /scheduleDetect/)
  assert.match(scenario, /props\.total/)
  assert.match(fields, /9 shots|episodes, \{\{/)
  assert.match(fields, /touched\.value && !props\.reveal/)
  assert.match(css, /--display:"Space Grotesk"/)
  assert.match(css, /\.studio-shell \.workspace-nav-button \{ display:none/)
  assert.match(header, /aria-controls="mobile-workspace-menu"/)
  assert.match(faq, /eight prompt targets/)
  assert.doesNotMatch(faq, /button-primary" href="https:\/\/buymeacoffee\.com/)
  assert.match(faq, /persistent volume/)
  assert.match(home, /v-for="item in MODEL_OPTIONS"/)
})
