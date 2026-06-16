-- =============================================================================
-- Growthify Edge OS — 0007 LEAVE / TIME-OFF MANAGEMENT
-- Modular add-on: new table + RLS, and a leave-aware redefinition of the
-- start_shift / end_shift attendance RPCs so approved leave waives attendance
-- and late-login penalties. Safe to run on an existing database.
-- =============================================================================

-- ENUMS
do $$ begin
  create type leave_type as enum ('sick','casual','emergency','vacation','half_day','wfh');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- TABLE
create table if not exists public.leave_requests (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.profiles (id) on delete cascade,
  leave_type  leave_type not null,
  start_date  date not null,
  end_date    date not null,
  is_half_day boolean not null default false,
  reason      text,
  status      leave_status not null default 'pending',
  admin_note  text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);
create index if not exists idx_leave_agent  on public.leave_requests (agent_id);
create index if not exists idx_leave_status on public.leave_requests (status);
create index if not exists idx_leave_dates  on public.leave_requests (start_date, end_date);

-- RLS
alter table public.leave_requests enable row level security;

drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select using (agent_id = auth.uid() or public.is_admin());

drop policy if exists leave_insert on public.leave_requests;
create policy leave_insert on public.leave_requests
  for insert with check (agent_id = auth.uid());

-- agents may cancel (delete) their own still-pending requests
drop policy if exists leave_agent_delete on public.leave_requests;
create policy leave_agent_delete on public.leave_requests
  for delete using (agent_id = auth.uid() and status = 'pending');

drop policy if exists leave_admin on public.leave_requests;
create policy leave_admin on public.leave_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- updated_at trigger (reuses helper from 0003)
drop trigger if exists trg_leave_updated on public.leave_requests;
create trigger trg_leave_updated before update on public.leave_requests
  for each row execute function public.tg_set_updated_at();

-- Helper: is the agent on APPROVED leave covering a given date?
create or replace function public.is_on_approved_leave(p_agent uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leave_requests
    where agent_id = p_agent
      and status = 'approved'
      and p_date between start_date and end_date
  );
$$;
grant execute on function public.is_on_approved_leave(uuid, date) to authenticated;

-- =============================================================================
-- Leave-aware START_SHIFT — approved leave waives the "late" flag/penalty.
-- =============================================================================
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
    return v_session;
  end if;

  select grace_period_minutes into v_grace from public.app_settings where id = 1;
  select shift_start_time     into v_start_t from public.profiles where id = v_agent;
  v_expected := (v_today::timestamp + v_start_t)::timestamptz;

  if now() > v_expected + make_interval(mins => coalesce(v_grace, 0)) then
    v_is_late  := true;
    v_late_min := ceil(extract(epoch from (now() - v_expected)) / 60)::int;
  end if;

  -- Approved leave waives lateness (full or half day).
  if public.is_on_approved_leave(v_agent, v_today) then
    v_is_late  := false;
    v_late_min := 0;
  end if;

  insert into public.attendance_sessions
    (agent_id, work_date, shift_start, status, is_late, late_minutes)
  values
    (v_agent, v_today, now(), 'active', v_is_late, v_late_min)
  returning * into v_session;

  return v_session;
end;
$$;

-- =============================================================================
-- Leave-aware END_SHIFT — approved leave skips ALL attendance penalties
-- (late login, early logout, excessive break) and clears the early-logout flag.
-- =============================================================================
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
  v_on_leave boolean := false;
begin
  if v_agent is null then raise exception 'Not authenticated'; end if;

  select * into v_session
    from public.attendance_sessions
   where agent_id = v_agent and work_date = current_date and status <> 'ended'
   for update;
  if not found then raise exception 'No active shift to end.'; end if;

  update public.break_logs
     set break_end = now(),
         duration_seconds = greatest(0, floor(extract(epoch from (now() - break_start)))::int)
   where session_id = v_session.id and break_end is null
   returning duration_seconds into v_dur;
  if v_dur is not null then
    v_session.break_seconds := v_session.break_seconds + v_dur;
  end if;

  perform public._close_open_timer(v_agent);

  select max_break_minutes, early_logout_grace_min
    into v_max_break, v_early_grace
    from public.app_settings where id = 1;

  select shift_end_time into v_end_t from public.profiles where id = v_agent;
  v_expected_end := (current_date::timestamp + v_end_t)::timestamptz;
  if now() < v_expected_end - make_interval(mins => coalesce(v_early_grace, 0)) then
    v_early := true;
    v_early_min := ceil(extract(epoch from (v_expected_end - now())) / 60)::int;
  end if;

  v_on_leave := public.is_on_approved_leave(v_agent, v_session.work_date);
  if v_on_leave then
    v_early := false;
    v_early_min := 0;
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

  -- Attendance penalties are skipped entirely on approved leave.
  if not v_on_leave then
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
  end if;

  return v_session;
end;
$$;
