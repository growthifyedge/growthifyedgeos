-- =============================================================================
-- Growthify Edge OS — 0013 PAYROLL PERIODS, LEAVE & LATE RULES
-- Additive & idempotent. Implements:
--   * 30-minute login grace (config).
--   * Date-range payroll periods (initial trial 21-30 Jun 2026, then full
--     calendar months from 1 Jul 2026) driven by app_settings.payroll_start_date.
--   * Approved leave = excused (not absent, no performance penalty) BUT unpaid
--     (salary deducted) and reported separately.
--   * Monthly late allowance (default 2); lates beyond allowance each convert to
--     one absent-day salary deduction. Reset every payroll period.
-- Does NOT touch attendance/leave/KPI records — read-only integration.
-- =============================================================================

-- ---- Settings ----
alter table public.app_settings
  add column if not exists payroll_start_date date not null default '2026-06-21';
alter table public.app_settings
  add column if not exists allowed_late_per_month integer not null default 2;
alter table public.app_settings
  alter column grace_period_minutes set default 30;

-- 30-minute grace period (rule #2).
update public.app_settings set grace_period_minutes = 30 where id = 1;

-- ---- payroll_runs new snapshot columns ----
alter table public.payroll_runs add column if not exists period_start date;
alter table public.payroll_runs add column if not exists period_end date;
alter table public.payroll_runs add column if not exists is_trial boolean not null default false;
alter table public.payroll_runs add column if not exists total_working_days numeric(6,2) not null default 0;
alter table public.payroll_runs add column if not exists approved_leave_deduction numeric(12,2) not null default 0;
alter table public.payroll_runs add column if not exists allowed_late_count integer not null default 0;
alter table public.payroll_runs add column if not exists late_to_absent_days numeric(5,1) not null default 0;
alter table public.payroll_runs add column if not exists late_to_absent_deduction numeric(12,2) not null default 0;

-- -----------------------------------------------------------------------------
-- generate_payroll — period-aware, leave/late-rule-aware. Snapshot + idempotent.
-- leave_deduction column now holds the UNAPPROVED-ABSENT deduction; approved
-- leave + late-to-absent are separate columns. total_deductions sums them all.
-- -----------------------------------------------------------------------------
create or replace function public.generate_payroll(p_agent uuid, p_month date)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period     date := date_trunc('month', p_month)::date;
  v_now_period date := date_trunc('month', current_date)::date;
  v_month_end  date := (date_trunc('month', p_month) + interval '1 month')::date - 1;
  v_app        public.app_settings;
  v_start_month date;
  v_start      date;
  v_end        date;
  v_eff_end    date;
  v_is_trial   boolean := false;
  v_days_in_month numeric;
  v_period_days numeric;
  v_settings   public.payroll_settings;
  v_existing   public.payroll_runs;
  v_run        public.payroll_runs;
  v_expected   numeric;
  v_present    numeric;
  v_late       int;
  v_leave      numeric;
  v_absence    numeric;
  v_allowed    int;
  v_late_abs   numeric;
  v_kpi        jsonb;
  v_completed  int;
  v_target     numeric;
  v_net        numeric;
  v_productive int;
  v_bonus      numeric;
  v_manual     numeric;
  v_absent_ded numeric;
  v_leave_ded  numeric;
  v_late_ded   numeric;
  v_total_ded  numeric;
  v_computed   numeric;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_app from public.app_settings where id = 1;
  v_start_month := date_trunc('month', v_app.payroll_start_date)::date;

  if v_period < v_start_month then
    raise exception 'Payroll tracking starts %; cannot generate for %.',
      v_app.payroll_start_date, v_period;
  end if;
  if v_period > v_now_period then
    raise exception 'Cannot generate payroll for a future month (%).', v_period;
  end if;

  select * into v_settings from public.payroll_settings where agent_id = p_agent;
  if not found then raise exception 'No payroll settings for this agent.'; end if;

  select * into v_existing from public.payroll_runs
   where agent_id = p_agent and period_month = v_period;
  if found and v_existing.status in ('approved', 'paid') then
    raise exception 'Payroll for % is already %; regeneration is blocked.',
      v_period, v_existing.status;
  end if;

  -- ---- Period window ----
  if v_period = v_start_month and v_app.payroll_start_date > v_period then
    v_start := v_app.payroll_start_date;   -- initial trial period (mid-month start)
    v_is_trial := true;
  else
    v_start := v_period;
  end if;
  v_end := v_month_end;
  -- Effective end caps the in-progress period at today (proration of future days).
  if v_now_period = v_period then
    v_eff_end := least(v_end, current_date);
  else
    v_eff_end := v_end;
  end if;

  v_days_in_month := extract(day from v_month_end)::numeric;
  v_period_days := greatest(0, (v_eff_end - v_start + 1))::numeric;
  v_expected := round(v_settings.working_days_per_month::numeric * v_period_days / v_days_in_month, 2);

  -- ---- Attendance / late (within the effective period) ----
  select count(*)::numeric, count(*) filter (where is_late)
    into v_present, v_late
    from public.attendance_sessions
   where agent_id = p_agent and work_date >= v_start and work_date <= v_eff_end;
  v_present := coalesce(v_present, 0);
  v_late := coalesce(v_late, 0);

  -- ---- Approved leave days (excused, unpaid) ----
  select coalesce(sum(
           case when is_half_day then 0.5
                else (least(end_date, v_eff_end) - greatest(start_date, v_start) + 1)::numeric
           end), 0)
    into v_leave
    from public.leave_requests
   where agent_id = p_agent and status = 'approved'
     and start_date <= v_eff_end and end_date >= v_start;

  -- ---- Late allowance: lates beyond allowance each become 1 absent day ----
  v_allowed := coalesce(v_app.allowed_late_per_month, 2);
  v_late_abs := greatest(0, v_late - v_allowed);

  -- Unapproved absence excludes approved-leave days (those are deducted separately).
  v_absence := greatest(0, v_expected - v_present - v_leave);

  -- ---- KPI snapshot (reused) ----
  v_kpi := public.get_agent_kpis(p_agent, v_period);
  v_completed  := coalesce((v_kpi ->> 'completed_tasks')::int, 0);
  v_target     := coalesce((v_kpi ->> 'target_achievement_pct')::numeric, 0);
  v_net        := coalesce((v_kpi ->> 'net_points')::numeric, 0);
  v_productive := coalesce((v_kpi ->> 'productive_seconds')::int, 0);

  -- ---- Adjustments ----
  select coalesce(sum(amount) filter (where kind = 'bonus'), 0),
         coalesce(sum(amount) filter (where kind = 'deduction'), 0)
    into v_bonus, v_manual
    from public.payroll_adjustments
   where agent_id = p_agent and period_month = v_period;

  -- ---- Deductions ----
  v_absent_ded := round(v_absence * v_settings.daily_rate, 2);
  v_leave_ded  := round(v_leave * v_settings.daily_rate, 2);      -- approved leave (unpaid)
  v_late_ded   := round(v_late_abs * v_settings.daily_rate, 2);   -- late -> absent
  v_total_ded  := v_absent_ded + v_leave_ded + v_late_ded + v_manual;
  v_computed   := round(v_settings.monthly_salary + v_bonus - v_total_ded, 2);

  insert into public.payroll_runs as pr (
    agent_id, period_month, period_start, period_end, is_trial,
    base_salary, currency, working_days, total_working_days, daily_rate,
    present_days, approved_leave_days, unapproved_absence_days,
    late_count, allowed_late_count, late_to_absent_days, productive_seconds,
    leave_deduction, approved_leave_deduction, late_to_absent_deduction,
    total_bonuses, total_manual_deductions, total_deductions,
    completed_tasks, target_pct, net_kpi_points,
    computed_payable, final_payable, created_by, last_generated_at
  ) values (
    p_agent, v_period, v_start, v_end, v_is_trial,
    v_settings.monthly_salary, v_settings.currency, v_settings.working_days_per_month, v_expected, v_settings.daily_rate,
    v_present, v_leave, v_absence,
    v_late, v_allowed, v_late_abs, v_productive,
    v_absent_ded, v_leave_ded, v_late_ded,
    v_bonus, v_manual, v_total_ded,
    v_completed, v_target, v_net,
    v_computed, v_computed, auth.uid(), now()
  )
  on conflict (agent_id, period_month) do update set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    is_trial = excluded.is_trial,
    base_salary = excluded.base_salary,
    currency = excluded.currency,
    working_days = excluded.working_days,
    total_working_days = excluded.total_working_days,
    daily_rate = excluded.daily_rate,
    present_days = excluded.present_days,
    approved_leave_days = excluded.approved_leave_days,
    unapproved_absence_days = excluded.unapproved_absence_days,
    late_count = excluded.late_count,
    allowed_late_count = excluded.allowed_late_count,
    late_to_absent_days = excluded.late_to_absent_days,
    productive_seconds = excluded.productive_seconds,
    leave_deduction = excluded.leave_deduction,
    approved_leave_deduction = excluded.approved_leave_deduction,
    late_to_absent_deduction = excluded.late_to_absent_deduction,
    total_bonuses = excluded.total_bonuses,
    total_manual_deductions = excluded.total_manual_deductions,
    total_deductions = excluded.total_deductions,
    completed_tasks = excluded.completed_tasks,
    target_pct = excluded.target_pct,
    net_kpi_points = excluded.net_kpi_points,
    computed_payable = excluded.computed_payable,
    final_payable = coalesce(pr.override_amount, excluded.computed_payable),
    last_generated_at = now(),
    updated_at = now()
  returning * into v_run;

  return v_run;
end;
$$;
