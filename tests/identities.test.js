// Dashboard works with the database BEFORE and AFTER migration 20261118000000_worker_identities.
// Run: node tests/identities.test.js  (uses the pre-installed Playwright + Chromium; Supabase is faked).
const assert = require('assert')
const path = require('path')
const { chromium } = require('playwright')

const FAKE = mode => `
window.__calls = []
const OLD = ${mode === 1}
const rows = {
  studio_tasks: OLD ? [
    { id: 't1', project: 'arcade', title: 'Old chatgpt task', brief: 'b', status: 'open', turn: 'chatgpt', created_by: 'kody', refs: [], version: 3, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 't2', project: 'arcade', title: 'Old kody task', brief: 'b', status: 'open', turn: 'kody', created_by: 'claude', refs: [], version: 1, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
  ] : [
    { id: 't1', project: 'arcade', title: 'Worker task', brief: 'b', status: 'open', turn: 'openai_worker', created_by: 'spitz', refs: [], version: 3, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 't2', project: 'arcade', title: 'Mine', brief: 'b', status: 'open', turn: 'spitz', created_by: 'claude_thread', refs: [], version: 1, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 't3', project: 'arcade', title: 'Chat task', brief: 'b', status: 'open', turn: 'chatgpt_chat', created_by: 'claude', refs: [], version: 2, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    { id: 't4', project: 'arcade', title: 'Thread task', brief: 'b', status: 'open', turn: 'claude_thread', created_by: 'claude_thread', refs: [], version: 2, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
  ],
  studio_messages: [{ task_id: 't1', seq: 1, author: OLD ? 'kody' : 'spitz', kind: 'note', body: 'hello', refs: [], set_turn: OLD ? 'chatgpt' : 'openai_worker', created_at: new Date().toISOString() }],
  studio_assets: [], studio_worker_runs: []
}
const q = t => { const b = { select: () => b, order: () => b, limit: () => b, eq: () => b, in: () => b, gt: () => b,
  then: (res) => res({ data: JSON.parse(JSON.stringify(rows[t] || [])), error: null }) }; return b }
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { user: { email: 'x' } } } }), getUser: async () => ({ data: { user: { email: 'x' } } }) },
  from: q,
  storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  rpc: async (fn, args) => {
    window.__calls.push({ fn, args })
    if (fn === 'studio_schema') return OLD ? { data: null, error: { message: 'Could not find the function public.studio_schema' } } : { data: { identities: 2 }, error: null }
    if (fn === 'studio_now') return { data: { tasks: [], health: {} }, error: null }
    if (fn === 'studio_task_activity') return { data: [], error: null }
    if (fn === 'studio_post_message') return { data: { duplicate: false }, error: null }
    return { data: null, error: null }
  } }) }
`

async function run(mode) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: FAKE(mode) }))
  await page.addInitScript(() => { try { localStorage.setItem('studio_view2', 'board') } catch (e) {} })
  await page.goto('file://' + path.resolve(__dirname, '../index.html'))
  await page.waitForSelector('.col')
  const cols = await page.$$eval('.col', cs => Object.fromEntries(cs.map(c => [c.dataset.k, c.querySelectorAll('.card').length])))
  const schemes = await page.evaluate(() => IDV)
  if (process.env.SHOT && mode === 2) await page.screenshot({ path: process.env.SHOT })
  const colours = await page.$$eval('.card', cs => Object.fromEntries(cs.map(c => [c.dataset.id, [...c.classList].find(x => x.startsWith('who-'))])))
  // new-task form: nothing that starts a run is picked by default, and an empty choice cannot be submitted
  await page.click('#new')
  await page.waitForSelector('#nf')
  const firstPick = await page.$eval('#nw', s => s.value)
  await page.fill('#np', 'arcade'); await page.fill('#nt', 't'); await page.fill('#nb', 'b')
  await page.click('#nf button[type=submit]')
  await page.waitForTimeout(300)
  const createdWithoutChoice = await page.evaluate(() => window.__calls.some(c => c.fn === 'studio_create_task'))
  await page.click('#drawer #x')
  // open the worker task and hand it to the worker from the drawer
  await page.click('.card[data-id="t1"]')
  await page.waitForSelector('.compose .btn')
  const buttons = await page.$$eval('#destination option', opts => opts.map(o => o.value))
  await page.fill('#body','worker task draft')
  await page.click('#drawer #x'); await page.click('.card[data-id="t2"]')
  await page.waitForSelector('#body')
  assert.strictEqual(await page.inputValue('#body'), '', 'other task starts with its own composer')
  await page.click('#drawer #x'); await page.click('.card[data-id="t1"]')
  await page.waitForSelector('#body')
  assert.strictEqual(await page.inputValue('#body'), 'worker task draft', 'original draft is restored')
  await page.selectOption('#destination','openai_worker')
  const workerBtn = await page.$eval('#send-action', b => b.className)
  await page.fill('#body', 'go')
  await page.click('#send-action')
  await page.waitForFunction(() => window.__calls.some(c => c.fn === 'studio_post_message'))
  const sent = await page.evaluate(() => window.__calls.filter(c => c.fn === 'studio_post_message').map(c => c.args.p_set_turn))
  const drawerText = await page.$eval('#drawer', d => d.innerText)
  await browser.close()
  return { cols, schemes, buttons, sent, errors, drawerText, colours, firstPick, createdWithoutChoice, workerBtn }
}

;(async () => {
  const old = await run(1)
  assert.deepStrictEqual(old.errors, [], 'no page errors (old database)')
  assert.strictEqual(old.schemes, 1)
  assert.deepStrictEqual(old.cols, { spitz: 1, chatgpt: 1, claude: 0, done: 0 })
  assert(!old.buttons.includes('chatgpt_chat'), 'no chat-only handoff before the migration')
  assert.deepStrictEqual(old.sent, ['chatgpt'], 'old database receives its own value')
  assert(old.drawerText.includes('You'), 'old kody author shows as You')
  console.log('ok old database: board, buttons, writes in old values')

  const neu = await run(2)
  assert.deepStrictEqual(neu.errors, [], 'no page errors (new database)')
  assert.strictEqual(neu.schemes, 2)
  assert.deepStrictEqual(neu.cols, { spitz: 1, chatgpt: 2, claude: 1, done: 0 })
  assert(neu.buttons.includes('chatgpt_chat') && neu.buttons.includes('openai_worker'), 'both ChatGPT handoffs offered')
  assert.deepStrictEqual(neu.sent, ['openai_worker'])
  assert.strictEqual(neu.colours.t1, 'who-gptw', 'ChatGPT worker card is blue')
  assert.strictEqual(neu.colours.t3, 'who-chatgpt', 'ChatGPT chat card is cyan')
  assert(/\bgptw\b/.test(neu.workerBtn), 'worker button is blue')
  for (const r of [old, neu]) { assert.strictEqual(r.firstPick, '', 'no default for who goes first'); assert(!r.createdWithoutChoice, 'cannot create without choosing') }
  console.log('ok new database: five identities, separate chat and worker handoffs')
})().catch(e => { console.error(e); process.exit(1) })
