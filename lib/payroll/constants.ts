import type { PayrollStatus, AdjustmentKind } from "@/types/payroll";

// Common currencies offered in the payroll settings UI. Editable list — these
// are validated ISO 4217 codes so Intl currency formatting works.
export const CURRENCIES = [
  "USD",
  "PKR",
  "EUR",
  "GBP",
  "INR",
  "AED",
  "SAR",
  "CAD",
  "AUD",
] as const;

export const PAYROLL_STATUSES: PayrollStatus[] = [
  "draft",
  "reviewed",
  "approved",
  "paid",
];

export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
  paid: "Paid",
};

export const PAYROLL_STATUS_STYLES: Record<PayrollStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  reviewed: "bg-blue-100 text-blue-700 border-blue-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  paid: "bg-violet-100 text-violet-700 border-violet-200",
};

// ---- Adjustment categories (bonuses + deductions) ----

export const BONUS_CATEGORIES = [
  "performance_bonus",
  "incentive",
  "overtime",
  "appreciation",
  "festival_bonus",
  "manual_bonus",
] as const;

export const DEDUCTION_CATEGORIES = [
  "leave_deduction",
  "late_penalty_deduction",
  "salary_advance",
  "manual_deduction",
  "damage_loss",
  "other_deduction",
] as const;

export const ADJUSTMENT_CATEGORY_LABELS: Record<string, string> = {
  performance_bonus: "Performance Bonus",
  incentive: "Incentive",
  overtime: "Overtime",
  appreciation: "Appreciation Reward",
  festival_bonus: "Festival Bonus",
  manual_bonus: "Manual Bonus",
  leave_deduction: "Leave Deduction",
  late_penalty_deduction: "Late Penalty Deduction",
  salary_advance: "Salary Advance",
  manual_deduction: "Manual Deduction",
  damage_loss: "Damage / Loss",
  other_deduction: "Other Deduction",
};

export function categoriesForKind(kind: AdjustmentKind): readonly string[] {
  return kind === "bonus" ? BONUS_CATEGORIES : DEDUCTION_CATEGORIES;
}

export function categoryLabel(category: string): string {
  return ADJUSTMENT_CATEGORY_LABELS[category] ?? category;
}

// ---- Workflow transitions (single-step forward only) ----

export const NEXT_PAYROLL_STATUS: Record<PayrollStatus, PayrollStatus | null> = {
  draft: "reviewed",
  reviewed: "approved",
  approved: "paid",
  paid: null,
};

export const NEXT_STATUS_ACTION_LABEL: Record<PayrollStatus, string> = {
  draft: "Mark as reviewed",
  reviewed: "Approve payroll",
  approved: "Mark as paid",
  paid: "Paid — locked",
};

/** Approve and Paid are the audit-sensitive transitions that need confirmation. */
export function transitionNeedsConfirm(next: PayrollStatus): boolean {
  return next === "approved" || next === "paid";
}
