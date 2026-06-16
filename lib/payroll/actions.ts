"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { toPeriodMonth } from "@/lib/payroll/period";
import type { SalaryType, AdjustmentKind } from "@/types/payroll";

export type PayrollActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return "Admin only.";
  return null;
}

export interface PayrollSettingsInput {
  agent_id: string;
  monthly_salary: number;
  currency: string;
  salary_type: SalaryType;
  working_days_per_month: number;
  joining_date?: string | null;
  is_active: boolean;
}

export async function upsertPayrollSettings(
  input: PayrollSettingsInput,
): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  if (input.working_days_per_month <= 0) {
    return { ok: false, error: "Working days per month must be greater than 0." };
  }
  if (input.monthly_salary < 0) {
    return { ok: false, error: "Monthly salary can't be negative." };
  }

  const supabase = await createClient();

  // Fallback to the agency base currency only when none is provided.
  let currency = input.currency?.trim();
  if (!currency) {
    const { data: s } = await supabase
      .from("app_settings")
      .select("base_currency")
      .eq("id", 1)
      .single();
    currency = s?.base_currency || "USD";
  }

  const { error } = await supabase.from("payroll_settings").upsert(
    {
      agent_id: input.agent_id,
      monthly_salary: input.monthly_salary,
      currency,
      salary_type: input.salary_type,
      working_days_per_month: input.working_days_per_month,
      joining_date: input.joining_date || null,
      is_active: input.is_active,
      // daily_rate is a generated column — never set it here.
    },
    { onConflict: "agent_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/agents");
  revalidatePath("/admin/payroll");
  return { ok: true };
}

// =============================================================================
// Bonus & Deduction adjustments
// =============================================================================

function revalidatePayroll() {
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/payroll/adjustments");
  revalidatePath("/agent/payroll");
}

export interface AdjustmentInput {
  agent_id: string;
  period_month: string; // any month string; normalized to YYYY-MM-01
  kind: AdjustmentKind;
  category: string;
  amount: number;
  reason?: string;
}

export async function addAdjustment(
  input: AdjustmentInput,
): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };
  if (!input.agent_id) return { ok: false, error: "Select an agent." };
  if (!input.category) return { ok: false, error: "Select a category." };
  if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than 0." };

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_adjustments").insert({
    agent_id: input.agent_id,
    period_month: toPeriodMonth(input.period_month),
    kind: input.kind,
    category: input.category,
    amount: input.amount,
    reason: input.reason?.trim() || null,
    created_by: profile?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true };
}

export async function updateAdjustment(
  id: string,
  input: AdjustmentInput,
): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };
  if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than 0." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_adjustments")
    .update({
      agent_id: input.agent_id,
      period_month: toPeriodMonth(input.period_month),
      kind: input.kind,
      category: input.category,
      amount: input.amount,
      reason: input.reason?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true };
}

export async function deleteAdjustment(id: string): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_adjustments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true };
}

// =============================================================================
// Payroll generation (Phase 5) — snapshot, idempotent, read-only integration
// =============================================================================

export async function generatePayroll(
  agentId: string,
  month: string,
): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_payroll", {
    p_agent: agentId,
    p_month: toPeriodMonth(month),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true };
}

export async function generatePayrollAll(
  month: string,
): Promise<PayrollActionResult & { count?: number }> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_payroll_all", {
    p_month: toPeriodMonth(month),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true, count: typeof data === "number" ? data : undefined };
}

// =============================================================================
// Approval workflow (Phase 6)
// =============================================================================

export async function setPayrollStatus(
  runId: string,
  status: "reviewed" | "approved" | "paid",
): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_payroll_status", {
    p_run: runId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true };
}

export async function updatePayrollRun(
  runId: string,
  override: number | null,
  note: string,
): Promise<PayrollActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_payroll_run", {
    p_run: runId,
    p_override: override,
    p_note: note ?? "",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePayroll();
  return { ok: true };
}
