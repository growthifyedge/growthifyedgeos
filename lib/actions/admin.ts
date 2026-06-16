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
