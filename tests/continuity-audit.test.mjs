import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dispatchAgentRequest } from '../server/agent-api.mjs'
import { translate } from '../app/i18n/index.js'

function plan(body) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    body: JSON.stringify(body)
  })
  return { status: response.status, body: JSON.parse(response.body) }
}

function mcp(name, args) {
  const response = dispatchAgentRequest({
    method: 'POST',
    pathname: '/mcp',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  })
  const payload = JSON.parse(response.body)
  return JSON.parse(payload.result.content[0].text)
}

function line(prompt, prefix) {
  return (prompt || '').split('\n').find(item => item.startsWith(prefix)) || ''
}

function lock(prompt, name) {
  const pattern = new RegExp(`(?<![\\p{L}])${name}(?![\\p{L}])`)
  return (prompt || '').split('\n').find(item => pattern.test(item) && (item.includes(' — ') || item.startsWith(`${name}.`))) || ''
}

test('mid-sentence names lock Caio and Lia, Renata and Lia, and Rui as o pai', () => {
  const help = plan({
    input: 'prose',
    prose: 'Caio Moura, 46 anos, cabelo preto liso até aos ombros, camiseta vermelha, facão à cintura, espera no barco. Lia Ferreira, 22 anos, cabelo azul, impermeável azul, um caderno, espera. Caio ajuda Lia a levantar-se.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(help.status, 200, help.body.message)
  const helped = help.body.shots.find(shot => /Caio ajuda Lia a levantar-se/.test(shot.prompt))
  assert.match(lock(helped.prompt, 'Caio'), /camiseta vermelha/)
  assert.match(lock(helped.prompt, 'Lia'), /cabelo azul/)
  assert.match(lock(helped.prompt, 'Lia'), /impermeável azul/)
  assert.match(lock(helped.prompt, 'Lia'), /caderno/)
  const forehead = plan({
    input: 'prose',
    prose: 'Renata Lopes, 38 anos, cabelo crespo curto, camisa caqui, binóculos ao pescoço, espera no barco. Lia Ferreira, 22 anos, cabelo azul, impermeável azul, um caderno, espera. Renata põe a mão na testa de Lia.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const touched = forehead.body.shots.find(shot => /Renata põe a mão na testa de Lia/.test(shot.prompt))
  assert.match(lock(touched.prompt, 'Renata'), /camisa caqui/)
  assert.match(lock(touched.prompt, 'Lia'), /cabelo azul/)
  assert.match(lock(touched.prompt, 'Lia'), /caderno/)
  const dance = plan({
    input: 'prose',
    prose: 'Marta Costa, 28 anos, cabelo preto curto, impermeável amarelo, botas de borracha, espera na taberna. Rui Costa, 55 anos, barba grisalha, casaco castanho, é o pai de Marta. Marta dança com o pai.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const step = dance.body.shots.find(shot => /Marta dança com o pai/.test(shot.prompt))
  assert.match(lock(step.prompt, 'Marta'), /impermeável amarelo/)
  assert.match(lock(step.prompt, 'Rui'), /casaco castanho/)
})

test('a later description fills the sheet from the first shot', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Joe waits on the helipad. Joe waves. Joe Hale, 40, short grey hair, green jacket, checks the fuel.',
    model: 'grok',
    compact: true
  })
  assert.equal(planned.status, 200, planned.body.message)
  const first = planned.body.shots.find(shot => /Joe waits on the helipad/.test(shot.prompt))
  assert.match(lock(first.prompt, 'Joe'), /40/)
  assert.match(lock(first.prompt, 'Joe'), /short grey hair/)
  assert.match(lock(first.prompt, 'Joe'), /green jacket/)
  const portuguese = plan({
    input: 'prose',
    prose: 'Lia acena no cais. Lia caminha. Lia, 22 anos, cabelo azul, impermeável azul, um caderno, fotografa o rio.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const opening = portuguese.body.shots.find(shot => /Lia acena no cais/.test(shot.prompt))
  assert.match(lock(opening.prompt, 'Lia'), /22 anos/)
  assert.match(lock(opening.prompt, 'Lia'), /cabelo azul/)
  assert.match(lock(opening.prompt, 'Lia'), /impermeável azul/)
  assert.match(lock(opening.prompt, 'Lia'), /caderno/)
})

test('a name with no sheet warns instead of guessing a lock', () => {
  const prose = 'Lia Ferreira, 22 anos, cabelo azul, impermeável azul, um caderno, espera no cais. Lya acena. Lia acena. Early waits on the quay.'
  const planned = plan({ input: 'prose', prose, model: 'grok', format: 'agent', promptLanguage: 'pt' })
  assert.equal(planned.status, 200, planned.body.message)
  const warning = planned.body.warnings.find(item => item.code === 'name_without_sheet' && item.name === 'Lya')
  assert.ok(warning, JSON.stringify(planned.body.warnings))
  assert.ok(Array.isArray(warning.scenes) && warning.scenes.length >= 1)
  assert.equal(warning.did_you_mean, 'Lia Ferreira')
  assert.equal((planned.body.warnings || []).some(item => item.code === 'name_without_sheet' && item.name === 'Early'), false)
  const guessed = planned.body.shots.find(shot => /Lya acena/.test(shot.prompt))
  assert.equal(lock(guessed.prompt, 'Lia'), '')
  const tool = mcp('plan_storyboard', { input: 'prose', prose, model: 'grok', format: 'agent', promptLanguage: 'pt', compact: false })
  assert.equal(tool.warnings.some(item => item.code === 'name_without_sheet' && item.name === 'Lya' && item.did_you_mean === 'Lia Ferreira'), true)
  const validated = mcp('validate_storyboard', { storyboard: planned.body })
  assert.equal(validated.ok, true)
  assert.equal(validated.warnings.some(item => item.code === 'name_without_sheet' && item.name === 'Lya'), true)
})

test('Iracema canta baixinho keeps the colar', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Dona Iracema tem setenta anos, cabelo branco comprido, vestido estampado e um colar. Iracema espera na varanda. Iracema canta baixinho.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const sung = planned.body.shots.find(shot => /Iracema canta baixinho/.test(shot.prompt))
  assert.match(lock(sung.prompt, 'Iracema'), /colar/)
  assert.match(lock(sung.prompt, 'Iracema'), /vestido estampado/)
  const given = plan({
    input: 'prose',
    prose: 'Dona Iracema, 70 anos, cabelo branco comprido, vestido estampado, espera na varanda. Jorge dá o colar a Iracema. Iracema canta baixinho.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  const later = given.body.shots.find(shot => /Iracema canta baixinho/.test(shot.prompt))
  assert.match(lock(later.prompt, 'Iracema'), /colar/)
})

test('Joe flies low over the ridge stays on the helipad', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Joe Hale, 40, short hair, green jacket, waits on the helipad. Joe checks the plane. Joe flies low over the ridge.',
    model: 'grok',
    compact: true
  })
  assert.equal(planned.status, 200, planned.body.message)
  const flown = planned.body.shots.find(shot => /Joe flies low over the ridge/.test(shot.prompt))
  assert.match(line(flown.prompt, 'PLACE'), /Helipad/i)
  assert.doesNotMatch(line(flown.prompt, 'PLACE'), /Plane/)
  assert.doesNotMatch(line(flown.prompt, 'PLACE'), /Ridge/)
})

test('entra na loja da fábrica keeps the shop on the following beats', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Emma Clarke, 30 anos, cabelo loiro curto, impermeável vermelho, uma câmara fotográfica, espera na fábrica. Na manhã seguinte, Emma Clarke, uma turista de trinta anos, de cabelo loiro curto, impermeável vermelho e uma câmara fotográfica, entra na loja da fábrica. Emma fotografa um azulejo de Rita. Rita embrulha seis azulejos em papel. Odete faz a conta na caixa registadora. Emma paga com cartão. Henrique oferece a Emma um caco pintado. Emma ri.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  const beats = [
    'Emma fotografa um azulejo de Rita',
    'Rita embrulha seis azulejos em papel',
    'Odete faz a conta na caixa registadora',
    'Emma paga com cartão',
    'Henrique oferece a Emma um caco pintado',
    'Emma ri'
  ]
  for (const beat of beats) {
    const shot = planned.body.shots.find(item => item.prompt.includes(beat))
    assert.ok(shot, beat)
    assert.match(line(shot.prompt, 'PLACE'), /loja/i, beat)
    assert.doesNotMatch(line(shot.prompt, 'PLACE'), /PLACE: Fábrica/i, beat)
  }
})

test('boat beats keep the barco', () => {
  const planned = plan({
    input: 'prose',
    prose: 'Renata Lopes, 38 anos, cabelo crespo curto, camisa caqui, binóculos ao pescoço, espera no cais. Lia Ferreira, 22 anos, cabelo azul, impermeável, caderno, espera. Caio Moura, 46 anos, cabelo preto, camiseta vermelha, facão, espera. Renata sobe para o barco. Renata observa as aves com os binóculos. Lia anota as espécies no caderno. Lia fotografa um boto. Caio aponta para a margem.',
    model: 'grok',
    compact: true,
    promptLanguage: 'pt'
  })
  assert.equal(planned.status, 200, planned.body.message)
  for (const beat of ['Renata observa as aves com os binóculos', 'Lia anota as espécies no caderno', 'Lia fotografa um boto', 'Caio aponta para a margem']) {
    const shot = planned.body.shots.find(item => item.prompt.includes(beat))
    assert.ok(shot, beat)
    assert.match(line(shot.prompt, 'PLACE'), /Barco/i, beat)
  }
})

test('the studio notice offers create sheet and ignore in English and Portuguese', () => {
  const notice = readFileSync('app/components/NameSheetNotice.vue', 'utf8')
  assert.match(notice, /Create sheet/)
  assert.match(notice, /Not a name, ignore/)
  assert.match(notice, /name_without_sheet/)
  assert.match(readFileSync('app/components/StudioCreationPanel.vue', 'utf8'), /NameSheetNotice/)
  assert.match(readFileSync('app/components/StudioEditor.vue', 'utf8'), /NameSheetNotice/)
  assert.match(readFileSync('app/components/StudioWizard.vue', 'utf8'), /NameSheetNotice/)
  assert.equal(translate('pt', 'Create sheet'), 'Criar ficha')
  assert.equal(translate('pt', 'Not a name, ignore'), 'Não é um nome, ignorar')
  assert.match(translate('pt', '{name} is named in the story and has no character sheet.', { name: 'Lya' }), /Lya/)
  assert.match(translate('pt', '{name} is named in the story and has no character sheet.', { name: 'Lya' }), /ficha/)
})
