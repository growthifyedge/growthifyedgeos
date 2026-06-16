-- =============================================================================
-- Growthify Edge OS — 0010 PAYROLL WORKFLOW (Phase 6 prep + workflow RPCs)
-- Adds last_generated_at, refreshes generate_payroll to stamp it, and adds two
-- guarded workflow RPCs:
--   set_payroll_status  — enforces draft -> reviewed -> approved -> paid
--   update_payroll_run  — edit override_amount + admin_note (locked once paid)
-- Additive & idempotent. Safe to run on an existing database.
-- =============================================================================

alter table public.payroll_runs
  add column if not exists last_generated_at timestamptz;

-- -----------------------------------------------------------------------------
-- generate_payroll — same snapshot/idempotency logic as 0009, now stamping
-- last_generated_at on every (re)generation. Regenerate policy:
--   draft     -> allowed
--   reviewed  -> allowed (UI may warn; future-ready)
--   approved  -> BLOCKED
--   paid      -> BLOCKED
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

  v_absence := greatest(0, v_settings.working_days_per_month::numeric - v_present - v_leave);
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

-- -----------------------------------------------------------------------------
-- set_payroll_status — strict one-step-forward transitions only.
--   draft -> reviewed -> approved -> paid  (no skips, no reverts)
-- Paid is locked.
-- -----------------------------------------------------------------------------
create or replace function public.set_payroll_status(p_run uuid, p_status text)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.payroll_runs;
  v_cur text;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_run from public.payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run not found'; end if;
  v_cur := v_run.status;

  if v_cur = 'paid' then
    raise exception 'Paid payroll is locked.';
  end if;

  if not (
    (v_cur = 'draft'    and p_status = 'reviewed') or
    (v_cur = 'reviewed' and p_status = 'approved') or
    (v_cur = 'approved' and p_status = 'paid')
  ) then
    raise exception 'Invalid status transition: % -> %. Allowed path: draft -> reviewed -> approved -> paid.',
      v_cur, p_status;
  end if;

  update public.payroll_runs
     set status = p_status, updated_at = now()
   where id = p_run
   returning * into v_run;
  return v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- update_payroll_run — edit override + admin note. Final payable stays editable
-- until paid. Passing null override clears it (final reverts to computed).
-- -----------------------------------------------------------------------------
create or replace function public.update_payroll_run(
  p_run uuid, p_override numeric, p_note text
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare v_run public.payroll_runs;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_run from public.payroll_runs where id = p_run for update;
  if not found then raise exception 'Payroll run not found'; end if;
  if v_run.status = 'paid' then raise exception 'Paid payroll is locked.'; end if;

  update public.payroll_runs
     set override_amount = p_override,
         admin_note = nullif(btrim(coalesce(p_note, '')), ''),
         final_payable = coalesce(p_override, computed_payable),
         updated_at = now()
   where id = p_run
   returning * into v_run;
  return v_run;
end;
$$;

grant execute on function public.set_payroll_status(uuid, text) to authenticated;
grant execute on function public.update_payroll_run(uuid, numeric, text) to authenticated;
