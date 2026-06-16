import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTaskBundle } from "@/lib/queries";
import { TaskDetail } from "@/components/app/task-detail";
import { AdminTaskActions } from "@/components/app/admin-task-actions";
import { EditTaskDialog } from "@/components/app/edit-task-dialog";
import type { Client, Platform, TaskType, Profile } from "@/lib/types";

export default async function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { task, notes, attachments, history } = await getTaskBundle(id);
  if (!task) notFound();

  const supabase = await createClient();
  const [clients, platforms, taskTypes, agents] = await Promise.all([
    supabase.from("clients").select("*").eq("is_active", true).order("name"),
    supabase.from("platforms").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("task_types").select("*").eq("is_active", true).order("name"),
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "agent")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/tasks"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to tasks
        </Link>
        <EditTaskDialog
          task={task}
          clients={(clients.data ?? []) as Client[]}
          platforms={(platforms.data ?? []) as Platform[]}
          taskTypes={(taskTypes.data ?? []) as TaskType[]}
          agents={(agents.data ?? []) as Profile[]}
        />
      </div>
      <TaskDetail task={task} notes={notes} attachments={attachments} history={history}>
        <AdminTaskActions task={task} />
      </TaskDetail>
    </div>
  );
}
