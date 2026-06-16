-- =============================================================================
-- Growthify Edge OS — 0004 VIEWS & KPI FUNCTION
-- Views use security_invoker so the caller's RLS still applies:
--   admin -> sees everyone, agent -> sees only their own rows.
-- =============================================================================

-- Today's attendance snapshot, one row per agent (drives the live dashboard).
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
where p.role = 'agent';

-- Client-wise task status breakdown.
create or replace view public.v_client_task_status
  with (security_invoker = true) as
select
  c.id   as client_id,
  c.name as client_name,
  c.logo_url,
  count(t.id)                                                        as total,
  count(*) filter (where t.status = 'todo')                         as todo,
  count(*) filter (where t.status = 'in_progress')                  as in_progress,
  count(*) filter (where t.status = 'paused')                       as paused,
  count(*) filter (where t.status = 'submitted')                    as submitted,
  count(*) filter (where t.status = 'revision')                     as revision,
  count(*) filter (where t.status = 'completed')                    as completed,
  count(*) filter (where t.status <> 'completed'
                     and t.deadline is not null
                     and t.deadline < now())                        as overdue
from public.clients c
left join public.tasks t on t.client_id = c.id
group by c.id, c.name, c.logo_url;

-- Agent productivity for the current month.
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
where p.role = 'agent'
group by p.id, p.full_name, p.avatar_url, p.monthly_task_target, tl.productive_seconds;

-- Denormalized task feed for lists & reports (names instead of ids).
create or replace view public.v_task_feed
  with (security_invoker = true) as
select
  t.*,
  c.name  as client_name,
  pl.name as platform_name,
  tt.name as task_type_name,
  a.full_name  as assignee_name,
  a.avatar_url as assignee_avatar,
  (t.status <> 'completed' and t.deadline is not null and t.deadline < now()) as is_overdue
from public.tasks t
left join public.clients   c  on c.id  = t.client_id
left join public.platforms pl on pl.id = t.platform_id
left join public.task_types tt on tt.id = t.task_type_id
left join public.profiles  a  on a.id  = t.assigned_to;

grant select on
  public.v_agent_today,
  public.v_client_task_status,
  public.v_agent_productivity,
  public.v_task_feed
to authenticated;

-- -----------------------------------------------------------------------------
-- KPI rollup for one agent for one month. Returns jsonb so the app can read
-- every metric in a single round-trip.
-- -----------------------------------------------------------------------------
create or replace function public.get_agent_kpis(p_agent uuid, p_month date default date_trunc('month', now())::date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_result jsonb;
  v_target int;
begin
  if p_agent <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized to view these KPIs';
  end if;

  select coalesce(monthly_task_target, 1) into v_target from public.profiles where id = p_agent;
  v_target := greatest(1, coalesce(v_target, 1));

  select jsonb_build_object(
    'agent_id', p_agent,
    'period_month', v_start,

    -- attendance
    'attendance_days', att.days,
    'on_time_days',    att.on_time,
    'late_days',       att.late_days,
    'on_time_rate',    case when att.days > 0 then round(att.on_time::numeric / att.days * 100) else 0 end,
    'total_work_seconds', att.work_seconds,
    'total_break_seconds', att.break_seconds,

    -- productivity
    'productive_seconds', coalesce(prod.productive_seconds, 0),
    'completed_tasks',    coalesce(tk.completed, 0),
    'missed_deadlines',   coalesce(tk.missed, 0),
    'open_overdue',       coalesce(ovr.overdue, 0),
    'revision_count',     coalesce(rev.revisions, 0),
    'avg_quality',        tk.avg_quality,

    -- targets
    'monthly_task_target', v_target,
    'target_achievement_pct', round(coalesce(tk.completed, 0)::numeric / v_target * 100),

    -- incentives
    'penalties_total', coalesce(led.penalties, 0),
    'rewards_total',   coalesce(led.rewards, 0),
    'net_points',      coalesce(led.rewards, 0) - coalesce(led.penalties, 0)
  )
  into v_result
  from
    (select
       count(*)                                   as days,
       count(*) filter (where not is_late)        as on_time,
       count(*) filter (where is_late)            as late_days,
       coalesce(sum(work_seconds), 0)             as work_seconds,
       coalesce(sum(break_seconds), 0)            as break_seconds
     from public.attendance_sessions
     where agent_id = p_agent and work_date >= v_start and work_date < v_end) att,

    (select coalesce(sum(duration_seconds), 0) as productive_seconds
     from public.task_time_logs
     where agent_id = p_agent and started_at >= v_start and started_at < v_end) prod,

    (select
       count(*) filter (where status = 'completed'
                          and completed_at >= v_start and completed_at < v_end) as completed,
       count(*) filter (where status = 'completed' and deadline is not null
                          and completed_at > deadline
                          and completed_at >= v_start and completed_at < v_end) as missed,
       round(avg(quality_score) filter (where status = 'completed'
                          and completed_at >= v_start and completed_at < v_end), 1) as avg_quality
     from public.tasks where assigned_to = p_agent) tk,

    (select count(*) as overdue
     from public.tasks
     where assigned_to = p_agent and status <> 'completed'
       and deadline is not null and deadline < now()) ovr,

    (select count(*) as revisions
     from public.task_status_history h
     join public.tasks t on t.id = h.task_id
     where t.assigned_to = p_agent and h.to_status = 'revision'
       and h.created_at >= v_start and h.created_at < v_end) rev,

    (select
       coalesce(sum(amount) filter (where type = 'penalty'), 0) as penalties,
       coalesce(sum(amount) filter (where type = 'reward'), 0)  as rewards
     from public.penalty_reward_ledger
     where agent_id = p_agent and period_month = v_start) led;

  return v_result;
end;
$$;

grant execute on function public.get_agent_kpis(uuid, date) to authenticated;
