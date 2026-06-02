'use client'

/* ===================================================================
   MOBILE UI — 3 swipe pages (tasks / recurring / calendar) + a synced
   tab bar and a calendar bottom sheet.

   Presentational only: it receives tasks, recurring, and every CRUD
   callback from the shared parent (app/page.tsx). Local state here is
   view state (form inputs, calendar position, which sheet is open…).
=================================================================== */

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  type AppProps,
  type Task,
  type Freq,
  pad,
  daysUntil,
  etaText,
  dueText,
  todayISO,
  isRecDueToday,
  recLabel,
} from './shared'

type SheetCtx = { type: 'day'; iso: string } | { type: 'month' } | null

// ---- calendar helpers ---------------------------------------------
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayISOfrom(y: number, m: number, d: number) {
  return y + '-' + pad(m + 1) + '-' + pad(d)
}

function dayHeading(iso: string): string {
  const dt = new Date(iso + 'T00:00:00')
  const isToday = iso === todayISO()
  return (
    (isToday ? 'today · ' : '') +
    FULL_DAYS[dt.getDay()].toLowerCase() +
    ' ' + dt.getDate() + ' ' + MONTHS[dt.getMonth()].toLowerCase()
  )
}

// ---- small SVG icons ----------------------------------------------
const CheckIcon = () => (
  <path
    d="M4 13 C 7 16, 9 18, 10 19 C 13 13, 17 7, 21 4"
    fill="none"
    stroke="#3f8f5b"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24">
    <path
      d="M4 6 H20 M9 6 V4 H15 V6 M6 6 L7 20 H17 L18 6"
      fill="none"
      stroke="#2b2b28"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// ---- custom hand-drawn dropdown (drops upward in the bar) ---------
function InkDrop({
  value,
  options,
  onChange,
  triggerLabel,
}: {
  value: string
  options: { val: string; label: string }[]
  onChange: (val: string) => void
  triggerLabel?: (label: string) => string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.val === value)
  const trig = current ? (triggerLabel ? triggerLabel(current.label) : current.label) : ''

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className={'ink-drop' + (open ? ' open' : '')}>
      <button
        className="ink-drop-trigger"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {trig} <span className="drop-caret">▾</span>
      </button>
      <ul className="ink-drop-menu">
        {options.map((o) => (
          <li key={o.val}>
            <button
              type="button"
              className={o.val === value ? 'active' : ''}
              onClick={() => {
                onChange(o.val)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ===================================================================
//  MOBILE APP
// ===================================================================
export default function MobileApp({
  loading,
  tasks,
  recurring,
  addTask,
  toggleTask,
  deleteTask,
  addRecurring,
  tickRecurring,
  deleteRecurring,
  signOut,
}: AppProps) {
  // add-task form
  const [nameInput, setNameInput] = useState('')
  const [dateInput, setDateInput] = useState('')

  // per-task delete confirmation (UI-only, not persisted)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // recurring form
  const [recName, setRecName] = useState('')
  const [recFreq, setRecFreq] = useState<Freq>('daily')
  const [recWeekday, setRecWeekday] = useState(1)

  // calendar
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // bottom sheet
  const [sheetCtx, setSheetCtx] = useState<SheetCtx>(null)

  // swipe deck / tab bar
  const pagesRef = useRef<HTMLDivElement>(null)
  const [activePage, setActivePage] = useState(0)

  // ---- derived lists -----------------------------------------------
  const active = useMemo(
    () =>
      tasks
        .filter((t) => !t.done)
        .sort((a, b) => {
          const da = daysUntil(a.deadline)
          const db = daysUntil(b.deadline)
          if (da === null) return db === null ? 0 : 1
          if (db === null) return -1
          return da - db
        }),
    [tasks]
  )

  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.done)
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [tasks]
  )

  const sortedRec = useMemo(
    () =>
      [...recurring].sort((a, b) => {
        const ad = isRecDueToday(a)
        const bd = isRecDueToday(b)
        if (ad !== bd) return ad ? -1 : 1
        return a.name.localeCompare(b.name)
      }),
    [recurring]
  )

  // ---- form handlers -----------------------------------------------
  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const name = nameInput.trim()
    if (!name) return
    addTask(name, dateInput)
    setNameInput('')
    setDateInput('')
  }

  function handleAddRec(e: React.FormEvent) {
    e.preventDefault()
    const name = recName.trim()
    if (!name) return
    addRecurring(name, recFreq, recWeekday)
    setRecName('')
  }

  function confirmDelete(id: string) {
    deleteTask(id)
    setConfirmingId(null)
  }

  // ---- swipe deck <-> tab bar sync ---------------------------------
  function goToPage(i: number) {
    const el = pagesRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function handlePagesScroll() {
    const el = pagesRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActivePage((p) => (p !== idx ? idx : p))
  }

  // keep scroll position aligned to the active page on resize
  useEffect(() => {
    function onResize() {
      const el = pagesRef.current
      if (el) el.scrollLeft = activePage * el.clientWidth
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activePage])

  // ---- shared task row render --------------------------------------
  function renderTask(t: Task) {
    const d = daysUntil(t.deadline)
    const soon = !t.done && d !== null && d >= 0 && d <= 2
    const over = !t.done && d !== null && d < 0
    const eta = t.done ? '' : etaText(t.deadline)
    const hasMeta = !!eta || !!t.deadline

    return (
      <li className={'task' + (t.done ? ' done' : '')} key={t.id}>
        <div className="task-body">
          <span className="task-name">{t.name}</span>
          {hasMeta && (
            <span className="task-meta">
              {eta ? 'eta ' + eta : ''}
              {t.deadline ? (
                <>
                  {eta ? ' · ' : ''}
                  <span className={'m-due' + (soon ? ' soon' : '') + (over ? ' over' : '')}>
                    {dueText(t.deadline)}
                  </span>
                </>
              ) : null}
            </span>
          )}
        </div>
        {t.done && <span className="stamp">DONE</span>}
        {confirmingId === t.id ? (
          <div className="confirm-btns">
            <button className="confirm-no" onClick={() => setConfirmingId(null)}>
              no
            </button>
            <button className="confirm-yes" onClick={() => confirmDelete(t.id)}>
              yes
            </button>
          </div>
        ) : (
          <button
            className="trash-btn"
            aria-label="delete"
            onClick={() => (t.done ? deleteTask(t.id) : setConfirmingId(t.id))}
          >
            <TrashIcon />
          </button>
        )}
        <button
          className="checkbox sketch"
          aria-label="toggle done"
          onClick={() => toggleTask(t.id)}
          style={t.done ? { borderColor: '#3f8f5b' } : undefined}
        >
          <svg viewBox="0 0 24 24">{t.done && <CheckIcon />}</svg>
        </button>
      </li>
    )
  }

  // ---- deadline-bar hint -------------------------------------------
  const showHint = !!dateInput
  const hintText = dateInput ? 'deadline ' + dueText(dateInput) + ' · eta ' + etaText(dateInput) : ''

  // ---- calendar grid -----------------------------------------------
  const calCells = useMemo(() => {
    const first = new Date(calYear, calMonth, 1)
    const lead = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const today = todayISO()

    const cells: React.ReactNode[] = []
    for (let i = 0; i < lead; i++) {
      cells.push(<div className="cal-cell blank" key={'b' + i} />)
    }
    for (let dnum = 1; dnum <= daysInMonth; dnum++) {
      const iso = dayISOfrom(calYear, calMonth, dnum)
      const dayTasks = tasks.filter((t) => t.deadline === iso)
      const hasActive = dayTasks.some((t) => !t.done)
      const hasDone = dayTasks.some((t) => t.done)
      const cls =
        'cal-cell' +
        (dayTasks.length ? ' has' : '') +
        (iso === today ? ' today' : '') +
        (iso < today ? ' past' : '') +
        (iso === selectedDay ? ' selected' : '')
      cells.push(
        <div
          className={cls}
          key={iso}
          onClick={() => {
            setSelectedDay(iso)
            setSheetCtx({ type: 'day', iso })
          }}
        >
          <span>{dnum}</span>
          <span className="cal-dots">
            {hasActive && <span className="cal-dot active" />}
            {hasDone && <span className="cal-dot done" />}
          </span>
        </div>
      )
    }
    return cells
  }, [calYear, calMonth, selectedDay, tasks])

  function prevMonth() {
    setCalMonth((m) => {
      if (m === 0) {
        setCalYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }
  function nextMonth() {
    setCalMonth((m) => {
      if (m === 11) {
        setCalYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  // ---- bottom sheet content ----------------------------------------
  function renderSheet() {
    if (!sheetCtx) return { title: null as React.ReactNode, body: null as React.ReactNode }

    if (sheetCtx.type === 'day') {
      const dayTasks = tasks
        .filter((t) => t.deadline === sheetCtx.iso)
        .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))
      return {
        title: dayHeading(sheetCtx.iso),
        body: dayTasks.length ? (
          dayTasks.map(renderTask)
        ) : (
          <li className="empty">no tasks due this day.</li>
        ),
      }
    }

    // month view
    const prefix = calYear + '-' + pad(calMonth + 1)
    const monthTasks = tasks
      .filter((t) => t.deadline && t.deadline.indexOf(prefix) === 0)
      .sort((a, b) => {
        if (a.deadline !== b.deadline) return (a.deadline ?? '') < (b.deadline ?? '') ? -1 : 1
        return (a.done ? 1 : 0) - (b.done ? 1 : 0)
      })
    const activeN = monthTasks.filter((t) => !t.done).length

    let body: React.ReactNode
    if (!monthTasks.length) {
      body = <li className="empty">no tasks due this month.</li>
    } else {
      const rows: React.ReactNode[] = []
      let lastDay = ''
      monthTasks.forEach((t) => {
        if (t.deadline !== lastDay) {
          lastDay = t.deadline as string
          rows.push(
            <li className="sheet-daysep" key={'sep-' + t.deadline}>
              {dayHeading(t.deadline as string)}
            </li>
          )
        }
        rows.push(renderTask(t))
      })
      body = rows
    }

    return {
      title: (
        <>
          {MONTHS[calMonth]} {calYear}
          <span className="sheet-sub">
            {monthTasks.length} task{monthTasks.length === 1 ? '' : 's'} · {activeN} to do
          </span>
        </>
      ),
      body,
    }
  }

  const sheet = renderSheet()
  const sheetOpen = sheetCtx !== null

  // ---- render ------------------------------------------------------
  return (
    <div className="mobile-root">
      <div className="app">
        <div className="pages" ref={pagesRef} onScroll={handlePagesScroll}>
          {/* ============ PAGE 1 — TASKS ============ */}
          <section className="page">
            <header className="page-head">
              <h1 className="page-title">tasks</h1>
              <span className="counts">
                <b>{active.length}</b> active <span className="dot">·</span>{' '}
                <b style={{ color: '#3f8f5b' }}>{done.length}</b> done
              </span>
            </header>
            <div className="page-scroll">
              <ul className="task-list">
                {loading ? (
                  <li className="empty">loading…</li>
                ) : tasks.length === 0 ? (
                  <li className="empty">nothing here yet — add a task below.</li>
                ) : (
                  <>
                    {active.map(renderTask)}
                    {done.length > 0 && <li className="group-sep">completed</li>}
                    {done.map(renderTask)}
                  </>
                )}
              </ul>
            </div>
            <div className="page-bar">
              <div className={'bar-hint' + (showHint ? ' show' : '')}>{hintText}</div>
              <form className="bar-form" onSubmit={handleAddTask}>
                <input
                  className="bar-input"
                  placeholder="task name…"
                  autoComplete="off"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
                <div className="date-wrap">
                  <button
                    className={'icon-btn sketch' + (dateInput ? ' set' : '')}
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        className="stroke"
                        d="M4 7 C 9 5, 15 9, 20 6 L20 19 C 15 21, 9 18, 4 20 Z"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        className="stroke"
                        d="M8 4 L8 8 M16 5 L16 9 M4 11 H20"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="date-dot" />
                  </button>
                  <input
                    type="date"
                    className="date-overlay"
                    aria-label="set deadline"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                  />
                </div>
                <button className="plus-btn sketch" type="submit" aria-label="add task">
                  <span>+</span>
                </button>
              </form>
            </div>
          </section>

          {/* ============ PAGE 2 — RECURRING ============ */}
          <section className="page">
            <header className="page-head">
              <h1 className="page-title">recurring</h1>
            </header>
            <div className="page-scroll">
              <ul className="rec-list">
                {loading ? (
                  <li className="empty">loading…</li>
                ) : recurring.length === 0 ? (
                  <li className="empty">no habits yet — add one below.</li>
                ) : (
                  sortedRec.map((r) => {
                    const due = isRecDueToday(r)
                    const doneToday = r.last_done === todayISO()
                    const badgeClass = due ? 'due' : doneToday ? 'done-t' : 'not-today'
                    const badgeText = due
                      ? recLabel(r) + ' · due'
                      : doneToday
                        ? 'done today'
                        : recLabel(r)
                    return (
                      <li className="rec-task" key={r.id}>
                        <div className="rec-body">
                          <div className="rec-name">{r.name}</div>
                          <span className={'rec-badge ' + badgeClass}>{badgeText}</span>
                        </div>
                        <button
                          className="rec-trash"
                          aria-label="delete"
                          onClick={() => deleteRecurring(r.id)}
                        >
                          <TrashIcon />
                        </button>
                        <button
                          className="rec-tick sketch"
                          disabled={doneToday}
                          aria-label="tick"
                          onClick={() => tickRecurring(r.id)}
                        >
                          <svg viewBox="0 0 24 24">{doneToday && <CheckIcon />}</svg>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>
            <div className="page-bar">
              <form className="bar-form" onSubmit={handleAddRec}>
                <input
                  className="bar-input"
                  placeholder="habit name…"
                  autoComplete="off"
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                />
                <InkDrop
                  value={recFreq}
                  onChange={(v) => setRecFreq(v as Freq)}
                  options={[
                    { val: 'daily', label: 'daily' },
                    { val: 'weekdays', label: 'weekdays' },
                    { val: 'weekly', label: 'weekly' },
                    { val: 'monthly', label: 'monthly' },
                  ]}
                />
                {recFreq === 'weekly' && (
                  <InkDrop
                    value={String(recWeekday)}
                    onChange={(v) => setRecWeekday(parseInt(v, 10))}
                    triggerLabel={(label) => label.slice(0, 3)}
                    options={[
                      { val: '1', label: 'monday' },
                      { val: '2', label: 'tuesday' },
                      { val: '3', label: 'wednesday' },
                      { val: '4', label: 'thursday' },
                      { val: '5', label: 'friday' },
                      { val: '6', label: 'saturday' },
                      { val: '0', label: 'sunday' },
                    ]}
                  />
                )}
                <button className="plus-btn sketch" type="submit" aria-label="add habit">
                  <span>+</span>
                </button>
              </form>
            </div>
          </section>

          {/* ============ PAGE 3 — CALENDAR ============ */}
          <section className="page">
            <header className="page-head">
              <h1 className="page-title">calendar</h1>
            </header>
            <div className="page-scroll">
              <div className="cal-nav">
                <button className="cal-nav-btn" type="button" onClick={prevMonth}>
                  ←
                </button>
                <button
                  className="cal-month"
                  type="button"
                  onClick={() => setSheetCtx({ type: 'month' })}
                >
                  {MONTHS[calMonth]} {calYear} <span className="mini-caret">▾</span>
                </button>
                <button className="cal-nav-btn" type="button" onClick={nextMonth}>
                  →
                </button>
              </div>
              <div className="cal-dow">
                <span>M</span><span>T</span><span>W</span><span>T</span>
                <span>F</span><span>S</span><span>S</span>
              </div>
              <div className="cal-grid">{calCells}</div>
              <p className="cal-tip">tap a day for its tasks · tap the month for all of them</p>
              <div className="cal-legend">
                <span>
                  <i style={{ background: 'var(--due)' }} /> to do
                </span>
                <span>
                  <i style={{ background: 'var(--done)' }} /> done
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ============ TAB BAR ============ */}
        <nav className="tabbar">
          <button
            className={'tab' + (activePage === 0 ? ' active' : '')}
            type="button"
            onClick={() => goToPage(0)}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path className="tab-ink" d="M4 7 C 9 5, 15 9, 20 6" strokeWidth="2" strokeLinecap="round" />
              <path className="tab-ink" d="M4 13 C 9 11, 15 15, 20 12" strokeWidth="2" strokeLinecap="round" />
              <path className="tab-ink" d="M4 19 C 9 17, 15 21, 20 18" strokeWidth="2" strokeLinecap="round" />
            </svg>
            tasks
          </button>
          <button
            className={'tab' + (activePage === 1 ? ' active' : '')}
            type="button"
            onClick={() => goToPage(1)}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path className="tab-ink" d="M5 12 A 7 7 0 1 1 8 18" strokeWidth="2" strokeLinecap="round" />
              <path
                className="tab-ink"
                d="M5 7 L5 12 L9 12"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            recurring
          </button>
          <button
            className={'tab' + (activePage === 2 ? ' active' : '')}
            type="button"
            onClick={() => goToPage(2)}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path
                className="tab-ink"
                d="M4 6 C 9 4, 15 8, 20 5 L20 19 C 15 22, 9 18, 4 20 Z"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                className="tab-ink"
                d="M8 4 L8 8 M16 5 L16 9 M4 11 H20"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            calendar
          </button>
          <button className="tab" type="button" onClick={signOut}>
            <svg viewBox="0 0 24 24" fill="none">
              <circle className="tab-ink" cx="12" cy="8" r="3.2" strokeWidth="2" />
              <path
                className="tab-ink"
                d="M5 20 C 5 15, 8.5 13, 12 13 C 15.5 13, 19 15, 19 20"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            sign out
          </button>
        </nav>
      </div>

      {/* ============ BOTTOM SHEET ============ */}
      <div
        className={'sheet-backdrop' + (sheetOpen ? ' open' : '')}
        onClick={() => setSheetCtx(null)}
      />
      <div className={'bottom-sheet' + (sheetOpen ? ' open' : '')} role="dialog" aria-modal="true">
        <div className="sheet-grab" />
        <header className="sheet-head">
          <h3 className="sheet-title">{sheet.title}</h3>
          <button className="sheet-close" type="button" aria-label="close" onClick={() => setSheetCtx(null)}>
            ✕
          </button>
        </header>
        <div className="sheet-body">
          <ul className="task-list">{sheet.body}</ul>
        </div>
      </div>
    </div>
  )
}
