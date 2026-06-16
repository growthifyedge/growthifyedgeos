-- =============================================================================
-- Growthify Edge OS — 0001 INIT (extensions, enums, tables, indexes)
-- Agency operations tracking portal: auth/roles, attendance, tasks, KPI,
-- penalties/rewards, reporting.
-- =============================================================================

create extension if not exists "pgcrypto";        -- gen_random_uuid()
-- pg_cron is optional (for nightly KPI/penalty jobs). Enable in the Supabase
-- dashboard (Database → Extensions) if you want scheduled jobs.

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type user_role        as enum ('admin', 'agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status      as enum ('todo', 'in_progress', 'paused', 'submitted', 'revision', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority    as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('active', 'on_break', 'ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attachment_kind  as enum ('link', 'file');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_type      as enum ('penalty', 'reward');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- PROFILES  (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text,
  full_name            text not null default '',
  role                 user_role not null default 'agent',
  avatar_url           text,
  phone                text,
  is_active            boolean not null default true,
  -- Expected shift window (local time). Drives late-login / early-logout calc.
  shift_start_time     time not null default '09:00',
  shift_end_time       time not null default '18:00',
  -- Monthly targets, used by the KPI engine.
  monthly_task_target  integer not null default 60,
  monthly_hours_target numeric(6,1) not null default 160,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- LOOKUPS: clients, platforms, task types
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  contact_name  text,
  contact_email text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.platforms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  icon       text,                       -- lucide icon name (UI hint)
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.task_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  default_minutes integer not null default 60,
  is_active       boolean not null default true
);

-- -----------------------------------------------------------------------------
-- TASKS
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  instructions    text,
  client_id       uuid references public.clients (id) on delete set null,
  platform_id     uuid references public.platforms (id) on delete set null,
  task_type_id    uuid references public.task_types (id) on delete set null,
  assigned_to     uuid references public.profiles (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  priority        task_priority not null default 'medium',
  status          task_status   not null default 'todo',
  deadline        timestamptz,
  expected_minutes integer,
  -- Timeline stamps
  started_at      timestamptz,
  submitted_at    timestamptz,
  completed_at    timestamptz,
  -- Quality / rework
  revision_count  integer not null default 0,
  quality_score   numeric(3,1),                 -- 0.0 - 10.0, set by admin on completion
  -- Accumulated active working time (seconds) rolled up from task_time_logs
  active_seconds  integer not null default 0,
  -- Submitted deliverable (quick access; full history in task_attachments)
  deliverable_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);
create index if not exists idx_tasks_client      on public.tasks (client_id);
create index if not exists idx_tasks_status      on public.tasks (status);
create index if not exists idx_tasks_deadline    on public.tasks (deadline);

-- Attachments (links or files) on a task
create table if not exists public.task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  kind        attachment_kind not null default 'link',
  url         text not null,
  file_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_task_attachments_task on public.task_attachments (task_id);

-- Free-form notes / comments thread on a task
create table if not exists public.task_notes (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_notes_task on public.task_notes (task_id);

-- Status change audit trail (powers reports + activity feeds)
create table if not exists public.task_status_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  from_status task_status,
  to_status   task_status not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_task_status_history_task on public.task_status_history (task_id);

-- Per-segment task work timer logs (start/pause cycles)
create table if not exists public.task_time_logs (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks (id) on delete cascade,
  agent_id         uuid not null references public.profiles (id) on delete cascade,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer,
  created_at       timestamptz not null default now()
);
create index if not exists idx_task_time_logs_task  on public.task_time_logs (task_id);
create index if not exists idx_task_time_logs_agent on public.task_time_logs (agent_id);
-- At most one open (running) timer per agent.
create unique index if not exists uq_open_task_timer_per_agent
  on public.task_time_logs (agent_id) where (ended_at is null);

-- -----------------------------------------------------------------------------
-- ATTENDANCE
-- -----------------------------------------------------------------------------
create table if not exists public.attendance_sessions (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            uuid not null references public.profiles (id) on delete cascade,
  work_date           date not null default (now() at time zone 'utc')::date,
  shift_start         timestamptz not null default now(),
  shift_end           timestamptz,
  status              attendance_status not null default 'active',
  break_seconds       integer not null default 0,   -- accumulated break time
  work_seconds        integer not null default 0,   -- net working time (filled at end)
  is_late             boolean not null default false,
  late_minutes        integer not null default 0,
  is_early_logout     boolean not null default false,
  early_minutes       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (agent_id, work_date)                       -- one shift record per day
);
create index if not exists idx_attendance_agent on public.attendance_sessions (agent_id);
create index if not exists idx_attendance_date  on public.attendance_sessions (work_date);

create table if not exists public.break_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.attendance_sessions (id) on delete cascade,
  agent_id         uuid not null references public.profiles (id) on delete cascade,
  break_start      timestamptz not null default now(),
  break_end        timestamptz,
  duration_seconds integer,
  reason           text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_break_logs_session on public.break_logs (session_id);
-- At most one open break per session.
create unique index if not exists uq_open_break_per_session
  on public.break_logs (session_id) where (break_end is null);

-- -----------------------------------------------------------------------------
-- PENALTY / REWARD ENGINE
-- -----------------------------------------------------------------------------
-- Configurable rules (amounts + which trigger they map to)
create table if not exists public.penalty_reward_rules (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- machine key, e.g. 'late_login'
  type        ledger_type not null,
  label       text not null,
  description text,
  trigger_key text not null,                   -- late_login | missed_deadline | excessive_break | low_completion | target_achieved | extra_tasks | high_quality
  amount      numeric(10,2) not null default 0,
  unit        text not null default 'points',  -- 'points' or a currency code
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Immutable ledger of applied penalties & rewards
create table if not exists public.penalty_reward_ledger (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.profiles (id) on delete cascade,
  type           ledger_type not null,
  rule_code      text not null,
  label          text not null,
  amount         numeric(10,2) not null,
  reason         text,
  reference_type text,                          -- 'task' | 'attendance' | 'kpi'
  reference_id   uuid,
  period_month   date not null default date_trunc('month', now())::date,
  auto_generated boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_ledger_agent  on public.penalty_reward_ledger (agent_id);
create index if not exists idx_ledger_period on public.penalty_reward_ledger (period_month);
-- Idempotency: never apply the same rule twice for the same reference.
create unique index if not exists uq_ledger_dedupe
  on public.penalty_reward_ledger (agent_id, rule_code, reference_type, reference_id)
  where (reference_id is not null);

-- -----------------------------------------------------------------------------
-- GLOBAL SETTINGS (single row, id = 1)
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                      integer primary key default 1,
  grace_period_minutes    integer not null default 10,    -- late login tolerance
  max_break_minutes       integer not null default 60,    -- daily break allowance
  standard_work_minutes   integer not null default 480,   -- expected daily work (8h)
  early_logout_grace_min  integer not null default 10,
  low_completion_threshold numeric(5,2) not null default 70, -- % of monthly target
  high_quality_threshold  numeric(3,1) not null default 8.5, -- avg quality for reward
  updated_at              timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
