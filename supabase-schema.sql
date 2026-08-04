-- Rollbook sync schema. Paste into Supabase → SQL editor → Run.
--
-- Timestamps are app-authoritative: NO now() default/trigger on updated_at —
-- a trigger would corrupt last-write-wins for offline-delayed pushes (a
-- Monday edit pushed Wednesday must not beat a Tuesday edit). If you edit
-- rows by hand in SQL, set updated_at = now() so devices pick the change up.

create table public.sessions (
  id            text primary key,
  user_id       text not null default 'dmitrii',
  date          date not null,
  title         text not null default '',
  gi            boolean not null,
  rolls         integer not null check (rolls between 0 and 1000),
  subs_for      integer not null check (subs_for between 0 and 1000),
  subs_against  integer not null check (subs_against between 0 and 1000),
  round_min     integer not null check (round_min in (4, 5, 6, 8)),
  tags          text[] not null default '{}',
  created_at    timestamptz not null,
  updated_at    timestamptz not null
);

create index sessions_user_date_idx on public.sessions (user_id, date);

create table public.app_state (
  user_id     text primary key,
  state       jsonb not null,          -- { focus, tagList, settings }, app-shaped
  updated_at  timestamptz not null
);

alter table public.sessions  enable row level security;
alter table public.app_state enable row level security;

-- Anonymous access: select / insert / update only. There is deliberately no
-- delete policy, and the privilege is revoked outright — with no login yet,
-- a stranger who finds the site can add noise but can never erase history.
create policy sessions_select  on public.sessions  for select to anon using (true);
create policy sessions_insert  on public.sessions  for insert to anon with check (user_id = 'dmitrii');
create policy sessions_update  on public.sessions  for update to anon using (true) with check (user_id = 'dmitrii');
create policy app_state_select on public.app_state for select to anon using (true);
create policy app_state_insert on public.app_state for insert to anon with check (user_id = 'dmitrii');
create policy app_state_update on public.app_state for update to anon using (true) with check (user_id = 'dmitrii');

revoke delete on public.sessions  from anon;
revoke delete on public.app_state from anon;

-- Later, when real auth lands (Supabase magic link / OAuth): repoint each
-- policy at the authenticated role, e.g.
--   alter policy sessions_insert on public.sessions
--     to authenticated with check (user_id = (select auth.uid()::text));
-- backfill user_id once, and send the user's JWT as the Bearer token.
