import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  CalendarOff,
  CalendarDays,
  AlertTriangle,
  Target,
  Trophy,
} from "lucide-react";
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
                {run.period_start && run.period_end
                  ? `${format(new Date(run.period_start), "MMM d")} – ${format(new Date(run.period_end), "MMM d, yyyy")}`
                  : monthLabel(run.period_month)}
              </p>
              {run.last_generated_at ? (
                <p className="text-xs text-muted-foreground">
                  Generated{" "}
                  {format(new Date(run.last_generated_at), "MMM d, yyyy HH:mm")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <PayrollStatusBadge status={run.status} />
              {run.is_trial ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Trial period
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Line label="Base salary" value={formatMoney(run.base_salary, cur)} />
            <Line
              label="Bonuses & perks"
              value={`+${formatMoney(run.total_bonuses, cur)}`}
              tone="green"
            />
            <Line
              label={`Absent deduction (${run.unapproved_absence_days} day${run.unapproved_absence_days === 1 ? "" : "s"})`}
              value={`−${formatMoney(run.leave_deduction, cur)}`}
              tone="red"
            />
            {run.approved_leave_deduction > 0 ? (
              <Line
                label={`Approved leave — unpaid (${run.approved_leave_days} day${run.approved_leave_days === 1 ? "" : "s"})`}
                value={`−${formatMoney(run.approved_leave_deduction, cur)}`}
                tone="red"
              />
            ) : null}
            {run.late_to_absent_deduction > 0 ? (
              <Line
                label={`Late penalty (${run.late_to_absent_days} day${run.late_to_absent_days === 1 ? "" : "s"})`}
                value={`−${formatMoney(run.late_to_absent_deduction, cur)}`}
                tone="red"
              />
            ) : null}
            <Line
              label="Manual deductions"
              value={`−${formatMoney(run.total_manual_deductions, cur)}`}
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
          <Snap icon={CalendarDays} label="Working days (expected)" value={run.total_working_days} />
          <Snap icon={CheckCircle2} label="Present days" value={run.present_days} />
          <Snap icon={CalendarOff} label="Approved leave (unpaid)" value={run.approved_leave_days} />
          <Snap icon={AlertTriangle} label="Unapproved absence" value={run.unapproved_absence_days} />
          <Snap icon={Clock} label={`Late logins (allowed ${run.allowed_late_count})`} value={run.late_count} />
          <Snap icon={AlertTriangle} label="Late → absent days" value={run.late_to_absent_days} />
          <Snap icon={CheckCircle2} label="Completed tasks" value={run.completed_tasks} />
          <Snap icon={Target} label="Target achievement" value={`${run.target_pct}%`} />
          <Snap icon={Trophy} label="Net KPI points" value={run.net_kpi_points} />
          <Snap icon={Clock} label="Productive hours" value={formatDuration(run.productive_seconds)} />
        </CardContent>
      </Card>
    </div>
  );
}
