// Tests for void/voice.js. Run: node tests/void-voice.test.js (no dependencies).
const assert = require('assert')
const V = require('../void/voice.js')
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name) }
const seq = xs => { let i = 0; return () => xs[i++ % xs.length] }
const day = new Date(2026, 10, 17, 14, 0) // 2pm local

t('60 brief lines + 8 originals all present, no duplicates', () => {
  const all = Object.values(V.LINES).flat()
  assert.strictEqual(new Set(all).size, all.length)
  assert.strictEqual(V.LINES.legendary.length, 10)
  assert.strictEqual(V.LINES.common.length + V.LINES.uncommon.length + V.LINES.rare.length, 50 + 14)
  for (const l of ["Your thought is safe here. Unfortunately, so are the other 46.", 'The Void appreciates your contribution to the problem.',
    "I HAVE CONSUMED 10,000 IDEAS AND NOT ONE OF THEM WAS 'GO TO BED.'", 'Your idea has entered the breakdown. BLEGH.'])
    assert(all.includes(l), l)
})
t('tier weights are 65/25/9/1', () => {
  assert.deepStrictEqual(V.TIERS.map(x => x[1]), [65, 25, 9, 1])
  assert.strictEqual(V.rollTier(0), 'common'); assert.strictEqual(V.rollTier(.6499), 'common')
  assert.strictEqual(V.rollTier(.65), 'uncommon'); assert.strictEqual(V.rollTier(.8999), 'uncommon')
  assert.strictEqual(V.rollTier(.90), 'rare'); assert.strictEqual(V.rollTier(.9899), 'rare')
  assert.strictEqual(V.rollTier(.99), 'legendary'); assert.strictEqual(V.rollTier(.999999), 'legendary')
})
t('every line in every tier is reachable', () => {
  const tierR = { common: .1, uncommon: .7, rare: .95, legendary: .995 }
  for (const [tier, list] of Object.entries(V.LINES)) list.forEach((line, i) => {
    const p = V.pick({ now: day }, seq([tierR[tier], (i + .5) / list.length]))
    assert.strictEqual(p.tier, tier); assert.strictEqual(p.text, line)
  })
})
t('distribution over a seeded run is close to 65/25/9/1', () => {
  let s = 42; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const c = { common: 0, uncommon: 0, rare: 0, legendary: 0 }, N = 200000
  for (let i = 0; i < N; i++) c[V.pick({ now: day }, rnd).tier]++
  for (const [k, w] of V.TIERS) assert(Math.abs(c[k] / N * 100 - w) < 0.5, k + ' ' + c[k] / N)
})
t('never the same line twice in a row', () => {
  const first = V.LINES.common[0]
  const p = V.pick({ now: day, last: first }, seq([.1, 0]))
  assert.notStrictEqual(p.text, first)
  let last = null
  for (let i = 0; i < 2000; i++) { const q = V.pick({ now: day, last }); assert.notStrictEqual(q.text, last); last = q.text }
})
t('burst: previous idea under 3 minutes ago', () => {
  assert.deepStrictEqual(V.contextOf(new Date(day - 60e3).toISOString(), day), ['burst'])
  assert.deepStrictEqual(V.contextOf(new Date(day - 4 * 60e3).toISOString(), day), [])
  const p = V.pick({ prevAt: new Date(day - 30e3).toISOString(), now: day }, seq([.1, 0, 0]))
  assert.strictEqual(p.tier, 'context'); assert.strictEqual(p.context, 'burst'); assert(V.CONTEXT.burst.includes(p.text))
})
t('context is occasional: above the chance it falls back to rarity', () => {
  const p = V.pick({ prevAt: new Date(day - 30e3).toISOString(), now: day }, seq([.5, .1, 0]))
  assert.strictEqual(p.tier, 'common')
})
t('night: 23:00 to 04:59 local', () => {
  for (const h of [23, 0, 2, 4]) assert(V.contextOf(null, new Date(2026, 10, 17, h, 30)).includes('night'), h)
  for (const h of [5, 12, 22]) assert(!V.contextOf(null, new Date(2026, 10, 17, h, 30)).includes('night'), h)
  const p = V.pick({ now: new Date(2026, 10, 17, 1, 0) }, seq([.1, 0, 0]))
  assert.strictEqual(p.context, 'night')
})
t('return: previous idea more than 60 days old', () => {
  assert.deepStrictEqual(V.contextOf(new Date(day - 90 * 86400e3).toISOString(), day), ['return'])
  assert.deepStrictEqual(V.contextOf(new Date(day - 10 * 86400e3).toISOString(), day), [])
})
t('no previous idea / bad date: plain rarity, no crash', () => {
  assert.deepStrictEqual(V.contextOf(null, day), []); assert.deepStrictEqual(V.contextOf('nope', day), [])
  assert(V.pick({}).text)
})
console.log(n + ' tests passed')
