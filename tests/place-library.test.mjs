import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectProse } from '../app/utils/prose-detect.js'
import { placeLibraryCounts, placeLibraryLanguages, placeTag } from '../app/utils/place-lexicon.js'

const data = JSON.parse(readFileSync(new URL('../app/data/place-lexicon.json', import.meta.url), 'utf8'))
const audit = JSON.parse(readFileSync(new URL('../app/data/place-audit.json', import.meta.url), 'utf8'))

function fold(value) {
  return String(value || '').trim().toLowerCase().replace(/’/g, "'")
}

test('the place library covers the six site languages and records its sources', () => {
  assert.deepEqual(placeLibraryLanguages().sort(), ['en', 'fr', 'it', 'ja', 'pt', 'zh-Hans'])
  for (const language of placeLibraryLanguages()) {
    const count = placeLibraryCounts()[language]
    assert.ok(count.total >= 200, `${language} ${count.total}`)
    assert.ok(count.sure > 0 && count.ambiguous > 0, language)
  }
  assert.match(data.license, /WordNet/)
  assert.doesNotMatch(data.license, /OdeNet/)
  assert.match(data.license, /CC BY-SA/)
  assert.match(data.attribution, /Bond/)
})

test('every library word that is also a name, object, material, adjective, or garment is not a sure place, and a determiner is not a place', () => {
  const failures = []
  const suffixes = {
    en: ['sweater', 'pullover', 'jacket', 'blouse', 'scarf', 'apron', 'turtleneck'],
    fr: ['manteau', 'écharpe', 'echarpe'],
    it: ['maglione', 'giacca', 'cappotto', 'sciarpa'],
    pt: ['camisola', 'casaco', 'jaqueta', 'cachecol']
  }
  for (const [kind, lists] of Object.entries(audit)) {
    if (kind === 'note') continue
    for (const [language, words] of Object.entries(lists)) {
      const table = data.tags[language] || {}
      for (const word of words) {
        const key = language === 'ja' || language === 'zh-Hans' ? word : fold(word)
        const tag = table[key]
        if (kind === 'determiners') {
          if (tag) failures.push(`${language} determiner ${key} ${tag}`)
          continue
        }
        if (tag && !String(tag).startsWith('a:')) failures.push(`${language} ${kind} ${key} ${tag}`)
      }
    }
  }
  for (const [language, list] of Object.entries(suffixes)) {
    for (const [lemma, tag] of Object.entries(data.tags[language] || {})) {
      if (tag === 's' && list.some(suffix => lemma.endsWith(suffix) && lemma.length > suffix.length)) failures.push(`${language} garment ${lemma}`)
    }
  }
  assert.equal(placeTag('fr', 'son'), '')
  assert.notEqual(placeTag('en', 'shallow'), 's')
  assert.notEqual(placeTag('en', 'narrow'), 's')
  assert.notEqual(placeTag('en', 'stairs'), 's')
  assert.deepEqual(failures, [])
})

test('a sure place counts without a locative, and an ambiguous one needs the frame', () => {
  const sure = detectProse('The kitchen is quiet. Nia waits.')
  assert.ok(sure.places.some(place => /kitchen/i.test(place.name)))
  assert.equal(placeTag('en', 'kitchen'), 's')
  const bank = detectProse('The bank is quiet. Nia waits. Nia waits in the bank.')
  assert.equal(placeTag('en', 'bank').startsWith('a:'), true)
  assert.equal(bank.scenes[0].where, '')
  assert.match(bank.scenes.at(-1).where, /bank/i)
})

test('a scene place stays until a new locative sentence replaces it', () => {
  const found = detectProse('Nia waits in the kitchen. The greenhouse is quiet. Nia waits in the greenhouse.')
  assert.deepEqual(found.scenes.map(scene => scene.where), ['Kitchen', 'Kitchen', 'Greenhouse'])
})

test('a held noun does not become the place, in English and in French', () => {
  const english = detectProse('Nia takes the greenhouse in the kitchen. Nia waits.')
  assert.deepEqual(english.places.map(place => place.name), ['Kitchen'])
  const french = detectProse('Apolline prend la serre dans la rue. Apolline attend.')
  assert.equal(french.places.some(place => /serre/i.test(place.name)), false)
  assert.ok(french.places.some(place => /rue/i.test(place.name)))
})

test('a person name wins over a place word', () => {
  const found = detectProse('Park, 40, grey beard, brown coat, waits in the kitchen. Park reads.')
  assert.ok(found.characters.some(person => person.name === 'Park'))
  assert.equal(found.places.some(place => place.name === 'Park'), false)
  assert.ok(found.scenes.every(scene => /kitchen/i.test(scene.where)))
})

test('each site language reads a locative place from the library', () => {
  const cases = [
    ['en', 'Nia waits in the greenhouse. Nia reads.', /greenhouse/i],
    ['fr', 'Apolline, 40, cheveux courts, manteau gris, attend dans la serre. Apolline lit.', /serre/i],
    ['pt', 'Rui, 40, barba grisalha, casaco azul, espera na cozinha. Ele lê uma carta.', /cozinha/i],
    ['it', 'Giulia, 29, capelli neri, cappotto blu, aspetta nella cucina. Giulia legge.', /cucina/i],
    ['ja', '美咲は台所で待つ。美咲は手紙を読む。', /台所/],
    ['zh-Hans', '赵明远在厨房等待。赵明远拿着一封信。', /厨房/]
  ]
  for (const [language, text, place] of cases) {
    const found = detectProse(text)
    assert.equal(found.language, language, text)
    assert.ok(found.places.some(item => place.test(item.name)), `${language} ${found.places.map(item => item.name).join(', ')}`)
    assert.ok(found.scenes.every(scene => place.test(scene.where)), `${language} ${found.scenes.map(scene => scene.where).join(' > ')}`)
  }
})
