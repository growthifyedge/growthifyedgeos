-- =============================================================================
-- Growthify Edge OS — 0006 SCHEDULED JOBS (optional)
-- Requires the pg_cron extension. Enable it first:
--   Supabase Dashboard → Database → Extensions → enable "pg_cron".
-- Then run this file. If you prefer, trigger calculate_monthly_incentives()
-- manually from the admin "Penalties & Rewards" page instead.
-- =============================================================================

-- create extension if not exists pg_cron;

-- Recompute the current month's incentives every night at 23:30 UTC so the
-- dashboard reflects target/quality rewards and low-completion penalties.
-- select cron.schedule(
--   'nightly-incentives',
--   '30 23 * * *',
--   $$ select public.calculate_monthly_incentives(date_trunc('month', now())::date); $$
-- );

-- On the 1st of each month at 00:30 UTC, finalize the *previous* month.
-- select cron.schedule(
--   'finalize-previous-month',
--   '30 0 1 * *',
--   $$ select public.calculate_monthly_incentives((date_trunc('month', now()) - interval '1 month')::date); $$
-- );

-- To remove a job:  select cron.unschedule('nightly-incentives');
