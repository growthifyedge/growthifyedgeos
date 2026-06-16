# Growthify Edge OS

A real-time **agency operations tracking portal** for a small digital-marketing agency
(1 owner/admin + ~5 agents, 3–4 clients). It covers attendance, task management,
KPIs, an automatic penalty & reward engine, and reporting.

**Stack:** Next.js 15 (App Router) · Supabase (Auth + Postgres + RLS + Realtime) ·
TypeScript · Tailwind CSS · shadcn/ui · Recharts.

---

## 1. Features → where they live

| Requirement | Implementation |
|---|---|
| **Auth & roles** (Admin, Agent) | Supabase Auth + `profiles.role`; guarded by `middleware.ts` and `lib/auth.ts` (`requireAdmin` / `requireAgent`) |
| **Attendance** (shift, breaks, resume, logout, late/early, totals) | `attendance_sessions` + `break_logs`; RPCs `start_shift / start_break / end_break / end_shift`; UI `components/app/attendance-panel.tsx` |
| **Admin dashboard** (online/break, active/delayed/completed, client- & agent-wise) | `app/admin/page.tsx` over views `v_agent_today`, `v_client_task_status`, `v_agent_productivity` |
| **Task management** (create, client/platform/type, assign, priority, deadline, instructions, links, status flow) | `tasks` (+ `task_attachments`, `task_notes`, `task_status_history`); `app/admin/tasks/*`; statuses: To Do → In Progress → Paused → Submitted → Revision → Completed |
| **Agent dashboard** (assigned tasks, start/pause timer, submit, notes, upload link, deadlines) | `app/agent/*`; RPCs `start_task / pause_task / submit_task`; `task_time_logs` |
| **KPI system** | `get_agent_kpis()` (attendance, on-time, productive hours, completed, missed deadlines, revisions, quality, target %) → `app/agent/kpis`, `app/admin/reports` |
| **Penalty & reward engine** | `penalty_reward_rules` + `penalty_reward_ledger`; auto-applied in attendance/task RPCs + `calculate_monthly_incentives()`; UI `app/admin/penalties` |
| **Reports** (daily/weekly/monthly, agent-wise, client-wise) | `app/admin/reports/page.tsx` with charts + tables |

---

## 2. Project structure

```
growthify-edge-os/
├─ app/
│  ├─ layout.tsx, page.tsx, not-found.tsx, globals.css
│  ├─ login/page.tsx
│  ├─ admin/                # admin area (guarded by requireAdmin)
│  │  ├─ layout.tsx, page.tsx (dashboard)
│  │  ├─ tasks/ (list, [id], new via dialog)
│  │  ├─ agents/, clients/, reports/, penalties/, settings/
│  └─ agent/                # agent area (guarded by requireAgent)
│     ├─ layout.tsx, page.tsx (dashboard)
│     ├─ tasks/ (list, [id]), attendance/, kpis/
├─ components/
│  ├─ ui/                   # shadcn/ui primitives
│  └─ app/                  # domain components (shell, panels, dialogs, charts)
├─ lib/
│  ├─ supabase/ (client, server, admin, middleware)
│  ├─ actions/  (auth, attendance, tasks, admin)   # "use server"
│  ├─ auth.ts, queries.ts, types.ts, constants.ts, utils.ts
├─ supabase/migrations/     # 0001..0006 SQL
├─ middleware.ts
└─ config files (next, tailwind, tsconfig, components.json, .env.local.example)
```

---

## 3. Database schema (overview)

Full SQL is in [`supabase/migrations/`](supabase/migrations). Run them in order.

- **`profiles`** — 1:1 with `auth.users`; role, shift window, monthly target.
- **`clients`, `platforms`, `task_types`** — lookups.
- **`tasks`** — core work item + timeline stamps, revision count, quality, accumulated active time.
  - **`task_attachments`**, **`task_notes`**, **`task_status_history`**, **`task_time_logs`**.
- **`attendance_sessions`** (one per agent per day) + **`break_logs`**.
- **`penalty_reward_rules`** (configurable) + **`penalty_reward_ledger`** (immutable, idempotent).
- **`app_settings`** — single row of policy thresholds.
- **Views:** `v_agent_today`, `v_client_task_status`, `v_agent_productivity`, `v_task_feed` (all `security_invoker`).
- **Functions:** attendance/task RPCs, `get_agent_kpis()`, `calculate_monthly_incentives()`.
- **RLS:** admin sees everything; agents see only their own rows. All state changes go through `SECURITY DEFINER` RPCs for consistency.

Migration files:
- `0001_init.sql` — extensions, enums, tables, indexes
- `0002_rls.sql` — `is_admin()`, auth→profile trigger, RLS policies
- `0003_functions.sql` — attendance/task RPCs, incentive engine, triggers
- `0004_views.sql` — dashboard views + `get_agent_kpis()`
- `0005_seed.sql` — settings, platforms, task types, rules, sample clients
- `0006_cron.sql` — optional pg_cron jobs

---

## 4. Setup

### Prerequisites
- Node 18+ (tested on Node 24), a Supabase project.

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create the Supabase project** at https://supabase.com and grab the API keys
   (Project Settings → API).

3. **Environment variables** — copy and fill:
   ```bash
   cp .env.local.example .env.local
   ```
   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (server-only; used to create agent accounts).

4. **Run the migrations.** Easiest path — open the Supabase **SQL Editor** and paste
   each file `0001` → `0005` (and optionally `0006`) in order. Or, with the Supabase CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push        # if using the CLI migration flow
   ```

5. **Create users.** In Supabase → Authentication → Users, add the owner and agents
   (or have them sign up). A `profiles` row is created automatically. Then promote the owner:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Owner Name'
   where email = 'owner@youragency.com';
   ```
   After that, the admin can create the 5 agents from **Admin → Team → Add agent**.

6. **Run the app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you'll be routed to `/admin` or `/agent` by role.

### Realtime (optional but recommended)
Enable Realtime for `attendance_sessions` and `tasks` in the Supabase dashboard
(Database → Replication) to push live updates. The app already revalidates on every
mutation; add a `supabase.channel(...)` subscription in a client component for instant
cross-user updates.

---

## 5. Step-by-step implementation plan

This repo is already scaffolded end-to-end. If you're rebuilding or extending, follow
this order:

1. **Foundation** — Next.js + Tailwind + shadcn config, `lib/utils`, theme tokens. ✅
2. **Database** — run `0001`–`0005`. Verify RLS by querying as an agent vs admin. ✅
3. **Auth** — Supabase clients (`lib/supabase/*`), `middleware.ts`, login page, role routing. ✅
4. **Attendance** — RPCs + `AttendancePanel` + agent dashboard/attendance pages. ✅
5. **Tasks** — create dialog, list/detail, agent timer + submit, admin review (revision/complete). ✅
6. **Dashboards** — admin live stats + agent KPI summary over the views. ✅
7. **KPI + incentives** — `get_agent_kpis`, penalties/rewards ledger, admin tuning UI. ✅
8. **Reports** — charts + agent/client tables. ✅
9. **Hardening (next steps)** — see below.

### Recommended next steps (productionizing)
- **Supabase Storage** for real file uploads (currently links). Add a bucket + signed URLs.
- **Per-agent timezone** column; convert before late/early comparisons (current logic uses server/UTC time — documented in `0003_functions.sql`).
- **Realtime subscriptions** for the admin "Team status" board.
- **pg_cron** (`0006_cron.sql`) to finalize monthly incentives automatically.
- **Email invites** instead of shared passwords (`inviteUserByEmail`).
- **Tests** for the RPCs (pgTAP) and a few Playwright flows.
- **Audit/rate limits** and error monitoring (Sentry).

---

## 6. Deployment

Deploy to **Vercel**: import the repo, add the three env vars, and deploy. Point
`NEXT_PUBLIC_SITE_URL` to the production URL. The Supabase project needs no extra
config beyond the migrations.

---

## 7. Assumptions

- One shift per agent per day; lateness/early-logout computed against the agent's
  `shift_start_time` / `shift_end_time` in **server (UTC) time**.
- Penalties/rewards are **points-based** by default; switch `unit` to a currency in
  `penalty_reward_rules` if you pay/deduct money.
- Monthly target = number of completed tasks (configurable per agent).
