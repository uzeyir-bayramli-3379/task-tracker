'use client'

/* ===================================================================
   TASK TRACKER — shared parent.

   This component owns the ONE Supabase connection: it fetches data,
   holds tasks/recurring/auth state, and exposes the CRUD functions.
   It then renders the desktop or mobile UI based on viewport width,
   handing both the exact same data + callbacks via props. The two UIs
   are purely presentational — there is only ever one Supabase client.
=================================================================== */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useWindowWidth } from './useWindowWidth'
import DesktopApp from './DesktopApp'
import MobileApp from './MobileApp'
import { todayISO, type Task, type Freq, type Recurring, type AppProps } from './shared'

export default function Home() {
  const router = useRouter()
  // createBrowserClient is cheap, but keep one stable instance per mount.
  const [supabase] = useState(() => createClient())

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [recurring, setRecurring] = useState<Recurring[]>([])

  // ---- initial load ------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const [taskRes, recRes] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('recurring').select('*'),
      ])
      if (cancelled) return
      setTasks((taskRes.data as Task[]) ?? [])
      setRecurring((recRes.data as Recurring[]) ?? [])
      setLoading(false)
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [supabase, router])

  // ---- task actions ------------------------------------------------
  async function addTask(name: string, deadline: string) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ name, deadline: deadline || null })
      .select()
      .single()
    if (!error && data) setTasks((ts) => [...ts, data as Task])
  }

  async function toggleTask(id: string) {
    const t = tasks.find((t) => t.id === id)
    if (!t) return
    const done = !t.done
    const completed_at = done ? new Date().toISOString() : null
    // optimistic
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done, completed_at } : x)))
    await supabase.from('tasks').update({ done, completed_at }).eq('id', id)
  }

  async function deleteTask(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  // ---- recurring actions -------------------------------------------
  async function addRecurring(name: string, freq: Freq, weekday: number) {
    const { data, error } = await supabase
      .from('recurring')
      .insert({ name, freq, weekday: freq === 'weekly' ? weekday : 0, last_done: null })
      .select()
      .single()
    if (!error && data) setRecurring((rs) => [...rs, data as Recurring])
  }

  async function tickRecurring(id: string) {
    const today = todayISO()
    setRecurring((rs) => rs.map((r) => (r.id === id ? { ...r, last_done: today } : r)))
    await supabase.from('recurring').update({ last_done: today }).eq('id', id)
  }

  async function deleteRecurring(id: string) {
    setRecurring((rs) => rs.filter((r) => r.id !== id))
    await supabase.from('recurring').delete().eq('id', id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ---- responsive layout switch ------------------------------------
  const width = useWindowWidth()

  const props: AppProps = {
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
  }

  // width === 0 means we haven't measured yet (SSR / first paint).
  // Render nothing until we know, so we never flash the wrong layout.
  if (width === 0) return null

  return width > 900 ? <DesktopApp {...props} /> : <MobileApp {...props} />
}
