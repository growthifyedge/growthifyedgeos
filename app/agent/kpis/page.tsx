import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  Clock,
  CheckCircle2,
  Gauge,
  Trophy,
  AlertTriangle,
  RotateCcw,
  Timer,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/utils";
import type { AgentKpis, LedgerEntry, PenaltyRewardRule } from "@/lib/types";

export default async function AgentKpisPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStr = monthStart.toISOString().slice(0, 10);

  const [kpiRes, ledgerRes, rulesRes] = await Promise.all([
    supabase.rpc("get_agent_kpis", { p_agent: profile.id }),
    supabase
      .from("penalty_reward_ledger")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("period_month", monthStr)
      .order("created_at", { ascending: false }),
    supabase
      .from("penalty_reward_rules")
      .select("*")
      .eq("is_active", true)
      .order("type"),
  ]);

  const kpi = (kpiRes.data as AgentKpis | null) ?? null;
  const ledger = (ledgerRes.data ?? []) as LedgerEntry[];
  const rules = (rulesRes.data ?? []) as PenaltyRewardRule[];
  const rewards = rules.filter((r) => r.type === "reward");
  const penalties = rules.filter((r) => r.type === "penalty");

  if (!kpi) {
    return <p className="text-sm text-muted-foreground">No KPI data available.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My KPIs</h1>
        <p className="text-sm text-muted-foreground">
          {format(monthStart, "MMMM yyyy")} performance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="On-time login"
          value={`${kpi.on_time_rate}%`}
          hint={`${kpi.on_time_days}/${kpi.attendance_days} days`}
          icon={Clock}
          accent="blue"
        />
        <StatCard
          label="Productive hours"
          value={formatDuration(kpi.productive_seconds)}
          icon={Timer}
          accent="violet"
        />
        <StatCard
          label="Completed tasks"
          value={kpi.completed_tasks}
          hint={`Target ${kpi.monthly_task_target}`}
          icon={CheckCircle2}
          accent="green"
        />
        <StatCard
          label="Avg quality"
          value={kpi.avg_quality != null ? `${kpi.avg_quality}/10` : "—"}
          icon={Star}
          accent="amber"
        />
        <StatCard
          label="Missed deadlines"
          value={kpi.missed_deadlines}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard label="Revisions" value={kpi.revision_count} icon={RotateCcw} accent="slate" />
        <StatCard
          label="Net points"
          value={kpi.net_points}
          hint={`+${kpi.rewards_total} / -${kpi.penalties_total}`}
          icon={Trophy}
          accent={kpi.net_points >= 0 ? "green" : "red"}
        />
        <StatCard
          label="Target achievement"
          value={`${kpi.target_achievement_pct}%`}
          icon={Gauge}
          accent="blue"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly target progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={Math.min(100, kpi.target_achievement_pct)} />
          <p className="text-sm text-muted-foreground">
            {kpi.completed_tasks} of {kpi.monthly_task_target} tasks completed (
            {kpi.target_achievement_pct}%)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How your KPIs are calculated</CardTitle>
          <CardDescription>
            Full transparency — here&apos;s exactly how each number is worked out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="grid gap-2 sm:grid-cols-2">
            <li>
              <span className="font-medium text-foreground">On-time login</span> —
              days you started before your shift start + grace, ÷ days attended.
            </li>
            <li>
              <span className="font-medium text-foreground">Productive hours</span> —
              total time your task timer ran this month.
            </li>
            <li>
              <span className="font-medium text-foreground">Completed tasks</span> —
              tasks approved &amp; completed by admin this month.
            </li>
            <li>
              <span className="font-medium text-foreground">Target achievement</span>{" "}
              — completed ÷ your monthly target.
            </li>
            <li>
              <span className="font-medium text-foreground">Avg quality</span> —
              average admin score (0–10) on your completed tasks.
            </li>
            <li>
              <span className="font-medium text-foreground">Missed deadlines</span> —
              tasks completed after their deadline.
            </li>
          </ul>
          <Separator />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 font-medium text-emerald-600">
                Rewards — earn points
              </p>
              <ul className="space-y-1">
                {rewards.map((r) => (
                  <li key={r.code} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium text-emerald-600">+{r.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium text-red-600">Penalties — lose points</p>
              <ul className="space-y-1">
                {penalties.map((r) => (
                  <li key={r.code} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium text-red-600">-{r.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penalties &amp; rewards this month</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nothing yet — keep it up!
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant={e.type === "reward" ? "default" : "destructive"}>
                        {e.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.label}</TableCell>
                    <TableCell className={e.type === "reward" ? "text-emerald-600" : "text-red-600"}>
                      {e.type === "reward" ? "+" : "-"}
                      {e.amount}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {e.reason}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(e.created_at), "MMM d")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
