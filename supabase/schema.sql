-- Task Tracker schema. Run once in the Supabase SQL editor.
-- Each row is owned by a user (auth.uid()) and protected by RLS so
-- users can only ever read/write their own tasks & habits.

-- ---- tasks ---------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name         text not null,
  deadline     date,                       -- null = no deadline
  done         boolean not null default false,
  completed_at timestamptz,                -- set when ticked; orders "completed"
  created_at   timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks are private to their owner"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- recurring habits ---------------------------------------------
create table if not exists public.recurring (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  freq       text not null check (freq in ('daily', 'weekdays', 'weekly', 'monthly')),
  weekday    int  not null default 0,      -- 0=Sun..6=Sat, only used for 'weekly'
  last_done  date,                         -- null = never completed
  created_at timestamptz not null default now()
);

alter table public.recurring enable row level security;

create policy "recurring habits are private to their owner"
  on public.recurring for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
