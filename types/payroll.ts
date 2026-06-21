// =============================================================================
// Payroll domain types — mirror supabase/migrations/0008_payroll.sql
// Kept in /types per the payroll module layout (/types, /lib/payroll,
// /components/payroll).
// =============================================================================

export type SalaryType = "monthly" | "fixed";

export type PayrollStatus = "draft" | "reviewed" | "approved" | "paid";

export type AdjustmentKind = "bonus" | "deduction";

export interface PayrollSettings {
  agent_id: string;
  monthly_salary: number;
  currency: string;
  salary_type: SalaryType;
  working_days_per_month: number;
  /** Generated in the DB: monthly_salary / working_days_per_month. */
  daily_rate: number;
  joining_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollAdjustment {
  id: string;
  agent_id: string;
  period_month: string; // YYYY-MM-01
  kind: AdjustmentKind;
  category: string;
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  agent_id: string;
  period_month: string; // YYYY-MM-01

  // period window (date-range based)
  period_start: string | null;
  period_end: string | null;
  is_trial: boolean;

  // salary snapshot
  base_salary: number;
  currency: string;
  working_days: number;
  total_working_days: number; // expected working days for the period (prorated)
  daily_rate: number;

  // attendance / leave snapshot
  present_days: number;
  approved_leave_days: number;
  unapproved_absence_days: number;
  late_count: number;
  allowed_late_count: number;
  late_to_absent_days: number;
  productive_seconds: number;

  // money breakdown
  leave_deduction: number; // unapproved-absence deduction
  approved_leave_deduction: number; // approved leave (unpaid)
  late_to_absent_deduction: number;
  total_bonuses: number;
  total_manual_deductions: number;
  total_deductions: number;

  // KPI snapshot
  completed_tasks: number;
  target_pct: number;
  net_kpi_points: number;

  // payable
  computed_payable: number;
  override_amount: number | null;
  /** Editable, app-maintained: override_amount ?? computed_payable. */
  final_payable: number;

  // workflow
  status: PayrollStatus;
  admin_note: string | null;
  created_by: string | null;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}
