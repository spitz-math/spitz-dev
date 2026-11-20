// Dashboard with the Phase 2/3 database (migration 20261118010000_typed_tasks_refs_status): ready check,
// picture status (read only: Kody approves art in the Claude thread). Also checks nothing new shows on a Phase 1 database.
// Run: node tests/phase2.test.js   (SHOT=/path.png saves a screenshot of the task drawer)
const assert = require('assert')
const path = require('path')
const { chromium } = require('playwright')

const FAKE = phase => `
window.__calls = []
const P2 = ${phase === 2}
const now = new Date().toISOString()
const SHA = 'a'.repeat(64), SHB = 'b'.repeat(64), SHC = 'c'.repeat(64)
const rows = {
  studio_tasks: [
    { id: 't1', project: 'arcade', title: 'Refine the Lancer', brief: 'b', status: 'open', turn: 'spitz', created_by: 'claude_thread', refs: [], version: 2, updated_at: now, created_at: now, job_type: P2 ? 'refine' : undefined },
    { id: 't2', project: 'arcade', title: 'Plain task', brief: 'b', status: 'open', turn: 'spitz', created_by: 'spitz', refs: [], version: 1, updated_at: now, created_at: now }
  ],
  studio_messages: [],
  studio_assets: [
    { id: 'a1', task_id: 't1', file_name: 'lancer_a.png', width: 64, height: 64, size_bytes: 10, path: 'x/a1.png', created_at: now, status: 'draft', sha256: SHA },
    { id: 'a2', task_id: 't1', file_name: 'lancer_b.png', width: 64, height: 64, size_bytes: 10, path: 'x/a2.png', created_at: now, status: 'approved', sha256: SHB },
    { id: 'a3', task_id: 't1', file_name: 'lancer_c.png', width: 64, height: 64, size_bytes: 10, path: 'x/a3.png', created_at: now, status: 'ready', sha256: SHC }
  ],
  studio_validations: [
    { id: 3, asset_id: 'a2', sha256: SHB, result: 'PASS' },
    { id: 2, asset_id: 'a1', sha256: SHA, result: 'FAIL' },
    { id: 1, asset_id: 'a3', sha256: SHC, result: 'PASS' }
  ],
  studio_worker_runs: []
}
const q = t => { const b = { select: () => b, order: () => b, limit: () => b, eq: () => b, in: () => b, gt: () => b,
  then: (res) => res({ data: JSON.parse(JSON.stringify(rows[t] || [])), error: null }) }; return b }
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { email: 'x' } } } }), getUser: async () => ({ data: { user: { email: 'x' } } }) },
  from: q,
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  rpc: async (fn, args) => {
    window.__calls.push({ fn, args })
    if (fn === 'studio_schema') return { data: P2 ? { identities: 2, typed_tasks: 1, asset_status: 1 } : { identities: 2 }, error: null }
    if (fn === 'studio_task_readiness') return args.p_task_id === 't1'
      ? { data: { ready: false, job_type: 'refine', missing: ['a required "source" reference (the image a refine job starts from)', 'a spec (what the validator checks) for this refine job'], required_refs: [] }, error: null }
      : { data: { ready: true, job_type: null, missing: [], required_refs: [] }, error: null }
    if (fn === 'studio_review_asset') { const a = rows.studio_assets.find(x => x.id === args.p_asset_id); a.status = args.p_verdict === 'approved' ? 'approved' : 'failed'; return { data: { status: a.status }, error: null } }
    if (fn === 'studio_mark_ready') return { data: null, error: { message: 'Not ready: needs the newest validation of this exact file to be PASS (now: FAIL) and spitz\\'s approval of it (now: approved).' } }
    if (fn === 'studio_now') return { data: { tasks: [], health: {} }, error: null }
    if (fn === 'studio_task_activity') return { data: [], error: null }
    return { data: null, error: null }
  } }) }
`

async function run(phase) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: FAKE(phase) }))
  await page.addInitScript(() => { try { localStorage.setItem('studio_view2', 'board') } catch (e) {} })
  await page.goto('file://' + path.resolve(__dirname, '../index.html'))
  await page.waitForSelector('.col')
  await page.click('.card[data-id="t1"]')
  await page.waitForSelector('.compose .btn')
  await page.waitForTimeout(200)
  const r = { errors }
  // the job check is folded into one header button (Nov 20); its details are still in the page
  r.ready = await page.$eval('#drawer', d => (d.querySelector('.rdy') || {}).textContent || '')
  r.job = await page.$eval('#drawer', d => { const j = d.querySelector('details.job'); return j ? { open: j.open, summary: j.querySelector('summary').textContent } : null })
  r.disabled = await page.$$eval('#destination option:disabled', opts => opts.map(o => o.value))
  r.badges = await page.$$eval('.ti', ts => ts.map(t => [...t.querySelectorAll('.badge')].map(b => b.textContent).join('/')))
  r.buttons = await page.$$eval('.ti .rv .btn', bs => bs.length)
  r.tips = await page.$$eval('.ti', ts => ts.map(t => (t.querySelector('.rv .rvl') || {}).textContent || ''))
  if (process.env.SHOT && phase === 2) await page.screenshot({ path: process.env.SHOT })
  if (phase === 2) {
    // a plain task shows no ready box and nothing disabled
    await page.click('#drawer #x'); await page.click('.card[data-id="t2"]'); await page.waitForSelector('.compose .btn'); await page.waitForTimeout(200)
    r.plainReady = await page.$$eval('.rdy', x => x.length)
    r.plainDisabled = await page.$$eval('#destination option:disabled', opts => opts.length)
  }
  r.calls = await page.evaluate(() => window.__calls.map(c => c.fn))
  await browser.close()
  return r
}

;(async () => {
  const p1 = await run(1)
  assert.deepStrictEqual(p1.errors, [])
  assert.strictEqual(p1.ready, '', 'no ready box before Phase 2')
  assert.deepStrictEqual(p1.disabled, [])
  assert(p1.badges.every(b => b === ''), 'no status badges before Phase 2')
  assert(!p1.calls.includes('studio_task_readiness'), 'does not call Phase 2 functions')
  console.log('ok Phase 1 database: nothing new shown, no Phase 2 calls')

  const p2 = await run(2)
  assert.deepStrictEqual(p2.errors, [])
  assert(/Not ready to hand on/.test(p2.ready) && /source/.test(p2.ready) && /spec/.test(p2.ready), 'what is missing is listed')
  assert(/ChatGPT worker can't take this one/.test(p2.ready), 'refine job says the API worker cannot take it')
  assert.deepStrictEqual(p2.job, { open: false, summary: 'Job: refine · Not ready (2 missing)' }, 'job check starts folded, with a one-line summary')
  assert.deepStrictEqual(p2.disabled.sort(), ['chatgpt_chat', 'claude', 'openai_worker'], 'handoffs disabled, note still allowed')
  assert.deepStrictEqual(p2.badges, ['draft/check failed', 'approved/check passed', 'ready/check passed'])
  assert.strictEqual(p2.buttons, 0, 'no approve buttons: Kody approves in the Claude thread')
  assert.deepStrictEqual(p2.tips, ['review & approve', '', ''])
  assert(!p2.calls.includes('studio_review_asset') && !p2.calls.includes('studio_mark_ready'))
  assert.strictEqual(p2.plainReady, 0); assert.strictEqual(p2.plainDisabled, 0)
  console.log('ok Phase 2 database: ready check, picture status (approval happens in the Claude thread)')
})().catch(e => { console.error(e); process.exit(1) })
