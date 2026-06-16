import Link from "next/link";
import { format } from "date-fns";
import {
  ChevronLeft,
  Wallet,
  Gift,
  TrendingDown,
  BadgeCheck,
  Hourglass,
  Users,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { PayrollReportFilters } from "@/components/payroll/payroll-report-filters";
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge";
import { Button } from "@/components/ui/button";
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
import { formatMoney } from "@/lib/payroll/format";
import { formatDuration } from "@/lib/utils";
import {
  toPeriodMonth,
  currentPeriodMonth,
  recentPeriodMonths,
  monthLabel,
} from "@/lib/payroll/period";
import type { PayrollRun, PayrollStatus } from "@/types/payroll";

export default async function PayrollReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    status?: string;
    agent?: string;
    paid?: string;
  }>;
}) {
  const sp = await searchParams;
  const month = sp.month ? toPeriodMonth(sp.month) : currentPeriodMonth();
  const months = recentPeriodMonths(12);
  if (!months.includes(month)) months.unshift(month);
  const statusFilter = sp.status as PayrollStatus | undefined;
  const agentFilter = sp.agent;
  const paidFilter = sp.paid; // "paid" | "unpaid" | undefined

  const supabase = await createClient();
  const [runsRes, agentsRes, settingsRes, agencyRes] = await Promise.all([
    supabase.from("payroll_runs").select("*").eq("period_month", month),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "agent")
      .order("full_name"),
    supabase.from("payroll_settings").select("agent_id, is_active"),
    supabase.from("app_settings").select("base_currency").eq("id", 1).single(),
  ]);

  const monthRuns = (runsRes.data ?? []) as PayrollRun[];
  const agents = (agentsRes.data ?? []) as { id: string; full_name: string }[];
  const settings = (settingsRes.data ?? []) as {
    agent_id: string;
    is_active: boolean;
  }[];
  const baseCurrency = (agencyRes.data?.base_currency as string) || "USD";
  const nameOf = (id: string) =>
    agents.find((a) => a.id === id)?.full_name ?? "Unknown";
  const activeCount = settings.filter((s) => s.is_active).length;

  // Summary cards reflect the whole month (ignoring drill-down filters).
  const sum = (arr: PayrollRun[], f: (r: PayrollRun) => number) =>
    arr.reduce((s, r) => s + Number(f(r)), 0);
  const paidRuns = monthRuns.filter((r) => r.status === "paid");
  const unpaidRuns = monthRuns.filter((r) => r.status !== "paid");

  // Apply drill-down filters to the table.
  const filtered = monthRuns
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !agentFilter || r.agent_id === agentFilter)
    .filter((r) =>
      paidFilter === "paid"
        ? r.status === "paid"
        : paidFilter === "unpaid"
          ? r.status !== "paid"
          : true,
    );

  // Export-ready, flat row structure. A future CSV/Excel exporter just
  // serializes this array — no UI logic needs to change.
  const reportRows = filtered
    .map((r) => ({
      agent: nameOf(r.agent_id),
      month: monthLabel(r.period_month),
      base: r.base_salary,
      bonuses: r.total_bonuses,
      deductions: r.total_deductions,
      leave_deduction: r.leave_deduction,
      final: r.final_payable,
      currency: r.currency,
      status: r.status,
      paid_state: r.status === "paid" ? "Paid" : "Unpaid",
      last_generated: r.last_generated_at,
      net_kpi_points: r.net_kpi_points,
      productive_seconds: r.productive_seconds,
      unapproved_absence_days: r.unapproved_absence_days,
      late_count: r.late_count,
    }))
    .sort((a, b) => a.agent.localeCompare(b.agent));

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/payroll?month=${month}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to payroll
      </Link>

      <PageHeader
        title="Payroll Reports"
        description={`Compensation reporting for ${monthLabel(month)}.`}
      >
        {/* Export placeholders — architecture ready, wired in a later phase. */}
        <Button variant="outline" disabled title="Coming soon">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button variant="outline" disabled title="Coming soon">
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Total payroll cost"
          value={formatMoney(sum(monthRuns, (r) => r.final_payable), baseCurrency)}
          hint={`${monthRuns.length} run(s)`}
          icon={Wallet}
          accent="blue"
        />
        <StatCard
          label="Total bonuses"
          value={formatMoney(sum(monthRuns, (r) => r.total_bonuses), baseCurrency)}
          icon={Gift}
          accent="green"
        />
        <StatCard
          label="Total deductions"
          value={formatMoney(sum(monthRuns, (r) => r.total_deductions), baseCurrency)}
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          label="Total paid"
          value={formatMoney(sum(paidRuns, (r) => r.final_payable), baseCurrency)}
          hint={`${paidRuns.length} agent(s)`}
          icon={BadgeCheck}
          accent="violet"
        />
        <StatCard
          label="Total unpaid"
          value={formatMoney(sum(unpaidRuns, (r) => r.final_payable), baseCurrency)}
          hint={`${unpaidRuns.length} agent(s)`}
          icon={Hourglass}
          accent="amber"
        />
        <StatCard
          label="On payroll"
          value={activeCount}
          hint="active agents"
          icon={Users}
          accent="slate"
        />
      </div>

      {/* Filters */}
      <PayrollReportFilters
        month={month}
        months={months}
        status={statusFilter}
        agent={agentFilter}
        paid={paidFilter}
        agents={agents}
      />

      {/* Monthly payroll table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly payroll</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          {reportRows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payroll matches these filters"
              description="Generate payroll for this month, or adjust the filters above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Bonuses</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Leave ded.</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid state</TableHead>
                  <TableHead>Last generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.agent}</TableCell>
                    <TableCell className="text-sm">{r.month}</TableCell>
                    <TableCell className="text-sm">
                      {formatMoney(r.base, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-emerald-600">
                      +{formatMoney(r.bonuses, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-red-600">
                      −{formatMoney(r.deductions, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-red-600">
                      −{formatMoney(r.leave_deduction, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {formatMoney(r.final, r.currency)}
                    </TableCell>
                    <TableCell>
                      <PayrollStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          r.paid_state === "Paid"
                            ? "text-sm text-emerald-600"
                            : "text-sm text-muted-foreground"
                        }
                      >
                        {r.paid_state}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.last_generated
                        ? format(new Date(r.last_generated), "MMM d, HH:mm")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Agent-wise summary */}
      {reportRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Agent-wise summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Total payroll</TableHead>
                  <TableHead>Bonus received</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>KPI points</TableHead>
                  <TableHead>Productive hours</TableHead>
                  <TableHead>Attendance impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.agent}</TableCell>
                    <TableCell className="text-sm font-semibold">
                      {formatMoney(r.final, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-emerald-600">
                      +{formatMoney(r.bonuses, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-red-600">
                      −{formatMoney(r.deductions, r.currency)}
                    </TableCell>
                    <TableCell className="text-sm">{r.net_kpi_points}</TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(r.productive_seconds)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.unapproved_absence_days} abs · {r.late_count} late
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
