-- Execute once in Supabase SQL Editor.
create table if not exists public.study_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_key)
);
create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
create table if not exists public.notification_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date, kind)
);
alter table public.study_checks enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;
drop policy if exists "checks-own" on public.study_checks;
create policy "checks-own" on public.study_checks for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "subscriptions-own" on public.push_subscriptions;
create policy "subscriptions-own" on public.push_subscriptions for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
-- Notification logs are server-only; do not add public policies.
