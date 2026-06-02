/* ===================================================================
   Shared types + pure helpers used by BOTH the desktop and mobile
   UIs. No Supabase, no React state here — just the data model and
   date math. The single Supabase connection lives in app/page.tsx
   and is handed to each UI through `AppProps`.
=================================================================== */

// ---- data model ----------------------------------------------------
export type Task = {
  id: string
  name: string
  deadline: string | null // 'YYYY-MM-DD' or null
  done: boolean
  completed_at: string | null // ISO timestamp; orders the "completed" list
}

export type Freq = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export type Recurring = {
  id: string
  name: string
  freq: Freq
  weekday: number // 0=Sun .. 6=Sat (only meaningful for 'weekly')
  last_done: string | null // 'YYYY-MM-DD' or null
}

// ---- props both layouts receive from the shared parent ------------
export type AppProps = {
  loading: boolean
  tasks: Task[]
  recurring: Recurring[]
  addTask: (name: string, deadline: string) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  addRecurring: (name: string, freq: Freq, weekday: number) => void
  tickRecurring: (id: string) => void
  deleteRecurring: (id: string) => void
  signOut: () => void
}

// ---- date helpers (pure) ------------------------------------------
export const pad = (n: number) => String(n).padStart(2, '0')

// whole days from today until the deadline (negative = overdue)
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

// friendly ETA like "3 days" or "~2 months"
export function etaText(iso: string | null): string {
  const d = daysUntil(iso)
  if (d === null || d < 0) return 'past due date'
  if (d === 0) return 'today'
  if (d === 1) return '1 day'
  if (d < 45) return d + ' days'
  const months = Math.round(d / 30)
  return '~' + months + ' month' + (months > 1 ? 's' : '')
}

// the "due ..." text shown on each task
export function dueText(iso: string | null): string {
  const d = daysUntil(iso)
  if (d === null) return ''
  if (d < 0) return 'overdue ' + Math.abs(d) + 'd'
  if (d === 0) return 'due today'
  const dt = new Date(iso + 'T00:00:00')
  return 'due ' + pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1)
}

export function todayISO(): string {
  const n = new Date()
  return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate())
}

export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function isRecDueToday(r: Recurring): boolean {
  const today = todayISO()
  const dow = new Date().getDay()
  if (r.freq === 'daily') return !r.last_done || r.last_done < today
  if (r.freq === 'weekdays') return dow >= 1 && dow <= 5 && (!r.last_done || r.last_done < today)
  if (r.freq === 'weekly') return dow === r.weekday && (!r.last_done || r.last_done < today)
  if (r.freq === 'monthly') {
    if (!r.last_done) return true
    const ld = new Date(r.last_done + 'T00:00:00')
    const td = new Date()
    return ld.getFullYear() !== td.getFullYear() || ld.getMonth() !== td.getMonth()
  }
  return false
}

export function recLabel(r: Recurring): string {
  return r.freq === 'weekly' ? 'weekly · ' + DAYS[r.weekday].slice(0, 3) : r.freq
}
