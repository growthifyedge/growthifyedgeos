-- =============================================================================
-- Growthify Edge OS — 0005 SEED (settings, lookups, rules, sample clients)
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- Global settings (singleton)
insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

-- Platforms
insert into public.platforms (name, icon, sort_order) values
  ('Instagram', 'instagram', 1),
  ('TikTok',    'music',     2),
  ('Facebook',  'facebook',  3),
  ('YouTube',   'youtube',   4),
  ('LinkedIn',  'linkedin',  5),
  ('X (Twitter)','twitter',  6),
  ('Pinterest', 'image',     7),
  ('Other',     'globe',     8)
on conflict (name) do nothing;

-- Task types (with default expected minutes)
insert into public.task_types (name, default_minutes) values
  ('Video Editing',      120),
  ('Animation',          180),
  ('Caption Generation',  30),
  ('Post Editing',        45),
  ('Image Generation',    60),
  ('Content Scheduling',  30)
on conflict (name) do nothing;

-- Penalty & reward rules (points-based; edit amounts in the admin UI)
insert into public.penalty_reward_rules (code, type, label, description, trigger_key, amount, unit) values
  ('late_login',      'penalty', 'Late Login',        'Logged in after shift start + grace period',     'late_login',      5,  'points'),
  ('early_logout',    'penalty', 'Early Logout',       'Logged out before shift end - grace period',     'early_logout',    5,  'points'),
  ('excessive_break', 'penalty', 'Excessive Break',    'Total break exceeded the daily allowance',        'excessive_break', 8,  'points'),
  ('missed_deadline', 'penalty', 'Missed Deadline',    'Task completed after its deadline',               'missed_deadline', 10, 'points'),
  ('low_completion',  'penalty', 'Low Completion',     'Monthly completion below the threshold',          'low_completion',  20, 'points'),
  ('target_achieved', 'reward',  'Target Achieved',    'Reached the monthly task target',                 'target_achieved', 25, 'points'),
  ('extra_tasks',     'reward',  'Extra Tasks',        'Awarded per task completed beyond target',        'extra_tasks',     3,  'points'),
  ('high_quality',    'reward',  'High Quality',       'Maintained a high average quality score',         'high_quality',    15, 'points')
on conflict (code) do nothing;

-- Sample clients (replace with real ones)
insert into public.clients (name, contact_name, contact_email) values
  ('Aurora Skincare',   'Maya Lopez',   'maya@aurora.example'),
  ('PeakFit Gym',       'Sam Carter',   'sam@peakfit.example'),
  ('Bytewave Tech',     'Dev Patel',    'dev@bytewave.example'),
  ('Olive & Thyme Cafe','Nora Khan',    'nora@olivethyme.example')
on conflict do nothing;

-- =============================================================================
-- AFTER SEEDING: create your users in Supabase Auth, then promote the owner.
--
--   1. Supabase Dashboard → Authentication → Users → "Add user"
--      (or sign up via the app). A profile row is created automatically.
--   2. Promote the owner to admin:
--        update public.profiles set role = 'admin', full_name = 'Owner Name'
--        where email = 'owner@youragency.com';
--   3. The other 5 users default to role 'agent'. Set their shift window/target:
--        update public.profiles
--           set shift_start_time = '09:00', shift_end_time = '18:00',
--               monthly_task_target = 60
--         where role = 'agent';
-- =============================================================================
