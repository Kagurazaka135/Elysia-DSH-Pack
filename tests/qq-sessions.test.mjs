// A/B 层模拟检查；不启动 dsh、NapCat，不调用模型，不代替维护者 C/D/E 验收。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const scratch = join(root, '.tmp', 'modpack', 'qq-tests')
fs.mkdirSync(scratch, { recursive: true })
const source = fs.readFileSync(join(root, 'mods/qq/plugin/lib/index.js'), 'utf8')
const imports = source.replace(/^import .* from '@deepseek-ai\/[^']+'\r?\n/gm, '')
const prelude = `
const schema = new Proxy(function(){}, {get:()=>schema,apply:()=>schema});
const z = schema, SessionId = value=>value, defineTool = value=>value, createUserMessage = value=>value;
const installModelSelection = agentCtx => { agentCtx.modelSelectionInstalled = true };
`
const plugin = await import('data:text/javascript;base64,' + Buffer.from(prelude + imports).toString('base64'))

function fixture() {
  const dir = fs.mkdtempSync(join(scratch, 'case-'))
  const auth = join(dir, 'auth.json')
  fs.writeFileSync(auth, JSON.stringify({ inject_token: 'test-token', allowed_users: ['test-user', 'other-user'] }))
  return { dir, auth, store: join(dir, 'tasks', 'qq-sessions.json') }
}

function host(f, { persistence = true, resumeError, config = {}, failPresets = [] } = {}) {
  const routes = new Map(), tools = new Map(), events = new Map(), cleanups = []
  const creates = [], resumes = [], handles = [], warnings = [], mounts = []
  async function handle(options, sessionId) {
    const agentCtx = { guards: [], tools: { guard(fn) { agentCtx.guards.push(fn) } } }
    await options.setup(agentCtx)
    assert.equal(agentCtx.modelSelectionInstalled, true)
    const h = { agent: { session: { id: sessionId }, followup() {} }, agentCtx, disposed: false, dispose() { h.disposed = true } }
    handles.push(h)
    return h
  }
  const ctx = {
    logger: { info() {}, warn(message) { warnings.push(message) }, error() {} },
    get: name => name === 'sessionPersistence' && persistence ? {} : undefined,
    agentDefaultModel: { currentSelection: () => ({ provider: 'test', model: 'test' }) },
    agentPresets: { async mount(_ctx, preset) { mounts.push(preset); if (failPresets.includes(preset)) throw new Error('test missing preset') } },
    agents: {
      async create(options) { creates.push(options); return handle(options, options.sessionId) },
      async resume(options) {
        resumes.push(options)
        if (resumeError) throw Object.assign(new Error('test resume failure'), { name: resumeError })
        return handle(options, options.resumeSessionId)
      },
    },
    tools: { register(tool) { tools.set(tool.name, tool) } },
    on(event, callback) { events.set(event, callback) },
    webServer: { register(route) { routes.set(route.path, route.handler); return () => {} } },
    effect(fn) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup) },
  }
  plugin.apply(ctx, {
    token: '', configPath: f.auth, allowedUsers: '', agentPreset: 'elysia', cwd: f.dir,
    sessionStorePath: '', blockedTools: '', maxBodyBytes: 65536, replyBuffer: 500, ...config,
  })
  async function call(path, data, query = '') {
    const req = { method: data ? 'POST' : 'GET', url: path + query, resume() {}, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(data)) } }
    const res = { setHeader() {}, end(body) { this.body = body ? JSON.parse(body) : undefined } }
    await routes.get(path)(req, res)
    return res
  }
  return {
    creates, resumes, handles, warnings, mounts, tools, events,
    inject: (data = {}) => call('/api/qq/inject', { userId: 'test-user', text: 'test', token: 'test-token', ...data }),
    replies: since => call('/api/qq/replies', null, `?token=test-token&since=${since ?? 0}`),
    dispose: async () => { for (const cleanup of cleanups) await cleanup() },
  }
}

test('simulated restart resumes the mapped ID and preserves other entries through disposal', async () => {
  const f = fixture(), first = host(f)
  assert.equal((await first.inject()).statusCode, 200)
  await first.inject({ userId: 'other-user' })
  const stored = fs.readFileSync(f.store, 'utf8')
  await first.dispose()
  assert(first.handles.every(h => h.disposed))
  assert.equal(fs.readFileSync(f.store, 'utf8'), stored)
  const second = host(f)
  const response = await second.inject()
  assert.equal(response.body.sessionId, JSON.parse(stored).sessions['qq-test-user'])
  assert.equal(second.resumes.length, 1)
  assert.equal(second.creates.length, 0)
  assert.deepEqual(JSON.parse(fs.readFileSync(f.store)), JSON.parse(stored))
})

test('resume errors warn by type and create a fresh ID with exactly the same setup', async () => {
  for (const name of ['SessionNotFoundError', 'SessionAlreadyOwnedError', 'SessionPersistenceCorruptionError']) {
    const f = fixture(), seed = host(f)
    const old = (await seed.inject()).body.sessionId
    const h = host(f, { resumeError: name, config: { blockedTools: 'pwsh' } })
    const current = (await h.inject()).body.sessionId
    assert.notEqual(current, old)
    assert.equal(h.resumes[0].setup, h.creates[0].setup)
    assert.equal(h.handles[0].agentCtx.guards[0]({ name: 'pwsh' }), '工具 pwsh 已被 QQ 侧闸门禁用')
    assert(h.warnings.some(message => message.includes(name)))
    assert.equal(JSON.parse(fs.readFileSync(f.store)).sessions['qq-test-user'], current)
  }
})

test('persistence is optional and malformed stores warn without breaking injection', async () => {
  assert(!plugin.inject.includes('sessionPersistence'))
  const f = fixture(), first = host(f)
  const old = (await first.inject()).body.sessionId
  const h = host(f, { persistence: false })
  assert.notEqual((await h.inject()).body.sessionId, old)
  assert.equal(h.resumes.length, 0)
  for (const raw of ['{', 'null', '{"version":1}', '{"version":1,"sessions":[]}', '{"version":1,"sessions":{"bad":42}}']) {
    fs.writeFileSync(f.store, raw)
    const bad = host(f)
    assert.equal((await bad.inject()).statusCode, 200)
    assert(bad.warnings.some(message => message.includes('按空映射处理')))
  }
})

test('failed atomic rename leaves the previous mapping intact and the message succeeds', async () => {
  const f = fixture(), h = host(f)
  await h.inject()
  const old = fs.readFileSync(f.store, 'utf8'), rename = fs.renameSync
  try {
    fs.renameSync = () => { throw new Error('test interrupted rename') }
    syncBuiltinESMExports()
    assert.equal((await h.inject({ userId: 'other-user' })).statusCode, 200)
  } finally {
    fs.renameSync = rename
    syncBuiltinESMExports()
  }
  assert.equal(fs.readFileSync(f.store, 'utf8'), old)
  assert(h.warnings.some(message => message.includes('写入失败')))
})

test('private chat and two groups stay isolated and replies keep their original destination', async () => {
  const f = fixture(), h = host(f), destinations = ['', 'group-a', 'group-b']
  const ids = []
  for (const groupId of destinations) ids.push((await h.inject({ groupId })).body.sessionId)
  assert.equal(new Set(ids).size, 3)
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(f.store)).sessions), ['qq-test-user', 'qq-test-user-g-group-a', 'qq-test-user-g-group-b'])
  for (const index of [2, 0, 1]) {
    const agent = h.handles[index].agent
    await h.tools.get('qq_reply').execute({ text: `reply-${index}` }, { agent })
    h.events.get('session/event')(agent.session, { type: 'turn/end' })
  }
  assert.deepEqual((await h.replies()).body.replies.map(reply => reply.groupId), ['group-b', '', 'group-a'])
  for (const [index, groupId] of destinations.entries()) {
    assert.equal((await h.inject({ groupId })).body.sessionId, ids[index])
  }
  assert.equal(h.creates.length, 3)
})

test('group memory guards apply to created and resumed agents; private chat is unchanged', async () => {
  const f = fixture(), first = host(f)
  await first.inject()
  await first.inject({ groupId: 'group-a' })
  assert.equal(first.handles[0].agentCtx.guards.length, 0)
  for (const h of [first, host(f)]) {
    await h.inject({ groupId: 'group-a' })
    const group = h.handles.at(-1)
    for (const name of ['memory_recall', 'memory_note', 'memory_organize', 'memory_future']) {
      assert.match(group.agentCtx.guards[0]({ name }), /群聊记忆闸门禁用/)
    }
    assert.equal(group.agentCtx.guards[0]({ name: 'qq_reply' }), undefined)
  }
})

test('tool replies, event fallback, timestamp IDs, legacy aliases and buffer remain intact', async () => {
  const f = fixture(), h = host(f, { config: { replyBuffer: 2 } })
  await h.inject()
  const agent = h.handles[0].agent
  const emit = (type, text) => h.events.get('session/event')(agent.session, { type, data: { message: { content: [{ type: 'text', text }] } } })
  await h.tools.get('qq_reply').execute({ text: 'tool' }, { agent })
  emit('assistant/message', 'duplicate'); emit('turn/end')
  emit('assistant/message', 'fallback'); emit('turn/end')
  const result = (await h.replies(4)).body
  assert.deepEqual(result.replies.map(reply => reply.text), ['tool', 'fallback'])
  assert(result.replies[1].id > result.replies[0].id)
  assert(result.replies.every(reply => reply.id === reply.seq))
  assert.equal(result.nextId, result.nextSeq)
  await h.tools.get('qq_reply').execute({ text: 'third' }, { agent })
  assert.deepEqual((await h.replies()).body.replies.map(reply => reply.text), ['fallback', 'third'])
})

test('auth, body limit and preset fallbacks keep their previous behavior', async () => {
  const f = fixture(), h = host(f)
  assert.equal((await h.inject({ token: 'wrong' })).statusCode, 401)
  assert.equal((await h.inject({ userId: 'unlisted-user' })).statusCode, 403)
  fs.writeFileSync(f.auth, JSON.stringify({ inject_token: 'test-token', allowed_users: [] }))
  assert.equal((await host(f).inject()).statusCode, 403)
  assert.equal((await host(f, { config: { maxBodyBytes: 1 } }).inject()).statusCode, 413)
  for (const [preset, fail, expected] of [['', [], ['standard']], ['elysia', ['elysia'], ['elysia', 'standard']], ['elysia', ['elysia', 'standard'], ['elysia', 'standard']]]) {
    const next = fixture(), instance = host(next, { config: { agentPreset: preset }, failPresets: fail })
    await instance.inject()
    assert.deepEqual(instance.mounts, expected)
    if (fail.length === 2) assert(instance.warnings.some(message => message.includes('无工具模式')))
  }
})
