import { format } from "date-fns";
import { CheckCircle2, Clock, CalendarOff, AlertTriangle, Target, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge";
import { formatMoney } from "@/lib/payroll/format";
import { monthLabel } from "@/lib/payroll/period";
import { formatDuration } from "@/lib/utils";
import type { PayrollRun } from "@/types/payroll";

function Line({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "muted";
  strong?: boolean;
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-600"
      : tone === "red"
        ? "text-red-600"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={`${toneClass} ${strong ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Snap({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function PayrollBreakdown({
  run,
  agentName,
}: {
  run: PayrollRun;
  agentName: string;
}) {
  const cur = run.currency;
  const overridden =
    run.override_amount != null &&
    Number(run.override_amount) !== Number(run.computed_payable);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Salary breakdown */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{agentName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {monthLabel(run.period_month)}
              </p>
              {run.last_generated_at ? (
                <p className="text-xs text-muted-foreground">
                  Generated{" "}
                  {format(new Date(run.last_generated_at), "MMM d, yyyy HH:mm")}
                </p>
              ) : null}
            </div>
            <PayrollStatusBadge status={run.status} />
          </CardHeader>
          <CardContent className="space-y-2">
            <Line label="Base salary" value={formatMoney(run.base_salary, cur)} />
            <Line
              label="Bonuses"
              value={`+${formatMoney(run.total_bonuses, cur)}`}
              tone="green"
            />
            <Line
              label="Manual deductions"
              value={`−${formatMoney(run.total_manual_deductions, cur)}`}
              tone="red"
            />
            <Line
              label={`Leave deduction (${run.unapproved_absence_days} absent day${run.unapproved_absence_days === 1 ? "" : "s"})`}
              value={`−${formatMoney(run.leave_deduction, cur)}`}
              tone="red"
            />
            <Separator />
            <Line
              label="Computed payable"
              value={formatMoney(run.computed_payable, cur)}
              strong
            />
            {overridden ? (
              <Line
                label="Admin override"
                value={formatMoney(run.override_amount ?? 0, cur)}
                tone="muted"
              />
            ) : null}
            <Separator />
            <Line
              label="Final payable"
              value={formatMoney(run.final_payable, cur)}
              strong
            />
          </CardContent>
        </Card>

        {run.admin_note ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{run.admin_note}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshot</CardTitle>
          <p className="text-xs text-muted-foreground">
            Frozen at generation — won&apos;t change if KPI/attendance change later.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <Snap icon={CheckCircle2} label="Completed tasks" value={run.completed_tasks} />
          <Snap icon={Target} label="Target achievement" value={`${run.target_pct}%`} />
          <Snap icon={Trophy} label="Net KPI points" value={run.net_kpi_points} />
          <Snap icon={Clock} label="Productive hours" value={formatDuration(run.productive_seconds)} />
          <Snap icon={CalendarOff} label="Approved leave days" value={run.approved_leave_days} />
          <Snap icon={AlertTriangle} label="Unapproved absence days" value={run.unapproved_absence_days} />
          <Snap icon={Clock} label="Late logins (not deducted)" value={run.late_count} />
        </CardContent>
      </Card>
    </div>
  );
}
