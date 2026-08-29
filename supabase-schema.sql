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

-- ── Competitions (added 2026-08) ─────────────────────────────────────────────
-- If the tables above already exist, paste and run JUST this section once.
-- Same timestamp rule as above: app-authoritative, no now() defaults/triggers.
-- matches is a jsonb array of {outcome, myPoints, theirPoints, submission};
-- jsonb carries no per-field CHECKs, and with no auth the app sanitizes every
-- pulled row anyway — the db only guards the outer shape here.

create table if not exists public.competitions (
  id           text primary key,
  user_id      text not null default 'dmitrii',
  date         date not null,
  title        text not null default 'Competition',
  gi           boolean not null,
  cardio       integer not null check (cardio between 0 and 5),  -- 0 = unrated; 1 fine … 5 gassed
  worked_well  text not null default '',
  didnt_work   text not null default '',
  matches      jsonb not null default '[]'::jsonb check (jsonb_typeof(matches) = 'array'),
  created_at   timestamptz not null,
  updated_at   timestamptz not null
);

create index if not exists competitions_user_date_idx on public.competitions (user_id, date);

alter table public.competitions enable row level security;

-- Postgres has no `create policy if not exists`; drop-then-create keeps this
-- section idempotent.
drop policy if exists competitions_select on public.competitions;
drop policy if exists competitions_insert on public.competitions;
drop policy if exists competitions_update on public.competitions;
create policy competitions_select on public.competitions for select to anon using (true);
create policy competitions_insert on public.competitions for insert to anon with check (user_id = 'dmitrii');
create policy competitions_update on public.competitions for update to anon using (true) with check (user_id = 'dmitrii');

revoke delete on public.competitions from anon;

-- ── Session start time (added 2026-08) ───────────────────────────────────────
-- Local wall-clock 'HH:MM' of when the session actually started (the log form
-- gained a time picker — sessions are often logged the morning after). Null on
-- rows from before the picker. Idempotent; run once.

alter table public.sessions add column if not exists "time" text
  check ("time" is null or "time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ── Competition placement + technique tags (added 2026-08) ───────────────────
-- Podium finish per event and the techniques worked during it — evidence for
-- the goal milestones (AJP medal, open guard in competition). Idempotent;
-- run once. Apply BEFORE deploying the build that pushes these columns.

alter table public.competitions add column if not exists placement text not null default 'none'
  check (placement in ('none', 'bronze', 'silver', 'gold'));
alter table public.competitions add column if not exists tags text[] not null default '{}';
