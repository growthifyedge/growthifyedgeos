"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function revalidateTaskViews(taskId?: string) {
  revalidatePath("/agent");
  revalidatePath("/agent/tasks");
  revalidatePath("/admin");
  revalidatePath("/admin/tasks");
  if (taskId) {
    revalidatePath(`/agent/tasks/${taskId}`);
    revalidatePath(`/admin/tasks/${taskId}`);
  }
}

// ---- Agent task-timer transitions (RPC) ----

export async function startTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_task", { p_task_id: taskId });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

export async function pauseTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_task", { p_task_id: taskId });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

export async function submitTask(
  taskId: string,
  link?: string,
  note?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_task", {
    p_task_id: taskId,
    p_link: link?.trim() || null,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

// ---- Admin review transitions (RPC) ----

export async function requestRevision(
  taskId: string,
  note?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_revision", {
    p_task_id: taskId,
    p_note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

export async function completeTask(
  taskId: string,
  quality?: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_task", {
    p_task_id: taskId,
    p_quality: quality ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

// ---- Notes & attachments ----

export async function addNote(
  taskId: string,
  body: string,
): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Note cannot be empty." };
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_notes")
    .insert({ task_id: taskId, author_id: profile?.id ?? null, body: text });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

export async function addAttachment(
  taskId: string,
  url: string,
  fileName?: string,
): Promise<ActionResult> {
  const link = url.trim();
  if (!link) return { ok: false, error: "URL is required." };
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    uploaded_by: profile?.id ?? null,
    kind: "link",
    url: link,
    file_name: fileName ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

// ---- Admin: create task ----

export interface CreateTaskInput {
  title: string;
  instructions?: string;
  client_id?: string;
  platform_id?: string;
  task_type_id?: string;
  assigned_to?: string;
  priority: TaskPriority;
  deadline?: string; // ISO
  expected_minutes?: number;
  attachment_url?: string;
}

export async function createTask(
  input: CreateTaskInput,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  if (!input.title?.trim()) return { ok: false, error: "Title is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      client_id: input.client_id || null,
      platform_id: input.platform_id || null,
      task_type_id: input.task_type_id || null,
      assigned_to: input.assigned_to || null,
      created_by: profile.id,
      priority: input.priority,
      deadline: input.deadline || null,
      expected_minutes: input.expected_minutes ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (input.attachment_url?.trim() && data?.id) {
    await supabase.from("task_attachments").insert({
      task_id: data.id,
      uploaded_by: profile.id,
      kind: "link",
      url: input.attachment_url.trim(),
      file_name: "Brief / reference",
    });
  }

  revalidateTaskViews();
  return { ok: true, id: data?.id };
}

export async function reassignTask(
  taskId: string,
  agentId: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ assigned_to: agentId })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidateTaskViews(taskId);
  return { ok: true };
}

// ---- Admin: edit an existing task ----

export interface UpdateTaskInput {
  id: string;
  title: string;
  instructions?: string;
  client_id?: string;
  platform_id?: string;
  task_type_id?: string;
  assigned_to?: string;
  priority: TaskPriority;
  status?: TaskStatus;
  deadline?: string | null; // ISO string, or null to clear
  expected_minutes?: number | null;
  attachment_url?: string; // optional: appended as a new reference link
}

export async function updateTask(input: UpdateTaskInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  if (!input.title?.trim()) return { ok: false, error: "Title is required." };

  const supabase = await createClient();

  // Read current state so we only touch completed_at when sensible.
  const { data: current, error: readErr } = await supabase
    .from("tasks")
    .select("status, completed_at")
    .eq("id", input.id)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    instructions: input.instructions?.trim() || null,
    client_id: input.client_id || null,
    platform_id: input.platform_id || null,
    task_type_id: input.task_type_id || null,
    assigned_to: input.assigned_to || null,
    priority: input.priority,
    deadline: input.deadline || null,
    expected_minutes: input.expected_minutes ?? null,
  };

  // Optional status override. The DB trigger logs the change to
  // task_status_history automatically, so the audit trail stays intact.
  if (input.status) {
    patch.status = input.status;
    if (input.status === "completed" && current && !current.completed_at) {
      patch.completed_at = new Date().toISOString();
    }
  }

  const { error } = await supabase.from("tasks").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  if (input.attachment_url?.trim()) {
    await supabase.from("task_attachments").insert({
      task_id: input.id,
      uploaded_by: profile.id,
      kind: "link",
      url: input.attachment_url.trim(),
      file_name: "Reference link",
    });
  }

  revalidateTaskViews(input.id);
  return { ok: true };
}
