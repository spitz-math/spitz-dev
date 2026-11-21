// A task with no owner never starts by itself, so the dashboard shows it as Kody's to assign, not as "Queued for Claude".
// Run: node tests/ownerless.test.js  (uses the pre-installed Playwright + Chromium; Supabase is faked).
const assert = require('assert')
const path = require('path')
const { chromium } = require('playwright')

const FAKE = `
const now = new Date().toISOString()
const rows = {
  studio_tasks: [
    { id: 't1', project: 'arcade', title: 'Orphan task', brief: 'b', status: 'open', turn: null, created_by: 'claude_thread', refs: [], version: 1, updated_at: now, created_at: now },
    { id: 't2', project: 'arcade', title: 'Claude task', brief: 'b', status: 'open', turn: 'claude', created_by: 'spitz', refs: [], version: 1, updated_at: now, created_at: now },
    { id: 't3', project: 'arcade', title: 'Old orphan, done', brief: 'b', status: 'done', turn: null, created_by: 'spitz', refs: [], version: 2, updated_at: now, created_at: now }
  ],
  studio_messages: [], studio_assets: [], studio_worker_runs: []
}
const q = t => { const b = { select: () => b, order: () => b, limit: () => b, eq: () => b, neq: () => b, in: () => b, gt: () => b, not: () => b, is: () => b, range: () => b, maybeSingle: () => b,
  then: (res) => res({ data: JSON.parse(JSON.stringify(rows[t] || [])), error: null }) }; return b }
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { email: 'x' } } } }), getUser: async () => ({ data: { user: { email: 'x' } } }), onAuthStateChange: () => {} },
  from: q, channel: () => ({ on() { return this }, subscribe() { return this } }),
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  rpc: async fn => {
    if (fn === 'studio_schema') return { data: { identities: 2, typed_tasks: 1 }, error: null }
    if (fn === 'studio_now') return { data: { tasks: [], health: {} }, error: null }
    return { data: null, error: null }
  } }) }
`

async function open(view) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: FAKE }))
  await page.addInitScript(v => { try { localStorage.setItem('studio_view2', v) } catch (e) {} }, view)
  await page.goto('file://' + path.resolve(__dirname, '../index.html'))
  return { browser, page, errors }
}

;(async () => {
  {
    const { browser, page, errors } = await open('board')
    await page.waitForSelector('.col')
    const where = await page.$$eval('.col', cs => Object.fromEntries(cs.map(c => [c.dataset.k, [...c.querySelectorAll('.card')].map(x => x.dataset.id)])))
    assert.ok(where.spitz.includes('t1'), 'ownerless task sits in Your turn: ' + JSON.stringify(where))
    assert.ok(!where.claude.includes('t1'), 'ownerless task is not in the Claude column')
    assert.ok(where.claude.includes('t2'), 'a real Claude task stays in the Claude column')
    assert.ok(!where.spitz.includes('t3') && !where.claude.includes('t3'), 'a finished ownerless task is not flagged')
    assert.match(await page.$eval('.card[data-id="t1"]', c => c.textContent), /no owner/)
    assert.deepStrictEqual(errors, [])
    await browser.close()
    console.log('ok board: ownerless task is in Your turn, marked "no owner", not queued for Claude')
  }
  {
    const { browser, page, errors } = await open('now')
    await page.waitForFunction(() => /Orphan task/.test(document.getElementById('board').textContent))
    await page.waitForTimeout(300)
    const text = await page.$eval('#board', b => b.textContent)
    assert.match(text, /No owner, so nobody will start it/)
    assert.match(text, /Pick who does it/)
    assert.doesNotMatch(text, /Orphan task[^]*Queued for Claude[^]*Claude task/, 'ownerless task is not described as queued for Claude')
    assert.deepStrictEqual(errors, [])
    await browser.close()
    console.log('ok now: ownerless task is under Needs you with "Pick who does it"')
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
