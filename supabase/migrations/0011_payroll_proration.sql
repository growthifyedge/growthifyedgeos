-- =============================================================================
-- Growthify Edge OS — 0011 PAYROLL PRORATION (in-progress month fix)
-- Redefines generate_payroll so future working days are no longer counted as
-- absences. Additive & idempotent (CREATE OR REPLACE; later definition wins).
--
--   * Future month  -> generation is blocked.
--   * Current month -> expected working days are prorated by elapsed calendar
--                      days: working_days_per_month * (day-of-month / days-in-month).
--   * Past month    -> full working_days_per_month (unchanged).
--
-- Everything else (snapshot fields, idempotency, approved/paid blocks, override
-- preservation, last_generated_at) is identical to 0010.
-- =============================================================================

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
  v_now_period date := date_trunc('month', current_date)::date;
  v_settings public.payroll_settings;
  v_existing public.payroll_runs;
  v_run      public.payroll_runs;
  v_present  numeric;
  v_late     int;
  v_leave    numeric;
  v_expected numeric;
  v_elapsed  numeric;
  v_days_in_month numeric;
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

  -- Never generate payroll for a month that has not started yet.
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

  select count(*)::numeric, count(*) filter (where is_late)
    into v_present, v_late
    from public.attendance_sessions
   where agent_id = p_agent and work_date >= v_start and work_date < v_end;
  v_present := coalesce(v_present, 0);
  v_late := coalesce(v_late, 0);

  select coalesce(sum(
           case when is_half_day then 0.5
                else (least(end_date, v_last) - greatest(start_date, v_start) + 1)::numeric
           end), 0)
    into v_leave
    from public.leave_requests
   where agent_id = p_agent and status = 'approved'
     and start_date <= v_last and end_date >= v_start;

  -- Expected working days: prorate for the in-progress (current) month so future
  -- days are not treated as absences; full month for past months.
  if v_period = v_now_period then
    v_elapsed := extract(day from current_date)::numeric;
    v_days_in_month := extract(day from v_last)::numeric;
    v_expected := round(
      v_settings.working_days_per_month::numeric * v_elapsed / v_days_in_month, 2);
  else
    v_expected := v_settings.working_days_per_month::numeric;
  end if;

  v_absence := greatest(0, v_expected - v_present - v_leave);
  v_leave_ded := round(v_absence * v_settings.daily_rate, 2);

  v_kpi := public.get_agent_kpis(p_agent, v_period);
  v_completed  := coalesce((v_kpi ->> 'completed_tasks')::int, 0);
  v_target     := coalesce((v_kpi ->> 'target_achievement_pct')::numeric, 0);
  v_net        := coalesce((v_kpi ->> 'net_points')::numeric, 0);
  v_productive := coalesce((v_kpi ->> 'productive_seconds')::int, 0);

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
    computed_payable, final_payable, created_by, last_generated_at
  ) values (
    p_agent, v_period, v_settings.monthly_salary, v_settings.currency,
    v_settings.working_days_per_month, v_settings.daily_rate,
    v_present, v_leave, v_absence, v_late, v_productive,
    v_leave_ded, v_bonus, v_manual, v_total_ded,
    v_completed, v_target, v_net,
    v_computed, v_computed, auth.uid(), now()
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
    final_payable = coalesce(pr.override_amount, excluded.computed_payable),
    last_generated_at = now(),
    updated_at = now()
  returning * into v_run;

  return v_run;
end;
$$;
