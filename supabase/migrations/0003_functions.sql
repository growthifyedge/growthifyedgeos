-- =============================================================================
-- Growthify Edge OS — 0003 FUNCTIONS, TRIGGERS & RPCs
-- All shift/task state transitions go through these SECURITY DEFINER functions
-- so the business rules (timers, lateness, penalties) stay consistent and
-- race-safe regardless of which client calls them.
--
-- NOTE ON TIME ZONES: shift_start_time / shift_end_time are interpreted in the
-- database server time zone (UTC on Supabase). For multi-region teams, store a
-- per-agent timezone and convert before comparing. Kept simple here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

-- Close the agent's single open task timer (if any) and roll its seconds into
-- the task's accumulated active_seconds.
create or replace function public._close_open_timer(p_agent uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  update public.task_time_logs
     set ended_at = now(),
         duration_seconds = greatest(0, floor(extract(epoch from (now() - started_at)))::int)
   where agent_id = p_agent and ended_at is null
   returning task_id, duration_seconds into r;

  if found then
    update public.tasks
       set active_seconds = active_seconds + coalesce(r.duration_seconds, 0),
           updated_at = now()
     where id = r.task_id;
  end if;
end;
$$;

-- Apply a fixed-amount rule to the ledger (idempotent per reference).
create or replace function public._apply_rule(
  p_agent uuid, p_code text, p_reason text, p_ref_type text, p_ref_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_rule public.penalty_reward_rules;
begin
  select * into v_rule from public.penalty_reward_rules where code = p_code and is_active;
  if not found then return; end if;

  insert into public.penalty_reward_ledger
    (agent_id, type, rule_code, label, amount, reason, reference_type, reference_id, period_month, auto_generated)
  values
    (p_agent, v_rule.type, v_rule.code, v_rule.label, v_rule.amount, p_reason,
     p_ref_type, p_ref_id, date_trunc('month', now())::date, true)
  on conflict (agent_id, rule_code, reference_type, reference_id)
    where reference_id is not null
    do nothing;
end;
$$;

-- =============================================================================
-- ATTENDANCE RPCs
-- =============================================================================

-- Start (or return today's existing) shift. Computes lateness.
create or replace function public.start_shift()
returns public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent   uuid := auth.uid();
  v_today   date := current_date;
  v_session public.attendance_sessions;
  v_grace   int;
  v_start_t time;
  v_expected timestamptz;
  v_is_late boolean := false;
  v_late_min int := 0;
begin
  if v_agent is null then raise exception 'Not authenticated'; end if;

  select * into v_session
    from public.attendance_sessions
   where agent_id = v_agent and work_date = v_today;
  if found then
    return v_session;                       -- idempotent: already clocked in
  end if;

  select grace_period_minutes into v_grace from public.app_settings where id = 1;
  select shift_start_time     into v_start_t from public.profiles where id = v_agent;
  v_expected := (v_today::timestamp + v_start_t)::timestamptz;

  if now() > v_expected + make_interval(mins => coalesce(v_grace, 0)) then
    v_is_late  := true;
    v_late_min := ceil(extract(epoch from (now() - v_expected)) / 60)::int;
  end if;

  insert into public.attendance_sessions
    (agent_id, work_date, shift_start, status, is_late, late_minutes)
  values
    (v_agent, v_today, now(), 'active', v_is_late, v_late_min)
  returning * into v_session;

  return v_session;
end;
$$;

-- Begin a break. Also auto-pauses any running task timer.
create or replace function public.start_break(p_reason text default null)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_session public.attendance_sessions;
begin
  if v_agent is null then raise exception 'Not authenticated'; end if;

  select * into v_session
    from public.attendance_sessions
   where agent_id = v_agent and work_date = current_date and status <> 'ended'
   for update;
  if not found then raise exception 'No active shift. Start your shift first.'; end if;
  if v_session.status = 'on_break' then return v_session; end if;

  perform public._close_open_timer(v_agent);   -- pause work while on break

  insert into public.break_logs (session_id, agent_id, break_start, reason)
  values (v_session.id, v_agent, now(), p_reason);

  update public.attendance_sessions
     set status = 'on_break', updated_at = now()
   where id = v_session.id
   returning * into v_session;

  return v_session;
end;
$$;

-- End the current break (resume work).
create or replace function public.end_break()
returns public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_session public.attendance_sessions;
  v_dur int;
begin
  if v_agent is null then raise exception 'Not authenticated'; end if;

  select * into v_session
    from public.attendance_sessions
   where agent_id = v_agent and work_date = current_date and status <> 'ended'
   for update;
  if not found then raise exception 'No active shift.'; end if;

  update public.break_logs
     set break_end = now(),
         duration_seconds = greatest(0, floor(extract(epoch from (now() - break_start)))::int)
   where session_id = v_session.id and break_end is null
   returning duration_seconds into v_dur;

  update public.attendance_sessions
     set status = 'active',
         break_seconds = break_seconds + coalesce(v_dur, 0),
         updated_at = now()
   where id = v_session.id
   returning * into v_session;

  return v_session;
end;
$$;

-- End the shift (logout). Closes open break/timer, computes net work time,
-- early-logout, and applies attendance penalties.
create or replace function public.end_shift()
returns public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_session public.attendance_sessions;
  v_dur int;
  v_early_grace int;
  v_max_break int;
  v_end_t time;
  v_expected_end timestamptz;
  v_early boolean := false;
  v_early_min int := 0;
  v_work int;
begin
  if v_agent is null then raise exception 'Not authenticated'; end if;

  select * into v_session
    from public.attendance_sessions
   where agent_id = v_agent and work_date = current_date and status <> 'ended'
   for update;
  if not found then raise exception 'No active shift to end.'; end if;

  -- close any open break
  update public.break_logs
     set break_end = now(),
         duration_seconds = greatest(0, floor(extract(epoch from (now() - break_start)))::int)
   where session_id = v_session.id and break_end is null
   returning duration_seconds into v_dur;
  if v_dur is not null then
    v_session.break_seconds := v_session.break_seconds + v_dur;
  end if;

  perform public._close_open_timer(v_agent);   -- stop any running task work

  select max_break_minutes, early_logout_grace_min
    into v_max_break, v_early_grace
    from public.app_settings where id = 1;

  select shift_end_time into v_end_t from public.profiles where id = v_agent;
  v_expected_end := (current_date::timestamp + v_end_t)::timestamptz;
  if now() < v_expected_end - make_interval(mins => coalesce(v_early_grace, 0)) then
    v_early := true;
    v_early_min := ceil(extract(epoch from (v_expected_end - now())) / 60)::int;
  end if;

  v_work := greatest(0, floor(extract(epoch from (now() - v_session.shift_start)))::int - v_session.break_seconds);

  update public.attendance_sessions
     set shift_end = now(),
         status = 'ended',
         break_seconds = v_session.break_seconds,
         work_seconds = v_work,
         is_early_logout = v_early,
         early_minutes = v_early_min,
         updated_at = now()
   where id = v_session.id
   returning * into v_session;

  -- ---- attendance penalties (idempotent per shift) ----
  if v_session.is_late then
    perform public._apply_rule(v_agent, 'late_login',
      format('Late login by %s min on %s', v_session.late_minutes, v_session.work_date),
      'attendance', v_session.id);
  end if;

  if v_max_break is not null and v_session.break_seconds > v_max_break * 60 then
    perform public._apply_rule(v_agent, 'excessive_break',
      format('Break of %s min exceeded the %s min allowance',
             round(v_session.break_seconds / 60.0), v_max_break),
      'attendance', v_session.id);
  end if;

  if v_session.is_early_logout then
    perform public._apply_rule(v_agent, 'early_logout',
      format('Early logout by %s min on %s', v_session.early_minutes, v_session.work_date),
      'attendance', v_session.id);
  end if;

  return v_session;
end;
$$;

-- =============================================================================
-- TASK RPCs
-- =============================================================================

create or replace function public.start_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if v_task.assigned_to <> v_agent and not public.is_admin() then
    raise exception 'You are not assigned to this task';
  end if;

  perform public._close_open_timer(v_agent);   -- auto-pause any other running task

  insert into public.task_time_logs (task_id, agent_id, started_at)
  values (p_task_id, v_agent, now());

  update public.tasks
     set status = 'in_progress',
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = p_task_id
   returning * into v_task;

  return v_task;
end;
$$;

create or replace function public.pause_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if v_task.assigned_to <> v_agent and not public.is_admin() then
    raise exception 'Not your task';
  end if;

  perform public._close_open_timer(v_agent);

  update public.tasks set status = 'paused', updated_at = now()
   where id = p_task_id returning * into v_task;
  return v_task;
end;
$$;

create or replace function public.submit_task(p_task_id uuid, p_link text default null, p_note text default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := auth.uid();
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;
  if v_task.assigned_to <> v_agent and not public.is_admin() then
    raise exception 'Not your task';
  end if;

  perform public._close_open_timer(v_agent);

  update public.tasks
     set status = 'submitted',
         submitted_at = now(),
         deliverable_url = coalesce(p_link, deliverable_url),
         updated_at = now()
   where id = p_task_id
   returning * into v_task;

  if p_link is not null then
    insert into public.task_attachments (task_id, uploaded_by, kind, url, file_name)
    values (p_task_id, v_agent, 'link', p_link, 'Submitted deliverable');
  end if;
  if p_note is not null then
    insert into public.task_notes (task_id, author_id, body) values (p_task_id, v_agent, p_note);
  end if;

  return v_task;
end;
$$;

-- Admin: send back for revision
create or replace function public.request_revision(p_task_id uuid, p_note text default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_task public.tasks;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  update public.tasks
     set status = 'revision',
         revision_count = revision_count + 1,
         updated_at = now()
   where id = p_task_id
   returning * into v_task;
  if not found then raise exception 'Task not found'; end if;

  if p_note is not null then
    insert into public.task_notes (task_id, author_id, body)
    values (p_task_id, auth.uid(), '[Revision] ' || p_note);
  end if;
  return v_task;
end;
$$;

-- Admin: approve & complete, set quality score, apply deadline penalty if missed
create or replace function public.complete_task(p_task_id uuid, p_quality numeric default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare v_task public.tasks;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  perform public._close_open_timer(v_task.assigned_to);

  update public.tasks
     set status = 'completed',
         completed_at = now(),
         quality_score = coalesce(p_quality, quality_score),
         updated_at = now()
   where id = p_task_id
   returning * into v_task;

  -- Missed-deadline penalty on the assignee
  if v_task.assigned_to is not null and v_task.deadline is not null
     and v_task.completed_at > v_task.deadline then
    perform public._apply_rule(v_task.assigned_to, 'missed_deadline',
      format('Task "%s" completed after deadline', v_task.title),
      'task', v_task.id);
  end if;

  return v_task;
end;
$$;

-- =============================================================================
-- MONTHLY INCENTIVES  (run nightly via pg_cron, or on-demand from admin UI)
-- Recomputes target/quality/extra-task rewards and low-completion penalties for
-- the given month. Safe to re-run: it clears that month's KPI-sourced rows first.
-- =============================================================================
create or replace function public.calculate_monthly_incentives(p_month date default date_trunc('month', now())::date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_settings    public.app_settings;
  a             record;
  v_completed   int;
  v_avg_quality numeric;
  v_target      int;
  v_rate        numeric;
  v_rule        public.penalty_reward_rules;
  v_rows        int := 0;
begin
  select * into v_settings from public.app_settings where id = 1;

  -- Clear previously auto-generated KPI rows for this month (idempotent re-run)
  delete from public.penalty_reward_ledger
   where period_month = v_month_start and reference_type = 'kpi' and auto_generated;

  for a in select id, monthly_task_target from public.profiles where role = 'agent' and is_active loop
    v_target := greatest(1, coalesce(a.monthly_task_target, 1));

    select count(*), avg(quality_score)
      into v_completed, v_avg_quality
      from public.tasks
     where assigned_to = a.id
       and status = 'completed'
       and completed_at >= v_month_start and completed_at < v_month_end;

    v_completed := coalesce(v_completed, 0);
    v_rate := (v_completed::numeric / v_target) * 100;

    -- Reward: monthly target achieved
    if v_completed >= v_target then
      select * into v_rule from public.penalty_reward_rules where code = 'target_achieved' and is_active;
      if found then
        insert into public.penalty_reward_ledger
          (agent_id, type, rule_code, label, amount, reason, reference_type, period_month)
        values (a.id, v_rule.type, v_rule.code, v_rule.label, v_rule.amount,
                format('Hit monthly target (%s/%s tasks)', v_completed, v_target), 'kpi', v_month_start);
        v_rows := v_rows + 1;
      end if;
    end if;

    -- Reward: extra tasks beyond target (amount per extra task)
    if v_completed > v_target then
      select * into v_rule from public.penalty_reward_rules where code = 'extra_tasks' and is_active;
      if found then
        insert into public.penalty_reward_ledger
          (agent_id, type, rule_code, label, amount, reason, reference_type, period_month)
        values (a.id, v_rule.type, v_rule.code, v_rule.label, v_rule.amount * (v_completed - v_target),
                format('%s task(s) beyond target', v_completed - v_target), 'kpi', v_month_start);
        v_rows := v_rows + 1;
      end if;
    end if;

    -- Reward: high average quality
    if v_avg_quality is not null and v_avg_quality >= v_settings.high_quality_threshold then
      select * into v_rule from public.penalty_reward_rules where code = 'high_quality' and is_active;
      if found then
        insert into public.penalty_reward_ledger
          (agent_id, type, rule_code, label, amount, reason, reference_type, period_month)
        values (a.id, v_rule.type, v_rule.code, v_rule.label, v_rule.amount,
                format('Avg quality %s/10', round(v_avg_quality, 1)), 'kpi', v_month_start);
        v_rows := v_rows + 1;
      end if;
    end if;

    -- Penalty: low completion (below threshold % of target)
    if v_rate < v_settings.low_completion_threshold then
      select * into v_rule from public.penalty_reward_rules where code = 'low_completion' and is_active;
      if found then
        insert into public.penalty_reward_ledger
          (agent_id, type, rule_code, label, amount, reason, reference_type, period_month)
        values (a.id, v_rule.type, v_rule.code, v_rule.label, v_rule.amount,
                format('Only %s%% of target completed (%s/%s)', round(v_rate), v_completed, v_target), 'kpi', v_month_start);
        v_rows := v_rows + 1;
      end if;
    end if;
  end loop;

  return v_rows;
end;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- keep updated_at fresh
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_attendance_updated on public.attendance_sessions;
create trigger trg_attendance_updated before update on public.attendance_sessions
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_settings_updated on public.app_settings;
create trigger trg_settings_updated before update on public.app_settings
  for each row execute function public.tg_set_updated_at();

-- task status history
create or replace function public.tg_task_status_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.task_status_history (task_id, actor_id, from_status, to_status)
    values (new.id, auth.uid(), null, new.status);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.task_status_history (task_id, actor_id, from_status, to_status)
    values (new.id, auth.uid(), old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_status_history on public.tasks;
create trigger trg_task_status_history after insert or update on public.tasks
  for each row execute function public.tg_task_status_history();

-- =============================================================================
-- GRANTS (functions are SECURITY DEFINER; allow authenticated users to call)
-- =============================================================================
grant execute on function
  public.start_shift(), public.start_break(text), public.end_break(), public.end_shift(),
  public.start_task(uuid), public.pause_task(uuid), public.submit_task(uuid, text, text),
  public.request_revision(uuid, text), public.complete_task(uuid, numeric),
  public.calculate_monthly_incentives(date)
to authenticated;
