-- =============================================================================
-- Growthify Edge OS — 0009 PAYROLL GENERATION (Phase 5)
-- Snapshot-based, idempotent monthly payroll generation. READ-ONLY against
-- attendance, leave and KPI data — it only writes to payroll_runs.
--
-- Safety guarantees:
--   * Idempotent: unique (agent, month). Re-running UPDATES the existing draft/
--     reviewed run in place (never duplicates). Approved/paid runs are blocked.
--   * Snapshot: every figure (salary, KPI, attendance, leave, bonuses,
--     deductions) is frozen onto the row, so later KPI/attendance changes never
--     alter historical payroll.
--   * Admin override (override_amount) and admin_note are preserved across
--     regeneration; final_payable = override_amount ?? computed_payable.
-- =============================================================================

-- Snapshot of productive time (seconds) — additive.
alter table public.payroll_runs
  add column if not exists productive_seconds integer not null default 0;

-- -----------------------------------------------------------------------------
-- Generate (or safely refresh) one agent's payroll for a month.
-- -----------------------------------------------------------------------------
create or replace function public.generate_payroll(p_agent uuid, p_month date)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   date := date_trunc('month', p_month)::date;
  v_start    date := date_trunc('month', p_month)::date;
  v_end      date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_last     date := (date_trunc('month', p_month) + interval '1 month')::date - 1;
  v_settings public.payroll_settings;
  v_existing public.payroll_runs;
  v_run      public.payroll_runs;
  v_present  numeric;
  v_late     int;
  v_leave    numeric;
  v_absence  numeric;
  v_kpi      jsonb;
  v_completed int;
  v_target   numeric;
  v_net      numeric;
  v_productive int;
  v_bonus    numeric;
  v_manual   numeric;
  v_leave_ded numeric;
  v_total_ded numeric;
  v_computed numeric;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_settings from public.payroll_settings where agent_id = p_agent;
  if not found then raise exception 'No payroll settings for this agent.'; end if;

  -- Idempotency: never clobber a finalized run.
  select * into v_existing from public.payroll_runs
   where agent_id = p_agent and period_month = v_period;
  if found and v_existing.status in ('approved', 'paid') then
    raise exception 'Payroll for % is already %; regeneration is blocked.',
      v_period, v_existing.status;
  end if;

  -- ---- Attendance snapshot (read-only) ----
  select count(*)::numeric, count(*) filter (where is_late)
    into v_present, v_late
    from public.attendance_sessions
   where agent_id = p_agent and work_date >= v_start and work_date < v_end;
  v_present := coalesce(v_present, 0);
  v_late := coalesce(v_late, 0);

  -- ---- Approved leave days in month (approved only; half-day = 0.5) ----
  select coalesce(sum(
           case when is_half_day then 0.5
                else (least(end_date, v_last) - greatest(start_date, v_start) + 1)::numeric
           end), 0)
    into v_leave
    from public.leave_requests
   where agent_id = p_agent and status = 'approved'
     and start_date <= v_last and end_date >= v_start;

  -- Unapproved absence = expected working days not covered by attendance or
  -- approved leave. Rejected/pending leave is NOT credited, so it shows up here.
  v_absence := greatest(0, v_settings.working_days_per_month::numeric - v_present - v_leave);
  v_leave_ded := round(v_absence * v_settings.daily_rate, 2);

  -- ---- KPI snapshot (reused from get_agent_kpis — no duplicated logic) ----
  v_kpi := public.get_agent_kpis(p_agent, v_period);
  v_completed  := coalesce((v_kpi ->> 'completed_tasks')::int, 0);
  v_target     := coalesce((v_kpi ->> 'target_achievement_pct')::numeric, 0);
  v_net        := coalesce((v_kpi ->> 'net_points')::numeric, 0);
  v_productive := coalesce((v_kpi ->> 'productive_seconds')::int, 0);

  -- ---- Bonus / deduction snapshot ----
  select coalesce(sum(amount) filter (where kind = 'bonus'), 0),
         coalesce(sum(amount) filter (where kind = 'deduction'), 0)
    into v_bonus, v_manual
    from public.payroll_adjustments
   where agent_id = p_agent and period_month = v_period;

  v_total_ded := v_manual + v_leave_ded;
  v_computed  := round(v_settings.monthly_salary + v_bonus - v_total_ded, 2);

  insert into public.payroll_runs as pr (
    agent_id, period_month, base_salary, currency, working_days, daily_rate,
    present_days, approved_leave_days, unapproved_absence_days, late_count, productive_seconds,
    leave_deduction, total_bonuses, total_manual_deductions, total_deductions,
    completed_tasks, target_pct, net_kpi_points,
    computed_payable, final_payable, created_by
  ) values (
    p_agent, v_period, v_settings.monthly_salary, v_settings.currency,
    v_settings.working_days_per_month, v_settings.daily_rate,
    v_present, v_leave, v_absence, v_late, v_productive,
    v_leave_ded, v_bonus, v_manual, v_total_ded,
    v_completed, v_target, v_net,
    v_computed, v_computed, auth.uid()
  )
  on conflict (agent_id, period_month) do update set
    base_salary = excluded.base_salary,
    currency = excluded.currency,
    working_days = excluded.working_days,
    daily_rate = excluded.daily_rate,
    present_days = excluded.present_days,
    approved_leave_days = excluded.approved_leave_days,
    unapproved_absence_days = excluded.unapproved_absence_days,
    late_count = excluded.late_count,
    productive_seconds = excluded.productive_seconds,
    leave_deduction = excluded.leave_deduction,
    total_bonuses = excluded.total_bonuses,
    total_manual_deductions = excluded.total_manual_deductions,
    total_deductions = excluded.total_deductions,
    completed_tasks = excluded.completed_tasks,
    target_pct = excluded.target_pct,
    net_kpi_points = excluded.net_kpi_points,
    computed_payable = excluded.computed_payable,
    -- preserve override_amount, admin_note and status; refresh final
    final_payable = coalesce(pr.override_amount, excluded.computed_payable),
    updated_at = now()
  returning * into v_run;

  return v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- Generate payroll for all active agents for a month. Skips agents whose run is
-- already approved/paid (and any individual failure) without aborting the batch.
-- Returns the number of runs generated/refreshed.
-- -----------------------------------------------------------------------------
create or replace function public.generate_payroll_all(p_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', p_month)::date;
  a record;
  v_count int := 0;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  for a in
    select ps.agent_id
    from public.payroll_settings ps
    join public.profiles p on p.id = ps.agent_id
    where ps.is_active and p.role = 'agent' and p.is_active
  loop
    begin
      perform public.generate_payroll(a.agent_id, v_period);
      v_count := v_count + 1;
    exception when others then
      continue; -- skip finalized/errored agents, keep going
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_payroll(uuid, date) to authenticated;
grant execute on function public.generate_payroll_all(date) to authenticated;
