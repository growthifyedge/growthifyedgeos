-- =============================================================================
-- Growthify Edge OS — 0008 COMPENSATION & PAYROLL (V1.5)
-- Lightweight, editable, DB-driven payroll. Reuses profiles / attendance /
-- leave / KPI architecture. No tax, banking, or payslip logic (kept scalable
-- for later). Safe to run on an existing database.
--
-- Tables:
--   payroll_settings    1:1 per agent — salary config (+ generated daily_rate)
--   payroll_adjustments  N per agent/month — bonuses (+) and deductions (-)
--   payroll_runs         1 per agent/month — generated monthly snapshot + status
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Agency base currency — the fallback default for new agent payroll settings.
-- Additive & idempotent; existing app_settings row defaults to 'USD'.
-- -----------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists base_currency text not null default 'USD';

-- -----------------------------------------------------------------------------
-- PAYROLL SETTINGS (per agent)
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_settings (
  agent_id               uuid primary key references public.profiles (id) on delete cascade,
  monthly_salary         numeric(12,2) not null default 0,
  currency               text not null default 'USD',
  salary_type            text not null default 'monthly'
                           check (salary_type in ('monthly', 'fixed')),
  working_days_per_month integer not null default 26 check (working_days_per_month > 0),
  -- Daily rate is always derived = monthly_salary / working_days_per_month.
  daily_rate             numeric(12,2)
                           generated always as
                           (round(monthly_salary / nullif(working_days_per_month, 0), 2)) stored,
  joining_date           date,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- PAYROLL ADJUSTMENTS (bonuses & deductions)
-- period_month is normalized to the first day of the month by the app.
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_adjustments (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references public.profiles (id) on delete cascade,
  period_month date not null,
  kind         text not null check (kind in ('bonus', 'deduction')),
  category     text not null,                 -- e.g. performance_bonus, salary_advance
  amount       numeric(12,2) not null check (amount >= 0),
  reason       text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_payadj_agent_period
  on public.payroll_adjustments (agent_id, period_month);

-- -----------------------------------------------------------------------------
-- PAYROLL RUNS (monthly snapshot per agent)
-- final_payable is always derived = override_amount (if set) else computed_payable.
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id                      uuid primary key default gen_random_uuid(),
  agent_id                uuid not null references public.profiles (id) on delete cascade,
  period_month            date not null,
  -- salary snapshot
  base_salary             numeric(12,2) not null default 0,
  currency                text not null default 'USD',
  working_days            integer not null default 26,
  daily_rate              numeric(12,2) not null default 0,
  -- attendance / leave snapshot
  present_days            numeric(5,1) not null default 0,
  approved_leave_days     numeric(5,1) not null default 0,
  unapproved_absence_days numeric(5,1) not null default 0,
  late_count              integer not null default 0,
  -- money breakdown
  leave_deduction         numeric(12,2) not null default 0,
  total_bonuses           numeric(12,2) not null default 0,
  total_manual_deductions numeric(12,2) not null default 0,
  total_deductions        numeric(12,2) not null default 0,
  -- KPI snapshot (reused from get_agent_kpis)
  completed_tasks         integer not null default 0,
  target_pct              numeric(6,2) not null default 0,
  net_kpi_points          numeric(12,2) not null default 0,
  -- payable
  computed_payable        numeric(12,2) not null default 0,
  override_amount         numeric(12,2),
  -- Editable, app-maintained: final_payable = override_amount when set,
  -- otherwise computed_payable. Kept as a normal column (NOT generated) so the
  -- approval workflow and manual admin adjustments stay flexible.
  final_payable           numeric(12,2) not null default 0,
  -- workflow
  status                  text not null default 'draft'
                            check (status in ('draft', 'reviewed', 'approved', 'paid')),
  admin_note              text,
  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (agent_id, period_month)
);
create index if not exists idx_payrun_period on public.payroll_runs (period_month);
create index if not exists idx_payrun_agent  on public.payroll_runs (agent_id);

-- Idempotency guard: if an earlier run of this file created final_payable as a
-- GENERATED column, convert it to a normal editable column (keeps the data).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payroll_runs'
      and column_name = 'final_payable'
      and is_generated = 'ALWAYS'
  ) then
    alter table public.payroll_runs alter column final_payable drop expression;
    alter table public.payroll_runs alter column final_payable set default 0;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- updated_at triggers (reuse helper from 0003)
-- -----------------------------------------------------------------------------
drop trigger if exists trg_payroll_settings_updated on public.payroll_settings;
create trigger trg_payroll_settings_updated before update on public.payroll_settings
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_payroll_runs_updated on public.payroll_runs;
create trigger trg_payroll_runs_updated before update on public.payroll_runs
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — agents read their own; only admins write. (RPC generation in 0009.)
-- -----------------------------------------------------------------------------
alter table public.payroll_settings    enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.payroll_runs        enable row level security;

drop policy if exists payroll_settings_select on public.payroll_settings;
create policy payroll_settings_select on public.payroll_settings
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists payroll_settings_admin on public.payroll_settings;
create policy payroll_settings_admin on public.payroll_settings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payroll_adj_select on public.payroll_adjustments;
create policy payroll_adj_select on public.payroll_adjustments
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists payroll_adj_admin on public.payroll_adjustments;
create policy payroll_adj_admin on public.payroll_adjustments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists payroll_runs_admin on public.payroll_runs;
create policy payroll_runs_admin on public.payroll_runs
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Seed a default settings row for every existing agent (idempotent).
-- -----------------------------------------------------------------------------
insert into public.payroll_settings (agent_id)
select id from public.profiles where role = 'agent'
on conflict (agent_id) do nothing;
