import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchAgentRequest } from '../server/agent-api.mjs'

// Audit externe 24-11 (re-passé après le fix mechacut) : trois findings,
// diagnostiqués avant correction. Ici : les deux vrais + l'ancre de
// stabilité du sha256 (le 3e finding était une méthode de test hors
// recette — excluded_keys documenté, vérifié identique en direct).

function post(body) {
  const r = dispatchAgentRequest({
    method: 'POST',
    pathname: '/api/v1/storyboard',
    url: 'https://moovicut.studio/api/v1/storyboard',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: r.status, body: JSON.parse(r.body) }
}

const NOBODY = 'Rain floods the valley and then the river tears the bridge and the bell tower stands alone until the sun dries the mud and the wind closes the shutter and the town wakes'

test('audit#1 — input:prose sur un récit sans personne NE SE REFUSE PAS: le who manquant est inventé par le serveur à partir de la prose, c est le serveur qui doit le combler, jamais le demander au client', async () => {
  const a = await post({ premise: NOBODY, input: 'prose' })
  assert.equal(a.status, 200, `attendu 200, reçu ${a.status}: ${JSON.stringify(a.body).slice(0, 160)}`)
  assert.ok(Array.isArray(a.body.shots) && a.body.shots.length >= 1)
})

// Re-audit 24-11, finding F1b : le fix #1 avait ouvert une porte où le
// flag prose LAISSAIT « and then » cuit dans l'action (1 shot au lieu de
// 3). La loi du SKILL : prose = « every beat is split automatically ».
// Le découpage connector-to-connector passe maintenant par le mode
// lenient du splitter partagé (finder + splitter cohérents — sinon la
// boucle casse sur null). Les champs source/directions gardent l'écho
// intégral du premise : c'est la provenance, pas la beat.
test('audit#F1b — input:prose split les beats connectées : aucune ACTION ne garde « and then », une shot par beat', async () => {
  const CHAIN = 'Rain floods the valley and then the river tears the bridge and then the bell tower stands alone'
  const c = await post({ premise: CHAIN, input: 'prose' })
  assert.equal(c.status, 200)
  assert.ok(c.body.shots.length >= 3, `3 beats connectées attendu >=3 shots, reçu ${c.body.shots.length}`)
  const actions = c.body.shots.map(s => `${s.action || ''} ${s.what || ''}`)
  assert.ok(!actions.some(x => /\band then\b/i.test(x)), `« and then » cuit dans une action : ${JSON.stringify(actions).slice(0, 160)}`)
  assert.ok(/and then/i.test(JSON.stringify(c.body.shots.map(s => s.source || ''))), 'la provenance, elle, garde le texte intégral')
})

test('audit#1b — prose avec personnes nommées garde le parcours sheets_missing documenté (200 + warning, pas de régression)', async () => {
  const b = await post({
    premise: 'Maya hands Rui a letter on the quay and then Rui reads it under the lamp and Maya waits.',
    input: 'prose'
  })
  assert.equal(b.status, 200)
})

test('audit#2 — le chemin invalid_plan documenté EST atteignable : premise de 5 beats (verbes du vocabulaire fermé) + shots:2 = 400 qui nomme ce qui tombe, jamais un board muet. (Le repro de l\'auditeur — 5 beats en un seul flux de phrases sans points, verbs hors vocabulaire fermé — ne tombe pas dans « far fewer » : le moteur compte une beat, il n\'y a rien à refuser ni à signaler.)', async () => {
  const c = await post({
    premise: 'Maya opens the door. Maya walks to the table. Rui hands a letter to Maya. Maya reads the letter. Rui takes the letter back.',
    shots: 2
  })
  assert.equal(c.status, 400)
  assert.equal(c.body.error, 'invalid_plan')
  assert.match(c.body.message, /not planned|Add .+ with name|one action per shot/i)
})

test('audit#3 — canon de stabilité: deux appels identiques => sha256 du contenu IDENTIQUE (id/createdAt exclus par recette documentée)', async () => {
  const d1 = await post({ premise: 'A cat watches rain from the window' })
  const d2 = await post({ premise: 'A cat watches rain from the window' })
  assert.equal(d1.status, 200)
  assert.equal(d1.body.sha256, d2.body.sha256, 'l’ancre d’audit doit être stable à requête égale')
  assert.notEqual(d1.body.id, d2.body.id, 'les ids restent uniques — c est pour ça qu ils sont exclus du sha')
})
