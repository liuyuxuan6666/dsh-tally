/**
 * dsh-tally — Client half.
 *
 * One sidebar entry and one central panel. The panel reads /api/todo/state and
 * writes through /api/todo/op, both served by the Host half in index.js.
 * Layout is mobile-first on purpose: a single column, 48px rows, no overlays.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tally',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useState } = React

    let boundCtx = null

    // ------------------------------------------------------------------ i18n

    const ZH = {
      title: '待办',
      addPlaceholder: '添加一条，回车确认',
      empty: '暂时没有待办',
      overdue: '逾期',
      today: '今天',
      week: '本周',
      later: '以后',
      noDate: '无日期',
      done: '已完成',
      showDone: '显示已完成',
      hideDone: '隐藏已完成',
      archive: '归档',
      delete: '删除',
      active: '活跃',
    }

    function translator() {
      const locale = boundCtx && boundCtx.locale
      const canTranslate = Boolean(locale && typeof locale.t === 'function')
      return (key) => {
        if (canTranslate) {
          const text = locale.t(`todo.ui.${key}`)
          if (text && text !== `todo.ui.${key}`) return text
        }
        return ZH[key] ?? key
      }
    }

    // ---------------------------------------------------------------- styles

    const T = (name, fallback) => `var(--dsw-alias-${name}, ${fallback})`

    const S = {
      panel: {
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: T('bg-base', '#fff'),
        color: T('label-primary', '#1a1a1c'),
        font: `15px/1.5 ${T('font-family', 'system-ui, -apple-system, "Segoe UI", sans-serif')}`,
      },
      page: {
        maxWidth: 720,
        margin: '0 auto',
        padding: '16px 16px 96px',
        boxSizing: 'border-box',
      },
      header: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        padding: '4px 0 12px',
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: T('bg-base', '#fff'),
      },
      h1: { fontSize: 22, fontWeight: 650, margin: 0 },
      stats: { fontSize: 13, color: T('label-secondary', 'rgba(0,0,0,.58)') },
      composer: { display: 'flex', gap: 8, marginBottom: 20 },
      input: {
        flex: 1,
        minWidth: 0,
        height: 48,
        padding: '0 14px',
        fontSize: 16,
        borderRadius: 12,
        border: `1px solid ${T('border-l1', 'rgba(0,0,0,.16)')}`,
        background: T('bg-layer-1', '#f7f7f8'),
        color: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
      },
      addBtn: {
        height: 48,
        padding: '0 18px',
        fontSize: 15,
        fontWeight: 600,
        borderRadius: 12,
        border: 'none',
        background: T('state-business-primary', '#2f6fe0'),
        color: '#fff',
        cursor: 'pointer',
      },
      groupTitle: {
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '.02em',
        color: T('label-secondary', 'rgba(0,0,0,.58)'),
        margin: '18px 0 6px',
        textTransform: 'none',
      },
      row: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        minHeight: 48,
        padding: '10px 4px',
        borderBottom: `1px solid ${T('border-l1', 'rgba(0,0,0,.08)')}`,
      },
      checkbox: {
        width: 26,
        height: 26,
        marginTop: 2,
        flex: '0 0 auto',
        borderRadius: 8,
        border: `2px solid ${T('border-l1', 'rgba(0,0,0,.28)')}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: 'transparent',
        color: 'inherit',
        padding: 0,
      },
      body: { flex: 1, minWidth: 0 },
      title: { fontSize: 16, wordBreak: 'break-word' },
      titleDone: {
        fontSize: 16,
        wordBreak: 'break-word',
        textDecoration: 'line-through',
        opacity: 0.5,
      },
      meta: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 3,
        fontSize: 12,
        color: T('label-secondary', 'rgba(0,0,0,.58)'),
      },
      dueBadge: (overdue) => ({
        padding: '1px 7px',
        borderRadius: 999,
        background: overdue ? 'rgba(220,60,60,.12)' : T('bg-layer-1', 'rgba(0,0,0,.05)'),
        color: overdue ? '#c0392b' : 'inherit',
      }),
      tag: {
        padding: '1px 7px',
        borderRadius: 999,
        background: T('bg-layer-1', 'rgba(0,0,0,.05)'),
      },
      actions: { display: 'flex', gap: 4, flex: '0 0 auto' },
      iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        color: T('label-secondary', 'rgba(0,0,0,.5)'),
        cursor: 'pointer',
        fontSize: 15,
      },
      empty: {
        padding: '48px 0',
        textAlign: 'center',
        color: T('label-secondary', 'rgba(0,0,0,.5)'),
      },
      toggleDone: {
        marginTop: 22,
        width: '100%',
        minHeight: 44,
        borderRadius: 10,
        border: `1px solid ${T('border-l1', 'rgba(0,0,0,.12)')}`,
        background: 'transparent',
        color: T('label-secondary', 'rgba(0,0,0,.6)'),
        cursor: 'pointer',
        fontSize: 14,
      },
      sidebarBtn: {
        width: 34,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 9,
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        padding: 0,
      },
    }

    // ------------------------------------------------------------------- api

    async function api(op, payload) {
      const res = await fetch('/api/todo/op', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, ...payload }),
      })
      const data = await res.json().catch(() => ({ ok: false, error: 'bad response' }))
      if (!data.ok) throw new Error(data.error || 'operation failed')
      return data.value
    }

    async function fetchState() {
      const res = await fetch('/api/todo/state')
      if (!res.ok) throw new Error(`state ${res.status}`)
      return res.json()
    }

    // -------------------------------------------------------------- helpers

    const BUCKET_LABEL = ['overdue', 'today', 'week', 'later', 'noDate']

    function bucketOf(item, today) {
      if (!item.due) return 4
      const d = item.due
      if (d < today) return 0
      if (d === today) return 1
      const diff = Math.round((new Date(`${d}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
      return diff <= 7 ? 2 : 3
    }

    function shortDate(due, today) {
      const [y, m, d] = due.split('-')
      return y === today.slice(0, 4) ? `${m}-${d}` : due
    }

    function group(items, today) {
      const out = new Map()
      for (const item of items) {
        if (item.done) continue
        const key = bucketOf(item, today)
        if (!out.has(key)) out.set(key, [])
        out.get(key).push(item)
      }
      return out
    }

    // ----------------------------------------------------------- components

    function CheckIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M2.5 8.5l3.5 3.5 7-8' }))
    }

    function TodoGlyph() {
      return h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('rect', { x: 3.5, y: 3, width: 17, height: 18, rx: 3 }),
        h('path', { d: 'M7 8.5l1.6 1.6L11.5 7' }),
        h('path', { d: 'M7 15.5l1.6 1.6L11.5 14' }),
        h('path', { d: 'M14 9.5h3.5' }),
        h('path', { d: 'M14 16.5h3.5' }))
    }

    function SidebarEntry() {
      const t = translator()
      return h('button', {
        type: 'button',
        style: S.sidebarBtn,
        title: t('title'),
        'aria-label': t('title'),
        onClick: () => boundCtx?.layout?.selectPanel?.('todo'),
      }, h(TodoGlyph))
    }

    function Row({ item, today, onToggle, onRemove, onArchive }) {
      const t = translator()
      const overdue = !item.done && item.due && item.due < today
      return h('div', { style: S.row },
        h('button', {
          type: 'button',
          style: { ...S.checkbox, ...(item.done ? { background: T('state-business-primary', '#2f6fe0'), borderColor: T('state-business-primary', '#2f6fe0'), color: '#fff' } : null) },
          title: item.done ? t('markUndone') : t('markDone'),
          'aria-label': item.done ? t('markUndone') : t('markDone'),
          'aria-pressed': item.done,
          onClick: () => onToggle(item),
        }, item.done ? h(CheckIcon) : null),
        h('div', { style: S.body },
          h('div', { style: item.done ? S.titleDone : S.title }, item.title),
          (item.due || item.tags.length || item.note)
            ? h('div', { style: S.meta },
                item.due ? h('span', { style: S.dueBadge(overdue) }, shortDate(item.due, today)) : null,
                item.tags.map((tag) => h('span', { key: tag, style: S.tag }, `#${tag}`)),
                item.note ? h('span', { style: { opacity: 0.75 } }, item.note.length > 40 ? `${item.note.slice(0, 40)}…` : item.note) : null)
            : null),
        h('div', { style: S.actions },
          item.done ? h('button', { type: 'button', style: S.iconBtn, title: t('archive'), 'aria-label': t('archive'), onClick: () => onArchive(item) }, '⌫') : null,
          h('button', { type: 'button', style: S.iconBtn, title: t('delete'), 'aria-label': t('delete'), onClick: () => onRemove(item) }, '×')))
    }

    function TodoPanel() {
      const t = translator()
      const [state, setState] = useState(null)
      const [draft, setDraft] = useState('')
      const [showDone, setShowDone] = useState(false)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)

      const reload = useCallback(async () => {
        try {
          setState(await fetchState())
          setError('')
        } catch (e) {
          setError(String(e.message || e))
        }
      }, [])

      useEffect(() => {
        let alive = true
        const tick = () => { if (alive) reload() }
        tick()
        const timer = setInterval(tick, 20000)
        return () => { alive = false; clearInterval(timer) }
      }, [reload])

      const run = useCallback(async (op, payload) => {
        setBusy(true)
        try {
          await api(op, payload)
          await reload()
        } catch (e) {
          setError(String(e.message || e))
        } finally {
          setBusy(false)
        }
      }, [reload])

      const today = state?.today || new Date().toLocaleDateString('sv-SE')
      const items = (state?.items || []).filter((i) => !i.archived)
      const stats = state?.stats || { active: 0, overdue: 0 }
      const grouped = useMemo(() => group(items, today), [items, today])
      const done = useMemo(() => items.filter((i) => i.done).slice(0, 30), [items])

      const submit = () => {
        const title = draft.trim()
        if (!title || busy) return
        setDraft('')
        run('add', { title })
      }

      const sections = []
      for (const key of [0, 1, 2, 3, 4]) {
        const list = grouped.get(key)
        if (!list || !list.length) continue
        sections.push(
          h('div', { key: `g${key}` },
            h('div', { style: S.groupTitle }, t(BUCKET_LABEL[key])),
            list.map((item) => h(Row, {
              key: item.id, item, today,
              onToggle: (it) => run(it.done ? 'undo' : 'done', { id: it.id }),
              onRemove: (it) => run('remove', { id: it.id }),
              onArchive: (it) => run('archive', { id: it.id }),
            }))),
        )
      }

      return h('div', { style: S.panel },
        h('div', { style: S.page },
          h('div', { style: S.header },
            h('h1', { style: S.h1 }, t('title')),
            h('span', { style: S.stats }, `${t('active')} ${stats.active}${stats.overdue ? ` · ${t('overdue')} ${stats.overdue}` : ''}`)),
          h('div', { style: S.composer },
            h('input', {
              style: S.input,
              value: draft,
              placeholder: t('addPlaceholder'),
              onChange: (e) => setDraft(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') submit() },
              'aria-label': t('addPlaceholder'),
            }),
            h('button', { type: 'button', style: { ...S.addBtn, opacity: busy ? 0.6 : 1 }, onClick: submit }, '+')),
          error ? h('div', { style: { color: '#c0392b', fontSize: 13, marginBottom: 12 } }, error) : null,
          !state ? h('div', { style: S.empty }, '…') : null,
          state && !items.filter((i) => !i.done).length ? h('div', { style: S.empty }, t('empty')) : null,
          sections,
          done.length
            ? h('div', null,
                h('button', { type: 'button', style: S.toggleDone, onClick: () => setShowDone((v) => !v) },
                  `${showDone ? t('hideDone') : t('showDone')} (${done.length})`),
                showDone
                  ? h('div', null,
                      h('div', { style: S.groupTitle }, t('done')),
                      done.map((item) => h(Row, {
                        key: item.id, item, today,
                        onToggle: (it) => run('undo', { id: it.id }),
                        onRemove: (it) => run('remove', { id: it.id }),
                        onArchive: (it) => run('archive', { id: it.id }),
                      })))
                  : null)
            : null,
        ))
    }

    // ------------------------------------------------------------------ apply

    return {
      inject: ['slots', 'layout'],
      apply(ctx) {
        boundCtx = ctx
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: 'todo', order: 20, label: '待办' }, SidebarEntry))
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'todo' }, TodoPanel))
      },
    }
  },
})
