"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

async function callRpc(
  fn: string,
  args?: Record<string, unknown>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args ?? {});
  if (error) return { ok: false, error: error.message };
  revalidatePath("/agent");
  revalidatePath("/admin");
  return { ok: true };
}

export async function startShift(): Promise<ActionResult> {
  return callRpc("start_shift");
}

export async function startBreak(reason?: string): Promise<ActionResult> {
  return callRpc("start_break", { p_reason: reason ?? null });
}

export async function endBreak(): Promise<ActionResult> {
  return callRpc("end_break");
}

export async function endShift(): Promise<ActionResult> {
  return callRpc("end_shift");
}
