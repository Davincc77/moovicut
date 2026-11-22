/** Waitlist store unit tests — Moovicut Long page (lot 8). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWaitlistStore, validEmail } from '../server/waitlist.mjs'

const dir = () => mkdtempSync(join(tmpdir(), 'waitlist-'))

test('validEmail accepts normal and rejects junk', () => {
  assert.equal(validEmail('a@b.co'), true)
  assert.equal(validEmail(' DoriaN.Gray@Example.COM '), true)
  assert.equal(validEmail('no-at.example.com'), false)
  assert.equal(validEmail('a@b'), false)
  assert.equal(validEmail(''), false)
  assert.equal(validEmail('x'.repeat(250) + '@y.com'), false)
})

test('add persists to file, dedupes, lowercases', async () => {
  const file = join(dir(), 'long-waitlist.json')
  let t = 1000
  const store = createWaitlistStore({ filePath: file, now: () => t })
  assert.deepEqual(await store.add('Ada@Example.com'), { ok: true, duplicate: false })
  t += 1000
  assert.deepEqual(await store.add('ada@example.com'), { ok: true, duplicate: true })
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(raw.version, 1)
  assert.deepEqual(raw.emails, ['ada@example.com'])
})

test('memory fallback when path unwritable', async () => {
  const store = createWaitlistStore({ filePath: '/nope-root/inner.json' })
  const r = await store.add('mem@ex.io')
  assert.equal(r.ok, true)
  assert.equal(store.persistent(), false)
  assert.equal(store.total(), 1)
})

test('rate limit: >5 per minute gets 429, clock moves', async () => {
  const file = join(dir(), 'w.json')
  let t = 0
  const store = createWaitlistStore({ filePath: file, now: () => t, perMinute: 5 })
  for (let i = 0; i < 5; i++) assert.equal((await store.add(`p${i}@ex.io`)).ok, true)
  const blocked = await store.add('p99@ex.io')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.status, 429)
  t += 61000
  assert.equal((await store.add('later@ex.io')).ok, true)
})

test('cap 507 when full', async () => {
  const file = join(dir(), 'w2.json')
  let t = 0
  const store = createWaitlistStore({ filePath: file, now: () => t, perMinute: 1000, cap: 2 })
  await store.add('a@ex.io'); t += 1
  await store.add('b@ex.io'); t += 1
  const full = await store.add('c@ex.io')
  assert.equal(full.ok, false)
  assert.equal(full.status, 507)
})

test('corrupt file quarantines, service continues', async () => {
  const file = join(dir(), 'w3.json')
  writeFileSync(file, '{not json')
  const store = createWaitlistStore({ filePath: file })
  const r = await store.add('after@ex.io')
  assert.equal(r.ok, true)
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).emails.length, 1)
})

test('oversized body rejected before parse', async () => {
  const store = createWaitlistStore({ filePath: join(dir(), 'w4.json') })
  assert.equal(store.parseBody('x'.repeat(4000)).status, 413)
  assert.equal(store.parseBody('{"email":"a@b.co"}').email, 'a@b.co')
  assert.equal(store.parseBody('nope{').status, 400)
})
