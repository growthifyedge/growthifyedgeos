"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { LeaveType } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string };

function revalidateLeave() {
  revalidatePath("/agent/leave");
  revalidatePath("/admin/leave");
  revalidatePath("/admin");
}

export interface RequestLeaveInput {
  leave_type: LeaveType;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  is_half_day: boolean;
  reason?: string;
}

export async function requestLeave(
  input: RequestLeaveInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!input.start_date || !input.end_date) {
    return { ok: false, error: "Start and end dates are required." };
  }
  if (input.end_date < input.start_date) {
    return { ok: false, error: "End date can't be before the start date." };
  }

  // A half-day request always covers a single day.
  const half = input.is_half_day || input.leave_type === "half_day";
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    agent_id: profile.id,
    leave_type: input.leave_type,
    start_date: input.start_date,
    end_date: half ? input.start_date : input.end_date,
    is_half_day: half,
    reason: input.reason?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidateLeave();
  return { ok: true };
}

export async function cancelLeave(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // RLS only allows deleting your own *pending* request.
  const { error } = await supabase
    .from("leave_requests")
    .delete()
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidateLeave();
  return { ok: true };
}

export async function reviewLeave(
  id: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({
      status,
      admin_note: note?.trim() || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateLeave();
  return { ok: true };
}
