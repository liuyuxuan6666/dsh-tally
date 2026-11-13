/**
 * dsh-tally — Client half.
 *
 * One sidebar entry and one central panel. The panel reads /api/todo/state and
 * writes through /api/todo/op, both served by the Host half in index.js.
 *
 * House style follows the panels already in this harness (AIHOT radar, 记忆宫殿):
 * bare 20px stroke icon in the sidebar with no wrapper button, panel padding
 * 20/22, 13px body, 17px title, tokens only. Mobile keeps the same single
 * column: nothing here is desktop-only.
 *
 * Editing is in place, never modal: click the title to rename, click the date
 * chip to pick a day, click the note chip to open a textarea under the row.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tally',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    let boundCtx = null

    /**
     * Report a render failure to the host. Reading a service that was not
     * injected throws, and a throwing slot entry is silently abdicated, so this
     * is the only way a broken view leaves a trace.
     */
    const report = (stage, detail) => {
      try {
        const q = new URLSearchParams({ stage })
        if (detail !== undefined && detail !== null) q.set('detail', String(detail).slice(0, 800))
        fetch(`/api/todo/clientlog?${q}`).catch(() => {})
      } catch {}
    }

    // ------------------------------------------------------------------ text

    const ZH = {
      title: '待办',
      addPlaceholder: '添加待办，回车确认',
      add: '添加',
      emptyTitle: '暂时没有待办',
      emptyHint: '在上方输入一条，回车即可添加',
      overdue: '逾期',
      today: '今天',
      week: '本周',
      later: '以后',
      noDate: '无日期',
      done: '已完成',
      showDone: '已完成',
      hideDone: '收起已完成',
      archive: '归档',
      delete: '删除',
      active: '项待办',
      overdueCount: '项逾期',
      markDone: '标记完成',
      markUndone: '标记未完成',
      pickDate: '设置日期',
      clearDate: '清除日期',
      addNote: '详情',
      notePlaceholder: '补充细节，⌘/Ctrl + Enter 保存，Esc 取消',
      editTitle: '标题',
      save: '保存',
      cancel: '取消',
    }

    const EN = {
      title: 'Todo',
      addPlaceholder: 'Add a todo, press Enter',
      add: 'Add',
      emptyTitle: 'Nothing to do',
      emptyHint: 'Type above and press Enter to add one',
      overdue: 'Overdue',
      today: 'Today',
      week: 'This week',
      later: 'Later',
      noDate: 'No date',
      done: 'Completed',
      showDone: 'Completed',
      hideDone: 'Hide completed',
      archive: 'Archive',
      delete: 'Delete',
      active: 'open',
      overdueCount: 'overdue',
      markDone: 'Mark as done',
      markUndone: 'Mark as not done',
      pickDate: 'Set a date',
      clearDate: 'Clear date',
      addNote: 'Details',
      notePlaceholder: 'Add details. ⌘/Ctrl + Enter saves, Esc cancels',
      editTitle: 'Title',
      save: 'Save',
      cancel: 'Cancel',
    }

    function translator() {
      const lang = (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN'
      const dict = lang.toLowerCase().startsWith('zh') ? ZH : EN
      return (key) => dict[key] ?? key
    }

    // --------------------------------------------------------------- tokens

    const T = {
      text: 'var(--dsw-alias-label-primary, #e8e8ea)',
      sub: 'var(--dsw-alias-label-secondary, #a0a0a8)',
      tertiary: 'var(--dsw-alias-label-tertiary, #6e6e78)',
      base: 'var(--dsw-alias-bg-base, #0e0e11)',
      layer1: 'var(--dsw-alias-bg-layer-1, #1a1a1f)',
      layer2: 'var(--dsw-alias-bg-layer-2, #232329)',
      border: 'var(--dsw-alias-border-l2, #2e2e36)',
      borderSoft: 'var(--dsw-alias-border-l1, #26262c)',
      brand: 'var(--dsw-alias-brand-primary, #5b8cff)',
      hover: 'var(--dsw-alias-interactive-bg-hover, #2a2a32)',
      error: 'var(--dsw-alias-state-error-primary, #ff4d4f)',
      success: 'var(--dsw-alias-state-success-primary, #34c759)',
    }

    const RADIUS = 8
    const ROW_MIN = 44
    const FIELD_FONT = 14

    const S = {
      panel: {
        boxSizing: 'border-box',
        height: '100%',
        overflowY: 'auto',
        background: T.base,
        color: T.text,
        fontSize: 13,
        lineHeight: 1.6,
        padding: '20px 22px 64px',
      },
      inner: { maxWidth: 720, margin: '0 auto' },
      head: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
      },
      titleWrap: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
      badge: {
        width: 38,
        height: 38,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${T.border}`,
        background: T.layer1,
        color: T.brand,
        flex: 'none',
      },
      h1: { fontSize: 17, fontWeight: 650, margin: 0, letterSpacing: '0.2px' },
      sub: { color: T.tertiary, fontSize: 12, margin: '2px 0 0' },
      ghostBtn: {
        fontSize: 12,
        padding: '6px 14px',
        borderRadius: RADIUS,
        border: `1px solid ${T.border}`,
        background: T.layer1,
        color: T.sub,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flex: 'none',
        whiteSpace: 'nowrap',
      },
      composer: { display: 'flex', gap: 8, marginBottom: 4 },
      input: {
        flex: 1,
        minWidth: 0,
        height: 40,
        padding: '0 12px',
        fontSize: FIELD_FONT,
        borderRadius: RADIUS,
        border: `1px solid ${T.borderSoft}`,
        background: T.layer1,
        color: T.text,
        outline: 'none',
        boxSizing: 'border-box',
      },
      addBtn: {
        height: 40,
        padding: '0 16px',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: RADIUS,
        border: 'none',
        background: T.brand,
        color: '#fff',
        cursor: 'pointer',
        flex: 'none',
      },
      groupLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: T.tertiary,
        margin: '18px 0 2px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      },
      groupCount: { fontWeight: 400, color: T.tertiary, opacity: 0.75 },
      row: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minHeight: ROW_MIN,
        padding: '10px 0',
        borderBottom: `1px solid ${T.borderSoft}`,
      },
      check: {
        width: 20,
        height: 20,
        marginTop: 2,
        flex: 'none',
        borderRadius: 6,
        border: `1.5px solid ${T.border}`,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        color: 'transparent',
      },
      checkDone: { background: T.brand, borderColor: T.brand, color: '#fff' },
      body: { flex: 1, minWidth: 0 },
      rowTitle: { fontSize: FIELD_FONT, lineHeight: 1.45, wordBreak: 'break-word', cursor: 'text' },
      rowTitleDone: {
        fontSize: FIELD_FONT,
        lineHeight: 1.45,
        wordBreak: 'break-word',
        color: T.tertiary,
        textDecoration: 'line-through',
        cursor: 'text',
      },
      titleInput: {
        width: '100%',
        boxSizing: 'border-box',
        fontSize: FIELD_FONT,
        lineHeight: 1.45,
        fontFamily: 'inherit',
        color: T.text,
        background: T.layer1,
        border: `1px solid ${T.brand}`,
        borderRadius: 6,
        padding: '2px 6px',
        margin: '-2px -6px',
        outline: 'none',
      },
      meta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12 },
      chip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 7px',
        borderRadius: 6,
        border: `1px solid ${T.borderSoft}`,
        background: 'transparent',
        color: T.sub,
        fontSize: 12,
        lineHeight: 1,
        cursor: 'pointer',
      },
      chipGhost: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 7px',
        borderRadius: 6,
        border: '1px dashed transparent',
        background: 'transparent',
        color: T.tertiary,
        fontSize: 12,
        lineHeight: 1,
        cursor: 'pointer',
      },
      chipOverdue: { color: T.error, borderColor: T.error },
      dateInput: {
        height: 24,
        padding: '0 6px',
        fontSize: 12,
        fontFamily: 'inherit',
        color: T.text,
        background: T.layer1,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        outline: 'none',
        colorScheme: 'light dark',
      },
      tag: {
        padding: '0 6px',
        borderRadius: 4,
        background: T.layer2,
        color: T.sub,
        fontSize: 11,
        lineHeight: '18px',
      },
      note: {
        color: T.tertiary,
        fontSize: 12,
        marginTop: 3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'text',
      },
      noteInput: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 56,
        marginTop: 6,
        padding: '6px 8px',
        fontSize: 12,
        fontFamily: 'inherit',
        lineHeight: 1.5,
        color: T.text,
        background: T.layer1,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        outline: 'none',
        resize: 'vertical',
      },
      actions: { display: 'flex', gap: 2, flex: 'none', opacity: 0.55 },
      iconBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: T.tertiary,
        cursor: 'pointer',
        fontSize: 15,
        lineHeight: 1,
        padding: 0,
      },
      empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '56px 0 48px',
        color: T.tertiary,
        textAlign: 'center',
      },
      emptyTitle: { fontSize: 14, color: T.sub },
      emptyHint: { fontSize: 12 },
      err: {
        margin: '10px 0 0',
        padding: '8px 12px',
        borderRadius: RADIUS,
        border: `1px solid ${T.error}`,
        background: 'transparent',
        color: T.error,
        fontSize: 12,
      },
      dockChip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${T.borderSoft}`,
        background: 'transparent',
        color: T.sub,
        fontSize: 12,
        cursor: 'pointer',
        lineHeight: 1,
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
      if (item.due < today) return 0
      if (item.due === today) return 1
      const diff = Math.round((new Date(`${item.due}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
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

    // ------------------------------------------------------------ components

    function CheckGlyph({ size = 12 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M2.5 8.5l3.5 3.5 7-8' }))
    }

    /** The checklist mark, drawn at 20px like the other sidebar entries. */
    function TallyGlyph({ size = 20 }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M4 7l2.2 2.2L10 5.4' }),
        h('path', { d: 'M4 15l2.2 2.2L10 13.4' }),
        h('path', { d: 'M13 7.5h7' }),
        h('path', { d: 'M13 15.5h7' }))
    }

    function SidebarEntry() {
      return h(TallyGlyph, null)
    }

    function DockChip() {
      const t = translator()
      return h('button', {
        type: 'button',
        style: S.dockChip,
        title: t('title'),
        onClick: () => {
          try {
            boundCtx?.layout?.selectPanel?.('todo')
          } catch (error) {
            report('dock:select-failed', error && error.message)
          }
        },
      }, h(TallyGlyph, { size: 13 }), t('title'))
    }

    /**
     * One row. Three in-place editors share the row:
     *   title — click the text, Enter saves, Esc cancels
     *   date  — click the date chip (or the dashed placeholder) to open a picker
     *   note  — click the details chip to open a textarea under the row
     * Local draft state survives the panel's 20s poll, so typing is never clobbered.
     */
    function Row({ item, today, t, onToggle, onRemove, onArchive, onSave }) {
      const [editingTitle, setEditingTitle] = useState(false)
      const [titleDraft, setTitleDraft] = useState(item.title)
      const [pickingDate, setPickingDate] = useState(false)
      const [editingNote, setEditingNote] = useState(false)
      const [noteDraft, setNoteDraft] = useState(item.note || '')
      const titleRef = useRef(null)
      const dateRef = useRef(null)
      const noteRef = useRef(null)
      // Enter commits, then the input unmounts and its blur fires a second time.
      // One commit per edit session, reset when the editor opens.
      const titleDone = useRef(false)
      const dateDone = useRef(false)
      const noteDone = useRef(false)

      useEffect(() => {
        if (editingTitle && titleRef.current) {
          titleRef.current.focus()
          titleRef.current.select()
        }
      }, [editingTitle])

      useEffect(() => {
        if (pickingDate && dateRef.current) {
          dateRef.current.focus()
          try {
            dateRef.current.showPicker?.()
          } catch {}
        }
      }, [pickingDate])

      useEffect(() => {
        if (editingNote && noteRef.current) noteRef.current.focus()
      }, [editingNote])

      const commitTitle = () => {
        if (titleDone.current) return
        titleDone.current = true
        const next = titleDraft.trim()
        setEditingTitle(false)
        if (!next || next === item.title) {
          setTitleDraft(item.title)
          return
        }
        onSave(item.id, { title: next })
      }

      const commitDue = (value) => {
        if (dateDone.current) return
        dateDone.current = true
        setPickingDate(false)
        const next = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null
        if ((item.due ?? null) === next) return
        onSave(item.id, { due: next ?? '' })
      }

      const commitNote = () => {
        if (noteDone.current) return
        noteDone.current = true
        setEditingNote(false)
        const next = noteDraft.trim()
        if ((item.note || '').trim() === next) return
        onSave(item.id, { note: next })
      }

      const overdue = !item.done && item.due && item.due < today

      const titleEl = editingTitle
        ? h('input', {
            ref: titleRef,
            style: S.titleInput,
            value: titleDraft,
            'aria-label': t('editTitle'),
            onChange: (e) => setTitleDraft(e.target.value),
            onBlur: commitTitle,
            onKeyDown: (e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitTitle()
              } else if (e.key === 'Escape') {
                setTitleDraft(item.title)
                setEditingTitle(false)
              }
            },
          })
        : h('div', {
            style: item.done ? S.rowTitleDone : S.rowTitle,
            title: t('editTitle'),
            onClick: () => {
              titleDone.current = false
              setTitleDraft(item.title)
              setEditingTitle(true)
            },
          }, item.title)

      const dateEl = pickingDate
        ? h('input', {
            ref: dateRef,
            type: 'date',
            style: S.dateInput,
            defaultValue: item.due || '',
            'aria-label': t('pickDate'),
            onChange: (e) => commitDue(e.target.value),
            onBlur: (e) => commitDue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Escape') setPickingDate(false)
            },
          })
        : h('button', {
            type: 'button',
            style: item.due ? { ...S.chip, ...(overdue ? S.chipOverdue : null) } : S.chipGhost,
            title: item.due ? t('clearDate') : t('pickDate'),
            onClick: () => {
              dateDone.current = false
              setPickingDate(true)
            },
            onContextMenu: (e) => {
              if (!item.due) return
              e.preventDefault()
              onSave(item.id, { due: '' })
            },
          }, item.due ? shortDate(item.due, today) : `＋ ${t('pickDate')}`)

      const noteEl = editingNote
        ? h('textarea', {
            ref: noteRef,
            style: S.noteInput,
            value: noteDraft,
            placeholder: t('notePlaceholder'),
            'aria-label': t('addNote'),
            onChange: (e) => setNoteDraft(e.target.value),
            onBlur: commitNote,
            onKeyDown: (e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                commitNote()
              } else if (e.key === 'Escape') {
                setNoteDraft(item.note || '')
                setEditingNote(false)
              }
            },
          })
        : null

      return h('div', { style: S.row },
        h('button', {
          type: 'button',
          style: { ...S.check, ...(item.done ? S.checkDone : null) },
          title: item.done ? t('markUndone') : t('markDone'),
          'aria-label': item.done ? t('markUndone') : t('markDone'),
          'aria-pressed': item.done,
          onClick: () => onToggle(item),
        }, item.done ? h(CheckGlyph) : null),
        h('div', { style: S.body },
          titleEl,
          h('div', { style: S.meta },
            dateEl,
            h('button', {
              type: 'button',
              style: item.note ? S.chip : S.chipGhost,
              title: t('addNote'),
              onClick: () => {
                noteDone.current = false
                setNoteDraft(item.note || '')
                setEditingNote(true)
              },
            }, item.note ? t('addNote') : `＋ ${t('addNote')}`),
            item.tags.map((tag) => h('span', { key: tag, style: S.tag }, `#${tag}`))),
          editingNote
            ? noteEl
            : item.note
              ? h('div', {
                  style: S.note,
                  title: item.note,
                  onClick: () => {
                    noteDone.current = false
                    setNoteDraft(item.note || '')
                    setEditingNote(true)
                  },
                }, item.note)
              : null),
        h('div', { style: S.actions },
          item.done
            ? h('button', { type: 'button', style: S.iconBtn, title: t('archive'), 'aria-label': t('archive'), onClick: () => onArchive(item) }, '⌫')
            : null,
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
          setError(String((e && e.message) || e))
        }
      }, [])

      useEffect(() => {
        let alive = true
        const tick = () => {
          if (alive) reload()
        }
        tick()
        const timer = setInterval(tick, 20000)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [reload])

      const run = useCallback(
        async (op, payload) => {
          setBusy(true)
          try {
            await api(op, payload)
            await reload()
          } catch (e) {
            setError(String((e && e.message) || e))
          } finally {
            setBusy(false)
          }
        },
        [reload],
      )

      const save = useCallback((id, patch) => run('update', { id, ...patch }), [run])

      const today = (state && state.today) || new Date().toLocaleDateString('sv-SE')
      const items = ((state && state.items) || []).filter((i) => !i.archived)
      const stats = (state && state.stats) || { active: 0, overdue: 0 }
      const grouped = useMemo(() => group(items, today), [items, today])
      const done = useMemo(() => items.filter((i) => i.done).slice(0, 30), [items])
      const openCount = items.filter((i) => !i.done).length

      const submit = () => {
        const title = draft.trim()
        if (!title || busy) return
        setDraft('')
        run('add', { title })
      }

      const rowProps = (item) => ({
        key: item.id,
        item,
        today,
        t,
        onSave: save,
        onToggle: (it) => run(it.done ? 'undo' : 'done', { id: it.id }),
        onRemove: (it) => run('remove', { id: it.id }),
        onArchive: (it) => run('archive', { id: it.id }),
      })

      const sections = []
      for (const key of [0, 1, 2, 3, 4]) {
        const list = grouped.get(key)
        if (!list || !list.length) continue
        sections.push(
          h('div', { key: `g${key}` },
            h('div', { style: S.groupLabel },
              t(BUCKET_LABEL[key]),
              h('span', { style: S.groupCount }, list.length)),
            list.map((item) => h(Row, rowProps(item)))),
        )
      }

      const subtitleParts = [`${stats.active} ${t('active')}`]
      if (stats.overdue > 0) subtitleParts.push(`${stats.overdue} ${t('overdueCount')}`)

      return h('div', { style: S.panel },
        h('div', { style: S.inner },
          h('div', { style: S.head },
            h('div', { style: S.titleWrap },
              h('div', { style: S.badge }, h(TallyGlyph, { size: 19 })),
              h('div', null,
                h('h1', { style: S.h1 }, t('title')),
                h('p', { style: S.sub }, subtitleParts.join(' · ')))),
            done.length
              ? h('button', {
                  type: 'button',
                  style: S.ghostBtn,
                  onClick: () => setShowDone((v) => !v),
                }, `${showDone ? t('hideDone') : t('showDone')} ${done.length}`)
              : null),
          h('div', { style: S.composer },
            h('input', {
              style: S.input,
              value: draft,
              placeholder: t('addPlaceholder'),
              onChange: (e) => setDraft(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') submit()
              },
              'aria-label': t('addPlaceholder'),
            }),
            h('button', {
              type: 'button',
              style: { ...S.addBtn, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' },
              onClick: submit,
              disabled: busy,
            }, t('add'))),
          error ? h('p', { style: S.err }, error) : null,
          state && openCount === 0 && !done.length
            ? h('div', { style: S.empty },
                h('div', { style: { opacity: 0.4 } }, h(TallyGlyph, { size: 40 })),
                h('div', { style: S.emptyTitle }, t('emptyTitle')),
                h('div', { style: S.emptyHint }, t('emptyHint')))
            : null,
          sections,
          done.length
            ? h('div', null,
                h('div', { style: { ...S.groupLabel, marginTop: 22 } },
                  t('done'),
                  h('span', { style: S.groupCount }, done.length)),
                showDone ? done.map((item) => h(Row, rowProps(item))) : null)
            : null,
        ),
      )
    }

    // ------------------------------------------------------------------ apply

    const guard = (name, render) =>
      function Guarded(props) {
        try {
          return render(props)
        } catch (error) {
          report(`render:error:${name}`, error && error.stack ? error.stack : error)
          return h('span', { style: { fontSize: 11, opacity: 0.7 } }, '!')
        }
      }

    return {
      inject: ['slots', 'layout'],
      apply(ctx) {
        boundCtx = ctx
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: 'todo', order: 20, label: '待办' }, guard('panellist', SidebarEntry)))
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'todo' }, guard('main', TodoPanel)))
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'todo-dock', order: 90 }, guard('dock', DockChip)))
      },
    }
  },
})
