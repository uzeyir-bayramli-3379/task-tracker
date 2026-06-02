'use client'

/* ===================================================================
   DESKTOP UI — the three-pane "paper sheet" layout.

   Presentational only: it receives tasks, recurring, and every CRUD
   callback from the shared parent (app/page.tsx). All local state here
   is view state (form inputs, which view is active, delete confirms).
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

// ---- week view helpers --------------------------------------------
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(offset: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function dayISO(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

// ---- small SVG icons ----------------------------------------------
const CheckIcon = ({ color = '#3f8f5b' }: { color?: string }) => (
  <svg viewBox="0 0 24 24">
    <path
      d="M4 13 C 7 16, 9 18, 10 19 C 13 13, 17 7, 21 4"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
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

// ---- custom hand-drawn dropdown -----------------------------------
function InkDrop({
  value,
  options,
  onChange,
}: {
  value: string
  options: { val: string; label: string }[]
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.val === value)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className={'ink-drop' + (open ? ' open' : '')} ref={ref}>
      <button
        className="ink-drop-trigger"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {current?.label ?? ''} <span className="drop-caret">▾</span>
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
//  DESKTOP APP
// ===================================================================
export default function DesktopApp({
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

  // views
  const [view, setView] = useState<'list' | 'week'>('list')
  const [weekOffset, setWeekOffset] = useState(0)

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

  // ---- handlers ----------------------------------------------------
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

  const etaPreview = dateInput
    ? 'eta — ' + (etaText(dateInput) || 'past date')
    : 'eta is calculated from today'

  // ---- task row ----------------------------------------------------
  function renderTask(t: Task) {
    const d = daysUntil(t.deadline)
    const soon = !t.done && d !== null && d >= 0 && d <= 2
    const over = !t.done && d !== null && d < 0
    const eta = t.done ? '' : etaText(t.deadline)

    return (
      <li className={'task' + (t.done ? ' done' : '')} key={t.id}>
        <div className="task-body">
          <span className="task-name">{t.name}</span>
          <span className="task-meta">
            {eta ? ' · eta ' + eta : ''}
            {t.deadline ? (
              <>
                {' · '}
                <span className={'m-due' + (soon ? ' soon' : '') + (over ? ' over' : '')}>
                  {dueText(t.deadline)}
                </span>
              </>
            ) : null}
          </span>
        </div>
        {t.done && <span className="stamp">COMPLETE</span>}
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
            title="delete"
            onClick={() => (t.done ? deleteTask(t.id) : setConfirmingId(t.id))}
          >
            <TrashIcon />
          </button>
        )}
        <button
          className="checkbox sketch"
          onClick={() => toggleTask(t.id)}
          style={t.done ? { borderColor: '#3f8f5b' } : undefined}
        >
          <svg viewBox="0 0 24 24">{t.done && <CheckIcon />}</svg>
        </button>
      </li>
    )
  }

  // ---- week grid ---------------------------------------------------
  function renderWeek() {
    const days = getWeekDays(weekOffset)
    const today = todayISO()
    const first = days[0]
    const last = days[6]
    const range =
      pad(first.getDate()) + '/' + pad(first.getMonth() + 1) +
      ' – ' +
      pad(last.getDate()) + '/' + pad(last.getMonth() + 1)

    return (
      <div className="week-view">
        <div className="week-nav">
          <button className="wk-nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>
            ←
          </button>
          <span className="wk-range">{range}</span>
          <button className="wk-nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>
            →
          </button>
        </div>
        <div className="week-grid">
          {days.map((day, i) => {
            const iso = dayISO(day)
            const isToday = iso === today
            const isPast = iso < today
            const dayTasks = tasks
              .filter((t) => t.deadline === iso)
              .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0))
            return (
              <div
                key={iso}
                className={'week-day' + (isToday ? ' today' : isPast ? ' past' : '')}
              >
                <div className="week-day-hdr">
                  <span className="wd-name">{DAY_NAMES[i]}</span>
                  <span className="wd-num">{day.getDate()}</span>
                </div>
                {dayTasks.length ? (
                  dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className={'week-task' + (t.done ? ' done' : '')}
                      onClick={() => toggleTask(t.id)}
                    >
                      {t.name}
                    </div>
                  ))
                ) : (
                  <span className="week-empty">—</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- render ------------------------------------------------------
  return (
    <div className="stage desktop-root">
      <div className="sheet sketch">
        {/* LEFT: add a task */}
        <aside className="sidebar">
          <h1 className="pane-title">new task</h1>
          <form className="add-form" onSubmit={handleAddTask}>
            <label className="field">
              <span className="lbl">what needs doing?</span>
              <input
                className="ink-input"
                placeholder="task name…"
                autoComplete="off"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="lbl">deadline</span>
              <input
                className="ink-input"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
              <span className="eta-preview">{etaPreview}</span>
            </label>
            <button className="add-btn sketch" type="submit">
              + add task
            </button>
          </form>
          <p className="hint">
            tip — tick the box on the right to mark a task done. it&apos;ll drop into
            &quot;completed&quot; below.
          </p>
          <button className="signout" type="button" onClick={signOut}>
            sign out
          </button>
        </aside>

        {/* DIVIDER 1 */}
        <div className="divider" aria-hidden="true">
          <svg viewBox="0 0 8 600" preserveAspectRatio="none">
            <path
              d="M4 4 C 2 150, 6 300, 3 450 S 5 560, 4 596"
              fill="none"
              stroke="#2b2b28"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* MIDDLE: task list / week view */}
        <section className="list-pane">
          <header className="list-head">
            <h2 className="pane-title">tasks</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="counts">
                <b>{active.length}</b> active <span className="dot">·</span>{' '}
                <b style={{ color: '#3f8f5b' }}>{done.length}</b> done
              </span>
              <div className="view-toggle">
                <button
                  className={'vt-btn' + (view === 'list' ? ' active' : '')}
                  onClick={() => setView('list')}
                >
                  list
                </button>
                <button
                  className={'vt-btn' + (view === 'week' ? ' active' : '')}
                  onClick={() => setView('week')}
                >
                  week
                </button>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="loading-note">loading…</div>
          ) : view === 'list' ? (
            <ul className="task-list">
              {tasks.length === 0 ? (
                <li className="empty">nothing here yet — add a task on the left.</li>
              ) : (
                <>
                  {active.map(renderTask)}
                  {done.length > 0 && <li className="group-sep">completed</li>}
                  {done.map(renderTask)}
                </>
              )}
            </ul>
          ) : (
            renderWeek()
          )}
        </section>

        {/* DIVIDER 2 */}
        <div className="divider" aria-hidden="true">
          <svg viewBox="0 0 8 600" preserveAspectRatio="none">
            <path
              d="M4 4 C 5 150, 3 300, 5 450 S 3 560, 4 596"
              fill="none"
              stroke="#2b2b28"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* RIGHT: recurring tasks */}
        <section className="rec-pane">
          <h2 className="pane-title">recurring</h2>
          <form className="rec-form" onSubmit={handleAddRec}>
            <input
              className="ink-input"
              placeholder="habit name…"
              autoComplete="off"
              value={recName}
              onChange={(e) => setRecName(e.target.value)}
            />
            <div className="rec-selects">
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
            </div>
            <button className="add-btn sketch" type="submit" style={{ fontSize: 18, padding: '7px 13px' }}>
              + add
            </button>
          </form>
          <ul className="rec-list">
            {loading ? null : recurring.length === 0 ? (
              <li className="empty" style={{ fontSize: 16 }}>
                no habits yet.
              </li>
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
                      title="delete"
                      onClick={() => deleteRecurring(r.id)}
                    >
                      <TrashIcon />
                    </button>
                    <button
                      className="rec-tick sketch"
                      disabled={doneToday}
                      onClick={() => tickRecurring(r.id)}
                    >
                      <svg viewBox="0 0 24 24">{doneToday && <CheckIcon />}</svg>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
