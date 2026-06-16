import { createClient } from "@/lib/supabase/server";
import type {
  TaskFeedRow,
  TaskNote,
  TaskAttachment,
  TaskStatus,
} from "@/lib/types";

export type NoteWithAuthor = TaskNote & { author?: { full_name: string } | null };
export type HistoryRow = {
  id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  created_at: string;
};

export async function getTaskBundle(taskId: string) {
  const supabase = await createClient();
  const [task, notes, attachments, history, openTimer] = await Promise.all([
    supabase.from("v_task_feed").select("*").eq("id", taskId).maybeSingle(),
    supabase
      .from("task_notes")
      .select("*, author:profiles(full_name)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_status_history")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_time_logs")
      .select("started_at")
      .eq("task_id", taskId)
      .is("ended_at", null)
      .maybeSingle(),
  ]);

  return {
    task: (task.data as TaskFeedRow | null) ?? null,
    notes: (notes.data ?? []) as NoteWithAuthor[],
    attachments: (attachments.data ?? []) as TaskAttachment[],
    history: (history.data ?? []) as HistoryRow[],
    runningSince: (openTimer.data?.started_at as string | undefined) ?? null,
  };
}
