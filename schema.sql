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

-- Version 7: isolated account workspace; old tables and legacy keys remain for rollback.
create table if not exists public.study_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null, revision integer not null default 1 check(revision > 0),
 updated_at timestamptz not null default now(),
 constraint workspace_size check(octet_length(payload::text) < 12000000)
);
alter table public.study_workspaces enable row level security;
grant select,insert,update,delete on public.study_workspaces to authenticated;
drop policy if exists workspace_owner on public.study_workspaces;
create policy workspace_owner on public.study_workspaces for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
