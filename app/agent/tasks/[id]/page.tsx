import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getTaskBundle } from "@/lib/queries";
import { TaskDetail } from "@/components/app/task-detail";
import { AgentTaskActions } from "@/components/app/agent-task-actions";

export default async function AgentTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const { task, notes, attachments, history, runningSince } =
    await getTaskBundle(id);

  // RLS already prevents access, but guard explicitly for a clean 404.
  if (!task || task.assigned_to !== profile.id) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/agent/tasks"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to my tasks
      </Link>
      <TaskDetail task={task} notes={notes} attachments={attachments} history={history}>
        <AgentTaskActions task={task} runningSince={runningSince} />
      </TaskDetail>
    </div>
  );
}
