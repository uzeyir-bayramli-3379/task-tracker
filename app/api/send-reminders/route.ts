import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { pad } from '@/app/shared'

// Cron endpoint: reads the Authorization header, so it's always
// dynamic (never prerendered/cached).

type DueTask = { name: string; user_id: string; deadline: string }

// 'YYYY-MM-DD' in UTC, offsetByDays from today (cron runs at 08:00 UTC)
function dateISO(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return (
    d.getUTCFullYear() +
    '-' +
    pad(d.getUTCMonth() + 1) +
    '-' +
    pad(d.getUTCDate())
  )
}

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const today = dateISO(0)
  const tomorrow = dateISO(1)

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('name, user_id, deadline')
    .in('deadline', [today, tomorrow])
    .eq('done', false)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // group task names by user, split into today / tomorrow buckets
  type Buckets = { today: string[]; tomorrow: string[] }
  const byUser = new Map<string, Buckets>()
  for (const t of (tasks ?? []) as DueTask[]) {
    const buckets = byUser.get(t.user_id) ?? { today: [], tomorrow: [] }
    if (t.deadline === today) buckets.today.push(t.name)
    else buckets.tomorrow.push(t.name)
    byUser.set(t.user_id, buckets)
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)

  let sent = 0
  const failures: string[] = []

  const section = (title: string, names: string[]) =>
    names.length
      ? `<h3>${title}</h3><ul>${names.map((n) => `<li>${n}</li>`).join('')}</ul>`
      : ''

  for (const [userId, buckets] of byUser) {
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId)
    const email = userData?.user?.email
    if (userErr || !email) {
      failures.push(userId)
      continue
    }

    const count = buckets.today.length + buckets.tomorrow.length
    const html =
      `<p>Reminder — here are your upcoming tasks:</p>` +
      section(`Due today (${today})`, buckets.today) +
      section(`Due tomorrow (${tomorrow})`, buckets.tomorrow)

    const { error: sendErr } = await resend.emails.send({
      from: 'Task Tracker <noreply@yourdomain.com>',
      to: email,
      subject: `You have ${count} task${count > 1 ? 's' : ''} due soon`,
      html,
    })

    if (sendErr) {
      failures.push(userId)
    } else {
      sent++
    }
  }

  return Response.json({ today, tomorrow, users: byUser.size, sent, failures })
}
