"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return "Admin only.";
  return null;
}

// ---- Agent / user management (service role) ----

export interface CreateAgentInput {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  shift_start_time?: string;
  shift_end_time?: string;
  monthly_task_target?: number;
}

export async function createAgent(input: CreateAgentInput): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name.trim(), role: input.role },
  });
  if (error) return { ok: false, error: error.message };

  // The handle_new_user trigger created the profile; apply extra fields.
  const userId = data.user?.id;
  if (userId) {
    await admin
      .from("profiles")
      .update({
        full_name: input.full_name.trim(),
        role: input.role,
        shift_start_time: input.shift_start_time || "09:00",
        shift_end_time: input.shift_end_time || "18:00",
        monthly_task_target: input.monthly_task_target ?? 60,
      })
      .eq("id", userId);
  }

  revalidatePath("/admin/agents");
  return { ok: true };
}

export interface UpdateProfileInput {
  id: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  monthly_task_target?: number;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { id, ...fields } = input;
  const { error } = await supabase.from("profiles").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/agents");
  return { ok: true };
}

// ---- Clients ----

export interface UpsertClientInput {
  id?: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  notes?: string;
  is_active?: boolean;
}

export async function upsertClient(input: UpsertClientInput): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };
  if (!input.name?.trim()) return { ok: false, error: "Client name is required." };

  const supabase = await createClient();
  const payload = {
    name: input.name.trim(),
    contact_name: input.contact_name?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    notes: input.notes?.trim() || null,
    is_active: input.is_active ?? true,
  };

  const { error } = input.id
    ? await supabase.from("clients").update(payload).eq("id", input.id)
    : await supabase.from("clients").insert(payload);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true };
}

// ---- Settings ----

export interface UpdateSettingsInput {
  base_currency?: string;
  payroll_start_date?: string;
  allowed_late_per_month?: number;
  grace_period_minutes?: number;
  max_break_minutes?: number;
  standard_work_minutes?: number;
  early_logout_grace_min?: number;
  low_completion_threshold?: number;
  high_quality_threshold?: number;
}

export async function updateSettings(input: UpdateSettingsInput): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update(input).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ---- Penalty / reward rules ----

export async function updateRuleAmount(
  code: string,
  amount: number,
  isActive: boolean,
): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("penalty_reward_rules")
    .update({ amount, is_active: isActive })
    .eq("code", code);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/penalties");
  return { ok: true };
}

/** Recompute monthly target/quality rewards + low-completion penalties. */
export async function runIncentives(month?: string): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase.rpc("calculate_monthly_incentives", {
    p_month: month ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/penalties");
  revalidatePath("/admin");
  return { ok: true };
}

// ---- Edit / delete agents ----

export interface EditAgentInput {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  shift_start_time: string;
  shift_end_time: string;
  monthly_task_target: number;
  monthly_salary: number;
  working_days_per_month: number;
}

export async function editAgent(input: EditAgentInput): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };
  if (!input.full_name.trim()) return { ok: false, error: "Name is required." };
  if (!input.email.trim()) return { ok: false, error: "Email is required." };
  if (!input.shift_start_time || !input.shift_end_time) {
    return { ok: false, error: "Shift start and end time are required." };
  }
  if (!(input.working_days_per_month > 0)) {
    return { ok: false, error: "Working days per month must be greater than 0." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", input.id)
    .single();
  if (!target) return { ok: false, error: "Agent not found." };

  // Don't allow demoting the last remaining admin.
  if (target.role === "admin" && input.role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "You can't remove the last admin." };
    }
  }

  // Email change requires updating the auth user (service role).
  if (target.email !== input.email.trim()) {
    const admin = createAdminClient();
    const { error: authErr } = await admin.auth.admin.updateUserById(input.id, {
      email: input.email.trim(),
      email_confirm: true,
    });
    if (authErr) return { ok: false, error: authErr.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      email: input.email.trim(),
      role: input.role,
      is_active: input.is_active,
      shift_start_time: input.shift_start_time,
      shift_end_time: input.shift_end_time,
      monthly_task_target: input.monthly_task_target,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  // Sync payroll salary + working days (creates the settings row if missing).
  const { error: payErr } = await supabase.from("payroll_settings").upsert(
    {
      agent_id: input.id,
      monthly_salary: input.monthly_salary,
      working_days_per_month: input.working_days_per_month,
    },
    { onConflict: "agent_id" },
  );
  if (payErr) return { ok: false, error: payErr.message };

  revalidatePath("/admin/agents");
  return { ok: true };
}

/**
 * Permanently delete an agent. Removes the Supabase Auth user, which cascades
 * (FK ON DELETE CASCADE) to the profile and all of the agent's attendance,
 * leave, payroll, adjustments, ledger and time-log rows. Tasks they touched are
 * preserved (assignee/creator set to null).
 *
 * Guards: can't delete yourself, can't delete the last admin, and can't delete
 * an agent who has approved/paid payroll history.
 */
export async function deleteAgent(id: string): Promise<ActionResult> {
  const err = await assertAdmin();
  if (err) return { ok: false, error: err };

  const me = await getCurrentProfile();
  if (me?.id === id) {
    return { ok: false, error: "You can't delete your own account." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();
  if (!target) return { ok: false, error: "Agent not found." };

  if (target.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "You can't delete the last admin account." };
    }
  }

  // Protect finalized payroll history from permanent deletion.
  const { count: finalized } = await supabase
    .from("payroll_runs")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", id)
    .in("status", ["approved", "paid"]);
  if ((finalized ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This agent has approved/paid payroll history and can't be permanently deleted. Set them Inactive via Edit instead.",
    };
  }

  // Permanent delete via the auth user (cascades to all dependent records).
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error: "Service role key is required for permanent deletion.",
    };
  }
  const { error: authErr } = await admin.auth.admin.deleteUser(id);
  if (authErr) return { ok: false, error: authErr.message };

  revalidatePath("/admin/agents");
  revalidatePath("/admin");
  return { ok: true };
}
