import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { TaskList } from "@/components/app/task-list";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { TaskFeedRow } from "@/lib/types";

export default async function AgentTasksPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_task_feed")
    .select("*")
    .eq("assigned_to", profile.id)
    .order("created_at", { ascending: false });

  const tasks = (data ?? []) as TaskFeedRow[];
  const open = tasks.filter((t) => t.status !== "completed");
  const revision = tasks.filter((t) => t.status === "revision");
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Everything assigned to you.
        </p>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="revision">Revisions ({revision.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <TaskList tasks={open} basePath="/agent/tasks" showAssignee={false} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="revision">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <TaskList
                tasks={revision}
                basePath="/agent/tasks"
                showAssignee={false}
                emptyTitle="No revisions"
                emptyDescription="Tasks the admin sends back for changes will appear here."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="completed">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <TaskList
                tasks={completed}
                basePath="/agent/tasks"
                showAssignee={false}
                emptyTitle="Nothing completed yet"
                emptyDescription="Your finished, admin-approved tasks will be listed here."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
