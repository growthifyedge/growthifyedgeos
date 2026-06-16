import Link from "next/link";
import { redirect } from "next/navigation";
import { Gauge, CheckCircle2, Clock, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AttendancePanel } from "@/components/app/attendance-panel";
import { StatCard } from "@/components/app/stat-card";
import { TaskList } from "@/components/app/task-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { todayISODate } from "@/lib/utils";
import type { AttendanceSession, TaskFeedRow, AgentKpis } from "@/lib/types";

export default async function AgentDashboard() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const today = todayISODate();

  const [sessionRes, tasksRes, kpiRes] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("work_date", today)
      .maybeSingle(),
    supabase
      .from("v_task_feed")
      .select("*")
      .eq("assigned_to", profile.id)
      .neq("status", "completed")
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase.rpc("get_agent_kpis", { p_agent: profile.id }),
  ]);

  const session = (sessionRes.data as AttendanceSession | null) ?? null;
  let openBreakStart: string | null = null;
  if (session && session.status === "on_break") {
    const { data: br } = await supabase
      .from("break_logs")
      .select("break_start")
      .eq("session_id", session.id)
      .is("break_end", null)
      .maybeSingle();
    openBreakStart = (br?.break_start as string | undefined) ?? null;
  }

  const tasks = (tasksRes.data ?? []) as TaskFeedRow[];
  const kpi = (kpiRes.data as AgentKpis | null) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Hi {profile.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Clock in, knock out your tasks, and watch your score climb.
        </p>
      </div>

      <AttendancePanel session={session} openBreakStart={openBreakStart} />

      {kpi ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="On-time rate" value={`${kpi.on_time_rate}%`} icon={Clock} accent="blue" />
          <StatCard
            label="Completed (month)"
            value={kpi.completed_tasks}
            hint={`Target ${kpi.monthly_task_target}`}
            icon={CheckCircle2}
            accent="green"
          />
          <StatCard
            label="Target progress"
            value={`${kpi.target_achievement_pct}%`}
            icon={Gauge}
            accent="violet"
          />
          <StatCard
            label="Net points"
            value={kpi.net_points}
            hint={`+${kpi.rewards_total} / -${kpi.penalties_total}`}
            icon={Trophy}
            accent={kpi.net_points >= 0 ? "green" : "red"}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My open tasks ({tasks.length})</CardTitle>
          <Link href="/agent/tasks" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <TaskList
            tasks={tasks}
            basePath="/agent/tasks"
            showAssignee={false}
            emptyTitle="All caught up!"
            emptyDescription="You have no open tasks right now. New assignments will show here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
