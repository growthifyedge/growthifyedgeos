-- =============================================================================
-- Growthify Edge OS — 0012 AGENT SOFT DELETE
-- Adds a soft-delete marker to profiles and excludes soft-deleted agents from
-- the live dashboard views. Additive & idempotent.
-- =============================================================================

alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists idx_profiles_deleted on public.profiles (deleted_at);

-- Re-create the agent views to hide soft-deleted agents everywhere they drive
-- the dashboards. Definitions match 0004 with an added `deleted_at is null`.
create or replace view public.v_agent_today
  with (security_invoker = true) as
select
  p.id                as agent_id,
  p.full_name,
  p.avatar_url,
  p.shift_start_time,
  p.shift_end_time,
  s.id                as session_id,
  s.status,
  s.shift_start,
  s.shift_end,
  s.break_seconds,
  s.work_seconds,
  s.is_late,
  s.late_minutes,
  (s.status = 'active')   as is_online,
  (s.status = 'on_break') as is_on_break
from public.profiles p
left join public.attendance_sessions s
  on s.agent_id = p.id and s.work_date = current_date
where p.role = 'agent' and p.deleted_at is null;

create or replace view public.v_agent_productivity
  with (security_invoker = true) as
with m as (select date_trunc('month', now()) as mstart),
tl as (
  select l.agent_id, coalesce(sum(l.duration_seconds), 0) as productive_seconds
  from public.task_time_logs l, m
  where l.started_at >= m.mstart
  group by l.agent_id
)
select
  p.id   as agent_id,
  p.full_name,
  p.avatar_url,
  p.monthly_task_target,
  count(t.id) filter (where t.status <> 'completed')                          as open_tasks,
  count(t.id) filter (where t.status = 'in_progress')                         as in_progress,
  count(t.id) filter (where t.status = 'completed'
                        and t.completed_at >= (select mstart from m))         as completed_this_month,
  count(t.id) filter (where t.status <> 'completed'
                        and t.deadline is not null and t.deadline < now())    as overdue,
  coalesce(tl.productive_seconds, 0)                                          as productive_seconds_month,
  round(avg(t.quality_score) filter (where t.completed_at >= (select mstart from m)), 1) as avg_quality,
  coalesce(sum(t.revision_count), 0)                                          as revisions
from public.profiles p
left join public.tasks t on t.assigned_to = p.id
left join tl on tl.agent_id = p.id
where p.role = 'agent' and p.deleted_at is null
group by p.id, p.full_name, p.avatar_url, p.monthly_task_target, tl.productive_seconds;
