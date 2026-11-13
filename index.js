/**
 * dsh-tally — Host half.
 *
 * Owns the todo store (a single JSON file under $DSH_HOME/todo), the agent
 * tools that operate on it, and the loopback HTTP API the client panel reads.
 * Everything that mutates state goes through one promise chain so two
 * sessions cannot interleave a read-modify-write.
 */
import { mkdir, readFile, rename, writeFile, copyFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const inject = ['tools']

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const DIR = join(DSH_HOME, 'todo')
const FILE = join(DIR, 'todo.json')
const BACKUP_DIR = join(DIR, 'backups')
const MAX_TITLE = 200
const MAX_NOTE = 2000
const ARCHIVE_AFTER_DAYS = 90
const MAX_LIST = 200

// ---------------------------------------------------------------- date utils

/** Local calendar date as YYYY-MM-DD. */
function today() {
  return new Date().toLocaleDateString('sv-SE')
}

/** Shift a YYYY-MM-DD string by n days (local time). */
function shift(date, days) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
function daysBetween(a, b) {
  const da = new Date(`${a}T00:00:00`).getTime()
  const db = new Date(`${b}T00:00:00`).getTime()
  return Math.round((db - da) / 86400000)
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

// -------------------------------------------------------------------- store

const EMPTY = () => ({ version: 1, updated: new Date().toISOString(), items: [] })

/** One promise chain for every read-modify-write. */
let chain = Promise.resolve()

function serialize(fn) {
  const run = chain.then(fn, fn)
  // Keep the chain alive after a rejection.
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function ensureDir() {
  await mkdir(DIR, { recursive: true })
  await mkdir(BACKUP_DIR, { recursive: true })
}

async function readState() {
  await ensureDir()
  try {
    const raw = await readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return EMPTY()
    return { version: 1, updated: parsed.updated ?? new Date().toISOString(), items: parsed.items.filter((it) => it && typeof it.id === 'string' && typeof it.title === 'string') }
  } catch (error) {
    if (error && error.code === 'ENOENT') return EMPTY()
    // A corrupt file must not take the whole panel down: keep the bytes aside.
    try {
      await copyFile(FILE, `${FILE}.corrupt-${Date.now()}`)
    } catch {
      /* ignore */
    }
    return EMPTY()
  }
}

/** Atomic write: temp file in the same directory, then rename over. */
async function writeState(state) {
  await ensureDir()
  state.updated = new Date().toISOString()
  const body = `${JSON.stringify(state, null, 2)}\n`
  const tmp = `${FILE}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, body, 'utf8')
  await rename(tmp, FILE)
}

/** Mark completed items older than the retention window as archived. */
function normalize(state) {
  const now = today()
  let changed = false
  for (const item of state.items) {
    if (item.done && !item.archived && item.completed) {
      const completedDay = String(item.completed).slice(0, 10)
      if (isDate(completedDay) && daysBetween(completedDay, now) > ARCHIVE_AFTER_DAYS) {
        item.archived = true
        changed = true
      }
    }
  }
  return changed
}

function nextId(items) {
  const day = today().replace(/-/g, '')
  let max = 0
  for (const item of items) {
    const m = /^t-(\d{8})-(\d+)$/.exec(item.id)
    if (m && m[1] === day) max = Math.max(max, Number(m[2]))
  }
  return `t-${day}-${String(max + 1).padStart(2, '0')}`
}

function findItem(state, id) {
  const item = state.items.find((it) => it.id === id)
  if (!item) throw new Error(`找不到任务 ${id}`)
  return item
}

function clampTitle(title) {
  const text = String(title ?? '').trim()
  if (!text) throw new Error('title 不能为空')
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE) : text
}

function clampNote(note) {
  const text = String(note ?? '').trim()
  return text.length > MAX_NOTE ? text.slice(0, MAX_NOTE) : text
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 8)
}

// ------------------------------------------------------------------ grouping

/** Rank: overdue 0, today 1, week 2, later 3, nodate 4. */
function bucketOf(item) {
  if (!item.due) return 4
  const delta = daysBetween(today(), item.due)
  if (delta < 0) return 0
  if (delta === 0) return 1
  if (delta <= 7) return 2
  return 3
}

function selectItems(state, options) {
  const opts = options ?? {}
  const scope = opts.scope ?? 'active'
  const includeDone = opts.includeDone ?? opts.include_done ?? false
  const includeHidden = opts.includeHidden ?? opts.include_hidden ?? false
  const includeArchived = opts.includeArchived ?? opts.include_archived ?? false
  const limit = opts.limit ?? MAX_LIST
  const now = today()
  let items = state.items
  if (scope === 'archived') {
    items = items.filter((it) => it.archived)
  } else if (!includeArchived) {
    items = items.filter((it) => !it.archived)
  }
  if (!includeHidden) items = items.filter((it) => !it.hidden)

  switch (scope) {
    case 'today':
      items = items.filter((it) => !it.done && it.due === now)
      break
    case 'overdue':
      items = items.filter((it) => !it.done && it.due && it.due < now)
      break
    case 'done':
      items = items.filter((it) => it.done)
      break
    case 'archived':
      items = items.filter((it) => it.archived)
      break
    case 'all':
      break
    default:
      if (!includeDone) items = items.filter((it) => !it.done)
  }
  if (scope === 'active' && includeDone) items = items.filter((it) => !it.done || (it.completed && daysBetween(String(it.completed).slice(0, 10), now) <= 7))

  items = [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const ra = bucketOf(a)
    const rb = bucketOf(b)
    if (ra !== rb) return ra - rb
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1
    return String(a.created).localeCompare(String(b.created))
  })
  return items.slice(0, Math.max(1, Math.min(MAX_LIST, Number(limit) || MAX_LIST)))
}

function summarize(state) {
  const now = today()
  const live = state.items.filter((it) => !it.archived && !it.hidden)
  return {
    total: state.items.length,
    active: live.filter((it) => !it.done).length,
    overdue: live.filter((it) => !it.done && it.due && it.due < now).length,
    today: live.filter((it) => !it.done && it.due === now).length,
    doneToday: live.filter((it) => it.done && String(it.completed ?? '').slice(0, 10) === now).length,
    archived: state.items.filter((it) => it.archived).length,
  }
}

function serializeItem(item) {
  return {
    id: item.id,
    title: item.title,
    done: Boolean(item.done),
    due: item.due ?? null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    note: item.note ?? '',
    archived: Boolean(item.archived),
    hidden: Boolean(item.hidden),
    created: item.created,
    completed: item.completed ?? null,
  }
}

// ---------------------------------------------------------------- operations

async function opAdd(args) {
  return serialize(async () => {
    const state = await readState()
    const item = {
      id: nextId(state.items),
      title: clampTitle(args.title),
      done: false,
      due: isDate(args.due) ? args.due : null,
      tags: normalizeTags(args.tags),
      note: clampNote(args.note),
      archived: false,
      hidden: false,
      created: new Date().toISOString(),
      completed: null,
    }
    state.items.push(item)
    await writeState(state)
    return serializeItem(item)
  })
}

async function opUpdate(args) {
  return serialize(async () => {
    const state = await readState()
    const item = findItem(state, args.id)
    if (args.title !== undefined) item.title = clampTitle(args.title)
    if (args.due !== undefined) item.due = isDate(args.due) ? args.due : null
    if (args.tags !== undefined) item.tags = normalizeTags(args.tags)
    if (args.note !== undefined) item.note = clampNote(args.note)
    await writeState(state)
    return serializeItem(item)
  })
}

async function opSetDone(args, done) {
  return serialize(async () => {
    const state = await readState()
    const item = findItem(state, args.id)
    item.done = done
    item.completed = done ? new Date().toISOString() : null
    await writeState(state)
    return serializeItem(item)
  })
}

async function opRemove(args) {
  return serialize(async () => {
    const state = await readState()
    const item = findItem(state, args.id)
    state.items = state.items.filter((it) => it.id !== args.id)
    await writeState(state)
    return serializeItem(item)
  })
}

async function opArchive(args, archived) {
  return serialize(async () => {
    const state = await readState()
    const item = findItem(state, args.id)
    item.archived = archived
    await writeState(state)
    return serializeItem(item)
  })
}

async function opHide(args, hidden) {
  return serialize(async () => {
    const state = await readState()
    const item = findItem(state, args.id)
    item.hidden = hidden
    await writeState(state)
    return serializeItem(item)
  })
}

async function opList(args) {
  const state = await readState()
  if (normalize(state)) await serialize(() => writeState(state))
  return {
    items: selectItems(state, args).map(serializeItem),
    stats: summarize(state),
    today: today(),
  }
}

async function opExport(args) {
  const state = await readState()
  const items = selectItems(state, { scope: args.scope ?? 'all', includeDone: true, includeArchived: args.scope === 'all', limit: MAX_LIST })
  if ((args.format ?? 'markdown') === 'json') {
    return { format: 'json', text: JSON.stringify(items.map(serializeItem), null, 2) }
  }
  const lines = [`# 待办导出 ${today()}`, '']
  const groups = new Map()
  for (const item of items) {
    const key = item.done ? '已完成' : ['逾期', '今天', '本周', '以后', '无日期'][bucketOf(item)]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  for (const [key, list] of groups) {
    lines.push(`## ${key}`, '')
    for (const item of list) {
      const box = item.done ? 'x' : ' '
      const due = item.due ? `  ^${item.due}` : ''
      const tags = item.tags?.length ? `  ${item.tags.map((t) => `#${t}`).join(' ')}` : ''
      lines.push(`- [${box}] ${item.title}${due}${tags}`)
    }
    lines.push('')
  }
  return { format: 'markdown', text: lines.join('\n') }
}

// ------------------------------------------------------------------- routing

/** Dispatch one API call. Shared by the tools and the HTTP panel. */
async function dispatch(op, payload) {
  const args = payload ?? {}
  switch (op) {
    case 'add':
      return opAdd(args)
    case 'update':
      return opUpdate(args)
    case 'done':
      return opSetDone(args, true)
    case 'undo':
      return opSetDone(args, false)
    case 'remove':
      return opRemove(args)
    case 'archive':
      return opArchive(args, true)
    case 'unarchive':
      return opArchive(args, false)
    case 'hide':
      return opHide(args, true)
    case 'unhide':
      return opHide(args, false)
    case 'list':
      return opList(args)
    case 'export':
      return opExport(args)
    default:
      throw new Error(`未知操作 ${op}`)
  }
}

// --------------------------------------------------------------------- tools

const JSON_OBJECT = { type: 'object', additionalProperties: true }

const TOOL_OUTPUT = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
  additionalProperties: true,
}

function tool(name, description, parameters, run) {
  return {
    name,
    description,
    parameters,
    output: {
      schema: TOOL_OUTPUT,
      render(_args, value) {
        const text = value && typeof value.message === 'string' ? value.message : JSON.stringify(value, null, 2)
        return [{ type: 'text', text }]
      },
    },
    async execute(args) {
      const result = await run(args ?? {})
      if (typeof result === 'string') return { message: result }
      if (result && typeof result === 'object' && typeof result.message === 'string') return result
      return { message: JSON.stringify(result, null, 2) }
    },
  }
}

function formatList(result) {
  if (!result.items.length) return `待办为空（${result.today}）`
  const labels = ['逾期', '今天', '本周', '以后', '无日期']
  const groups = new Map()
  for (const item of result.items) {
    const key = item.done ? '已完成' : labels[bucketOf(item)]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  const out = [`待办 ${result.today} · 活跃 ${result.stats.active} · 逾期 ${result.stats.overdue}`, '']
  for (const [key, list] of groups) {
    out.push(`【${key}】`)
    for (const item of list) {
      const box = item.done ? '[x]' : '[ ]'
      const due = item.due ? `（${item.due}）` : ''
      const tags = item.tags.length ? ` ${item.tags.map((t) => `#${t}`).join(' ')}` : ''
      out.push(`${box} ${item.id} ${item.title}${due}${tags}`)
    }
    out.push('')
  }
  return out.join('\n')
}

export function apply(ctx) {
  // ---- tools -------------------------------------------------------------
  ctx.effect(() =>
    ctx.tools.register(
      tool(
        'todo_add',
        '添加一条个人待办。title 必填；due 用 YYYY-MM-DD；tags 是字符串数组。返回新任务的 id。',
        {
          type: 'object',
          properties: {
            title: { type: 'string', description: '任务标题（≤200 字）' },
            due: { type: 'string', description: '截止日期 YYYY-MM-DD，可省略' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签，最多 8 个' },
            note: { type: 'string', description: '备注（≤2000 字）' },
          },
          required: ['title'],
          additionalProperties: false,
        },
        async (args) => {
          const item = await dispatch('add', args)
          return `已添加 ${item.id}：${item.title}${item.due ? `（${item.due}）` : ''}`
        },
      ),
    ),
  )

  ctx.effect(() =>
    ctx.tools.register(
      tool(
        'todo_list',
        '列出个人待办。scope: active（默认，未完成）/ today / overdue / done / archived / all。默认最多 200 条。',
        {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['active', 'today', 'overdue', 'done', 'archived', 'all'] },
            include_done: { type: 'boolean', description: 'active 下是否附上最近 7 天完成的' },
            include_archived: { type: 'boolean' },
            limit: { type: 'number', description: '最多返回条数，默认 200' },
          },
          additionalProperties: false,
        },
        async (args) => formatList(await dispatch('list', args)),
      ),
    ),
  )

  ctx.effect(() =>
    ctx.tools.register(
      tool(
        'todo_update',
        '修改一条待办。只传要改的字段。',
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            due: { type: 'string', description: 'YYYY-MM-DD；空字符串表示清除日期' },
            tags: { type: 'array', items: { type: 'string' } },
            note: { type: 'string' },
          },
          required: ['id'],
          additionalProperties: false,
        },
        async (args) => {
          const item = await dispatch('update', args)
          return `已更新 ${item.id}：${item.title}`
        },
      ),
    ),
  )

  for (const [name, op, label] of [
    ['todo_done', 'done', '完成'],
    ['todo_undo', 'undo', '恢复为未完成'],
    ['todo_archive', 'archive', '归档'],
    ['todo_unarchive', 'unarchive', '取消归档'],
    ['todo_hide', 'hide', '隐藏'],
    ['todo_unhide', 'unhide', '取消隐藏'],
    ['todo_remove', 'remove', '删除'],
  ]) {
    ctx.effect(() =>
      ctx.tools.register(
        tool(
          name,
          `${label}一条待办。`,
          { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
          async (args) => {
            const item = await dispatch(op, args)
            return `${label}成功：${item.id} ${item.title}`
          },
        ),
      ),
    )
  }

  ctx.effect(() =>
    ctx.tools.register(
      tool(
        'todo_export',
        '导出待办为 Markdown 或 JSON 文本。',
        {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['markdown', 'json'] },
            scope: { type: 'string', enum: ['active', 'today', 'overdue', 'done', 'all'] },
          },
          additionalProperties: false,
        },
        async (args) => {
          const result = await dispatch('export', args)
          return result.text
        },
      ),
    ),
  )

  // ---- HTTP API for the panel -------------------------------------------
  ctx.inject(['webServer'], (inner) => {
    inner.effect(() =>
      inner.webServer.register({
        kind: 'prefix',
        path: '/api/todo',
        async resource(request) {
          const url = new URL(request.url ?? '/', 'http://127.0.0.1')
          const host = request.headers.get('host') ?? ''
          if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) {
            return new Response('forbidden', { status: 403 })
          }
          if (url.pathname === '/api/todo/state') {
            if (request.method !== 'GET') return new Response('method not allowed', { status: 405 })
            const result = await dispatch('list', { scope: 'all', includeArchived: true, includeDone: true })
            return Response.json(result)
          }
          if (url.pathname === '/api/todo/op') {
            if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
            let body = {}
            try {
              body = await request.json()
            } catch {
              return Response.json({ ok: false, error: 'invalid json' }, { status: 400 })
            }
            try {
              const value = await dispatch(body.op, body)
              return Response.json({ ok: true, value })
            } catch (error) {
              return Response.json({ ok: false, error: String(error?.message ?? error) }, { status: 200 })
            }
          }
          return new Response('not found', { status: 404 })
        },
      }),
    )
  })
}
