import { CheckCircle2, CalendarDays, CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/app/stat-card";
import {
  ProductivityBarChart,
  StatusDonut,
} from "@/components/app/reports-charts";
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
import { formatDuration, pct } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import type {
  AgentProductivityRow,
  ClientTaskStatusRow,
  TaskStatus,
} from "@/lib/types";

function startOfDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [
    prodRes,
    clientRes,
    statusRes,
    completedToday,
    completed7,
    completed30,
  ] = await Promise.all([
    supabase.from("v_agent_productivity").select("*").order("completed_this_month", { ascending: false }),
    supabase.from("v_client_task_status").select("*").order("total", { ascending: false }),
    supabase.from("tasks").select("status"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", startOfDaysAgo(0)),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", startOfDaysAgo(7)),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", startOfDaysAgo(30)),
  ]);

  const prod = (prodRes.data ?? []) as AgentProductivityRow[];
  const clients = (clientRes.data ?? []) as ClientTaskStatusRow[];

  const statusCounts = ((statusRes.data ?? []) as { status: TaskStatus }[]).reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TaskStatus, number>,
  );

  const donutData = (Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => ({
    name: STATUS_LABELS[s],
    value: statusCounts[s] ?? 0,
  }));

  const barData = prod.map((p) => ({
    name: p.full_name?.trim() || "Unnamed",
    completed: p.completed_this_month,
    target: p.monthly_task_target,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">KPI &amp; Reports</h1>
        <p className="text-sm text-muted-foreground">
          Delivery performance across agents and clients.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Completed today" value={completedToday.count ?? 0} icon={CheckCircle2} accent="green" />
        <StatCard label="Completed (7 days)" value={completed7.count ?? 0} icon={CalendarDays} accent="blue" />
        <StatCard label="Completed (30 days)" value={completed30.count ?? 0} icon={CalendarRange} accent="violet" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completed vs target (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductivityBarChart data={barData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Task status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonut data={donutData} />
          </CardContent>
        </Card>
      </div>

      {/* Agent-wise performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent-wise performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Target %</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Revisions</TableHead>
                <TableHead>Productive</TableHead>
                <TableHead>Avg quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prod.map((p) => (
                <TableRow key={p.agent_id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.completed_this_month}</TableCell>
                  <TableCell>{pct(p.completed_this_month, p.monthly_task_target)}%</TableCell>
                  <TableCell>{p.open_tasks}</TableCell>
                  <TableCell className={p.overdue > 0 ? "text-red-600" : ""}>{p.overdue}</TableCell>
                  <TableCell>{p.revisions}</TableCell>
                  <TableCell className="text-sm">{formatDuration(p.productive_seconds_month)}</TableCell>
                  <TableCell>{p.avg_quality ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client-wise delivery */}
      <Card>
        <CardHeader>
          <CardTitle>Client-wise delivery</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>To Do</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.client_id}>
                  <TableCell className="font-medium">{c.client_name}</TableCell>
                  <TableCell>{c.todo}</TableCell>
                  <TableCell>{c.in_progress}</TableCell>
                  <TableCell>{c.submitted}</TableCell>
                  <TableCell>{c.revision}</TableCell>
                  <TableCell>{c.completed}</TableCell>
                  <TableCell className={c.overdue > 0 ? "text-red-600" : ""}>{c.overdue}</TableCell>
                  <TableCell>{c.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
