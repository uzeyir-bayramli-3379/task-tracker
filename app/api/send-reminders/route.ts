import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { pad } from '@/app/shared'

// Cron endpoint: reads the Authorization header, so it's always
// dynamic (never prerendered/cached).

type DueTask = { name: string; user_id: string }

// tomorrow as 'YYYY-MM-DD' in UTC (cron runs at 08:00 UTC)
function tomorrowISO(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
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

  const tomorrow = tomorrowISO()

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('name, user_id')
    .eq('deadline', tomorrow)
    .eq('done', false)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // group task names by user
  const byUser = new Map<string, string[]>()
  for (const t of (tasks ?? []) as DueTask[]) {
    const list = byUser.get(t.user_id) ?? []
    list.push(t.name)
    byUser.set(t.user_id, list)
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)

  let sent = 0
  const failures: string[] = []

  for (const [userId, names] of byUser) {
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId)
    const email = userData?.user?.email
    if (userErr || !email) {
      failures.push(userId)
      continue
    }

    const items = names.map((n) => `<li>${n}</li>`).join('')
    const { error: sendErr } = await resend.emails.send({
      from: 'Task Tracker <onboarding@resend.dev>',
      to: email,
      subject: `You have ${names.length} task${names.length > 1 ? 's' : ''} due tomorrow`,
      html: `<p>Reminder — these tasks are due tomorrow (${tomorrow}):</p><ul>${items}</ul>`,
    })

    if (sendErr) {
      failures.push(userId)
    } else {
      sent++
    }
  }

  return Response.json({ date: tomorrow, users: byUser.size, sent, failures })
}
