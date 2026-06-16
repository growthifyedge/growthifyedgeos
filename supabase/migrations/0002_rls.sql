-- =============================================================================
-- Growthify Edge OS — 0002 RLS (helpers, auth->profile trigger, policies)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: is the current user an admin?  (SECURITY DEFINER avoids recursive RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Auto-create a profile when a new auth user is created.
-- full_name / role are read from user metadata supplied at signup / admin invite.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'agent')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Enable RLS on all app tables
-- -----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.clients               enable row level security;
alter table public.platforms             enable row level security;
alter table public.task_types            enable row level security;
alter table public.tasks                 enable row level security;
alter table public.task_attachments      enable row level security;
alter table public.task_notes            enable row level security;
alter table public.task_status_history   enable row level security;
alter table public.task_time_logs        enable row level security;
alter table public.attendance_sessions   enable row level security;
alter table public.break_logs            enable row level security;
alter table public.penalty_reward_rules  enable row level security;
alter table public.penalty_reward_ledger enable row level security;
alter table public.app_settings          enable row level security;

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- LOOKUPS: readable by all authenticated, writable by admin
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','platforms','task_types'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s;', t);
    execute format('create policy %1$s_read on public.%1$s for select using (auth.role() = ''authenticated'');', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s;', t);
    execute format('create policy %1$s_admin on public.%1$s for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- TASKS: admin sees all; agents see/own their assigned tasks
-- -----------------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (public.is_admin() or assigned_to = auth.uid());

drop policy if exists tasks_admin_write on public.tasks;
create policy tasks_admin_write on public.tasks
  for all using (public.is_admin()) with check (public.is_admin());

-- Agents may update their own assigned tasks (status, notes, deliverable).
drop policy if exists tasks_agent_update on public.tasks;
create policy tasks_agent_update on public.tasks
  for update using (assigned_to = auth.uid()) with check (assigned_to = auth.uid());

-- -----------------------------------------------------------------------------
-- TASK CHILD TABLES: visible if you can see the parent task
-- -----------------------------------------------------------------------------
create or replace function public.can_access_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (public.is_admin() or t.assigned_to = auth.uid())
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['task_attachments','task_notes','task_status_history'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select using (public.can_access_task(task_id));', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.can_access_task(task_id));', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s;', t);
    execute format('create policy %1$s_admin on public.%1$s for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- TASK TIME LOGS: own rows or admin
drop policy if exists time_logs_select on public.task_time_logs;
create policy time_logs_select on public.task_time_logs
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists time_logs_write on public.task_time_logs;
create policy time_logs_write on public.task_time_logs
  for all using (agent_id = auth.uid() or public.is_admin())
  with check (agent_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- ATTENDANCE + BREAKS: own rows or admin
-- -----------------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance_sessions;
create policy attendance_select on public.attendance_sessions
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists attendance_write on public.attendance_sessions;
create policy attendance_write on public.attendance_sessions
  for all using (agent_id = auth.uid() or public.is_admin())
  with check (agent_id = auth.uid() or public.is_admin());

drop policy if exists breaks_select on public.break_logs;
create policy breaks_select on public.break_logs
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists breaks_write on public.break_logs;
create policy breaks_write on public.break_logs
  for all using (agent_id = auth.uid() or public.is_admin())
  with check (agent_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- PENALTY / REWARD
-- -----------------------------------------------------------------------------
drop policy if exists rules_read on public.penalty_reward_rules;
create policy rules_read on public.penalty_reward_rules
  for select using (auth.role() = 'authenticated');
drop policy if exists rules_admin on public.penalty_reward_rules;
create policy rules_admin on public.penalty_reward_rules
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ledger_select on public.penalty_reward_ledger;
create policy ledger_select on public.penalty_reward_ledger
  for select using (agent_id = auth.uid() or public.is_admin());
drop policy if exists ledger_admin on public.penalty_reward_ledger;
create policy ledger_admin on public.penalty_reward_ledger
  for all using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- SETTINGS: readable by all authenticated, writable by admin
-- -----------------------------------------------------------------------------
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings
  for select using (auth.role() = 'authenticated');
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());
