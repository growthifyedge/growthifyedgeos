// =============================================================================
// Shared domain types mirroring the Postgres schema (supabase/migrations).
// =============================================================================

export type UserRole = "admin" | "agent";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "paused"
  | "submitted"
  | "revision"
  | "completed";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type AttendanceStatus = "active" | "on_break" | "ended";

export type AttachmentKind = "link" | "file";

export type LedgerType = "penalty" | "reward";

export type LeaveType =
  | "sick"
  | "casual"
  | "emergency"
  | "vacation"
  | "half_day"
  | "wfh";

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  shift_start_time: string; // "HH:MM:SS"
  shift_end_time: string;
  monthly_task_target: number;
  monthly_hours_target: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Platform {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface TaskType {
  id: string;
  name: string;
  default_minutes: number;
  is_active: boolean;
}

export interface Task {
  id: string;
  title: string;
  instructions: string | null;
  client_id: string | null;
  platform_id: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  expected_minutes: number | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  revision_count: number;
  quality_score: number | null;
  active_seconds: number;
  deliverable_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Row from the v_task_feed view (task + joined names). */
export interface TaskFeedRow extends Task {
  client_name: string | null;
  platform_name: string | null;
  task_type_name: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  is_overdue: boolean;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  kind: AttachmentKind;
  url: string;
  file_name: string | null;
  created_at: string;
}

export interface TaskNote {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  agent_id: string;
  work_date: string;
  shift_start: string;
  shift_end: string | null;
  status: AttendanceStatus;
  break_seconds: number;
  work_seconds: number;
  is_late: boolean;
  late_minutes: number;
  is_early_logout: boolean;
  early_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface BreakLog {
  id: string;
  session_id: string;
  agent_id: string;
  break_start: string;
  break_end: string | null;
  duration_seconds: number | null;
  reason: string | null;
  created_at: string;
}

export interface PenaltyRewardRule {
  id: string;
  code: string;
  type: LedgerType;
  label: string;
  description: string | null;
  trigger_key: string;
  amount: number;
  unit: string;
  is_active: boolean;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  agent_id: string;
  type: LedgerType;
  rule_code: string;
  label: string;
  amount: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  period_month: string;
  auto_generated: boolean;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  agent_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  reason: string | null;
  status: LeaveStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  base_currency: string;
  grace_period_minutes: number;
  max_break_minutes: number;
  standard_work_minutes: number;
  early_logout_grace_min: number;
  low_completion_threshold: number;
  high_quality_threshold: number;
  payroll_start_date: string;
  allowed_late_per_month: number;
  updated_at: string;
}

// ---- View rows ----

export interface AgentTodayRow {
  agent_id: string;
  full_name: string;
  avatar_url: string | null;
  shift_start_time: string;
  shift_end_time: string;
  session_id: string | null;
  status: AttendanceStatus | null;
  shift_start: string | null;
  shift_end: string | null;
  break_seconds: number | null;
  work_seconds: number | null;
  is_late: boolean | null;
  late_minutes: number | null;
  is_online: boolean;
  is_on_break: boolean;
}

export interface ClientTaskStatusRow {
  client_id: string;
  client_name: string;
  logo_url: string | null;
  total: number;
  todo: number;
  in_progress: number;
  paused: number;
  submitted: number;
  revision: number;
  completed: number;
  overdue: number;
}

export interface AgentProductivityRow {
  agent_id: string;
  full_name: string;
  avatar_url: string | null;
  monthly_task_target: number;
  open_tasks: number;
  in_progress: number;
  completed_this_month: number;
  overdue: number;
  productive_seconds_month: number;
  avg_quality: number | null;
  revisions: number;
}

export interface AgentKpis {
  agent_id: string;
  period_month: string;
  attendance_days: number;
  on_time_days: number;
  late_days: number;
  on_time_rate: number;
  total_work_seconds: number;
  total_break_seconds: number;
  productive_seconds: number;
  completed_tasks: number;
  missed_deadlines: number;
  open_overdue: number;
  revision_count: number;
  avg_quality: number | null;
  monthly_task_target: number;
  target_achievement_pct: number;
  penalties_total: number;
  rewards_total: number;
  net_points: number;
}
