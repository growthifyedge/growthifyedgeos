import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateTaskDialog } from "@/components/app/create-task-dialog";
import { TaskList } from "@/components/app/task-list";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import type {
  Client,
  Platform,
  TaskType,
  Profile,
  TaskFeedRow,
  TaskStatus,
} from "@/lib/types";

export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status as TaskStatus | undefined;
  const supabase = await createClient();

  let query = supabase
    .from("v_task_feed")
    .select("*")
    .order("created_at", { ascending: false });
  if (status && TASK_STATUSES.includes(status)) {
    query = query.eq("status", status);
  }

  const [tasks, clients, platforms, taskTypes, agents] = await Promise.all([
    query,
    supabase.from("clients").select("*").eq("is_active", true).order("name"),
    supabase.from("platforms").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("task_types").select("*").eq("is_active", true).order("name"),
    supabase.from("profiles").select("*").eq("role", "agent").eq("is_active", true).order("full_name"),
  ]);

  const filters: { label: string; value?: TaskStatus }[] = [
    { label: "All" },
    ...TASK_STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Create, assign and track every deliverable.
          </p>
        </div>
        <CreateTaskDialog
          clients={(clients.data ?? []) as Client[]}
          platforms={(platforms.data ?? []) as Platform[]}
          taskTypes={(taskTypes.data ?? []) as TaskType[]}
          agents={(agents.data ?? []) as Profile[]}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = (f.value ?? undefined) === status;
          const href = f.value ? `/admin/tasks?status=${f.value}` : "/admin/tasks";
          return (
            <Link
              key={f.label}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0 sm:p-2">
          <TaskList tasks={(tasks.data ?? []) as TaskFeedRow[]} basePath="/admin/tasks" />
        </CardContent>
      </Card>
    </div>
  );
}
