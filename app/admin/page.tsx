import Link from "next/link";
import {
  Users,
  Wifi,
  Coffee,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Plane,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/app/stat-card";
import { PageHeader } from "@/components/app/page-header";
import { TaskList } from "@/components/app/task-list";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { formatDuration, pct, todayISODate } from "@/lib/utils";
import type {
  AgentTodayRow,
  ClientTaskStatusRow,
  AgentProductivityRow,
  TaskFeedRow,
  LeaveType,
} from "@/lib/types";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();
  const nowIso = new Date().toISOString();
  const leaveToday = todayISODate();

  const [
    today,
    clientStatus,
    productivity,
    recentTasks,
    openTimers,
    activeCount,
    delayedCount,
    completedTodayCount,
    offTodayRes,
  ] = await Promise.all([
    supabase.from("v_agent_today").select("*"),
    supabase.from("v_client_task_status").select("*").order("total", { ascending: false }),
    supabase.from("v_agent_productivity").select("*").order("completed_this_month", { ascending: false }),
    supabase
      .from("v_task_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("task_time_logs")
      .select("agent_id, started_at, task:tasks(title)")
      .is("ended_at", null),
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "completed"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .neq("status", "completed")
      .lt("deadline", nowIso),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", todayIso),
    supabase
      .from("leave_requests")
      .select("agent_id, leave_type, is_half_day")
      .eq("status", "approved")
      .lte("start_date", leaveToday)
      .gte("end_date", leaveToday),
  ]);

  const agents = (today.data ?? []) as AgentTodayRow[];
  const online = agents.filter((a) => a.is_online).length;
  const onBreak = agents.filter((a) => a.is_on_break).length;
  const clients = (clientStatus.data ?? []) as ClientTaskStatusRow[];
  const prod = (productivity.data ?? []) as AgentProductivityRow[];

  // Map of agents who currently have a running task timer -> task title.
  const openTimerRows = (openTimers.data ?? []) as {
    agent_id: string;
    started_at: string;
    task: { title: string } | { title: string }[] | null;
  }[];
  const workingMap = new Map<string, string>();
  for (const r of openTimerRows) {
    const title = Array.isArray(r.task) ? r.task[0]?.title : r.task?.title;
    if (!workingMap.has(r.agent_id)) workingMap.set(r.agent_id, title ?? "a task");
  }
  const workingCount = agents.filter(
    (a) => a.is_online && workingMap.has(a.agent_id),
  ).length;
  const idleCount = agents.filter(
    (a) => a.is_online && !workingMap.has(a.agent_id),
  ).length;

  const offToday = (
    (offTodayRes.data ?? []) as {
      agent_id: string;
      leave_type: LeaveType;
      is_half_day: boolean;
    }[]
  ).map((r) => ({
    name: agents.find((a) => a.agent_id === r.agent_id)?.full_name ?? "Someone",
    type: LEAVE_TYPE_LABELS[r.leave_type],
    half: r.is_half_day,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        greeting="Welcome back, GrowthifyEdge"
        title="GrowthifyEdge Operations Center"
        description="Live view of your team, tasks and clients."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total agents" value={agents.length} icon={Users} accent="slate" />
        <StatCard
          label="Online now"
          value={online}
          hint={`${workingCount} working · ${idleCount} idle`}
          icon={Wifi}
          accent="green"
        />
        <StatCard label="On break" value={onBreak} icon={Coffee} accent="amber" />
        <StatCard label="Active tasks" value={activeCount.count ?? 0} icon={ListChecks} accent="blue" />
        <StatCard label="Delayed tasks" value={delayedCount.count ?? 0} icon={AlertTriangle} accent="red" />
        <StatCard
          label="Completed today"
          value={completedTodayCount.count ?? 0}
          icon={CheckCircle2}
          accent="violet"
        />
      </div>

      {/* Who's off today */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-muted-foreground" /> Who&apos;s off today
          </CardTitle>
          <Link href="/admin/leave" className="text-sm text-primary hover:underline">
            Manage leave
          </Link>
        </CardHeader>
        <CardContent>
          {offToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is in today ✅</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {offToday.map((o, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm"
                >
                  <span className="font-medium">{o.name}</span>
                  <span className="text-muted-foreground">
                    · {o.type}
                    {o.half ? " (half)" : ""}
                  </span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Live team status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Team status — today</CardTitle>
            <p className="text-xs text-muted-foreground">
              {workingCount} working · {idleCount} idle · {onBreak} on break
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Current task</TableHead>
                  <TableHead>Work</TableHead>
                  <TableHead>Break</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a) => {
                  const working = a.is_online && workingMap.has(a.agent_id);
                  const idle = a.is_online && !working;
                  const dot = working
                    ? "bg-emerald-500 animate-pulse-dot"
                    : a.is_on_break
                      ? "bg-amber-500 animate-pulse-dot"
                      : idle
                        ? "bg-sky-400"
                        : a.status === "ended"
                          ? "bg-slate-400"
                          : "bg-slate-300";
                  const label = working
                    ? "Working"
                    : a.is_on_break
                      ? "On break"
                      : idle
                        ? "Idle"
                        : a.status === "ended"
                          ? "Ended"
                          : "Offline";
                  return (
                    <TableRow key={a.agent_id}>
                      <TableCell className="font-medium">{a.full_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className={"h-2 w-2 rounded-full " + dot} />
                          {label}
                          {a.is_late ? (
                            <span className="text-xs text-red-600">· late</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                        {working ? workingMap.get(a.agent_id) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(a.work_seconds)}
                      </TableCell>
                      <TableCell className="text-sm text-amber-600">
                        {formatDuration(a.break_seconds)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Client-wise task status */}
        <Card>
          <CardHeader>
            <CardTitle>Client-wise task status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Done</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.client_id}>
                    <TableCell className="font-medium">{c.client_name}</TableCell>
                    <TableCell>{c.total - c.completed}</TableCell>
                    <TableCell className={c.overdue > 0 ? "text-red-600" : ""}>
                      {c.overdue}
                    </TableCell>
                    <TableCell>{c.completed}</TableCell>
                    <TableCell>{c.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Agent productivity */}
      <Card>
        <CardHeader>
          <CardTitle>Agent productivity — this month</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-48">Progress</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Productive</TableHead>
                <TableHead>Avg quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prod.map((p) => {
                const progress = pct(p.completed_this_month, p.monthly_task_target);
                return (
                  <TableRow key={p.agent_id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell>{p.completed_this_month}</TableCell>
                    <TableCell>{p.monthly_task_target}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(100, progress)} />
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{p.open_tasks}</TableCell>
                    <TableCell className={p.overdue > 0 ? "text-red-600" : ""}>
                      {p.overdue}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(p.productive_seconds_month)}
                    </TableCell>
                    <TableCell>{p.avg_quality ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent tasks</CardTitle>
          <Link href="/admin/tasks" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <TaskList tasks={(recentTasks.data ?? []) as TaskFeedRow[]} basePath="/admin/tasks" />
        </CardContent>
      </Card>
    </div>
  );
}
