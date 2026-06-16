import Link from "next/link";
import { Wallet, Gift, TrendingDown, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { MonthSelector } from "@/components/payroll/month-selector";
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge";
import { PayrollRowActions } from "@/components/payroll/payroll-row-actions";
import { GeneratePayrollButton } from "@/components/payroll/generate-payroll-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/payroll/format";
import {
  toPeriodMonth,
  currentPeriodMonth,
  recentPeriodMonths,
  monthLabel,
} from "@/lib/payroll/period";
import { PAYROLL_STATUSES, PAYROLL_STATUS_LABELS } from "@/lib/payroll/constants";
import type { PayrollSettings, PayrollRun, PayrollStatus } from "@/types/payroll";

export default async function AdminPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ? toPeriodMonth(sp.month) : currentPeriodMonth();
  const months = recentPeriodMonths(12);
  if (!months.includes(month)) months.unshift(month);
  const statusFilter = sp.status as PayrollStatus | undefined;

  const supabase = await createClient();
  const [settingsRes, agentsRes, runsRes, agencyRes] = await Promise.all([
    supabase.from("payroll_settings").select("*"),
    supabase.from("profiles").select("id, full_name").eq("role", "agent"),
    supabase.from("payroll_runs").select("*").eq("period_month", month),
    supabase.from("app_settings").select("base_currency").eq("id", 1).single(),
  ]);

  const settings = (settingsRes.data ?? []) as PayrollSettings[];
  const agents = (agentsRes.data ?? []) as { id: string; full_name: string }[];
  const runs = (runsRes.data ?? []) as PayrollRun[];
  const baseCurrency = (agencyRes.data?.base_currency as string) || "USD";
  const nameOf = (id: string) =>
    agents.find((a) => a.id === id)?.full_name ?? "Unknown";
  const runMap = new Map(runs.map((r) => [r.agent_id, r]));

  const activeSettings = settings.filter((s) => s.is_active);
  let rows = activeSettings
    .map((s) => {
      const run = runMap.get(s.agent_id) ?? null;
      return {
        agentId: s.agent_id,
        runId: run?.id ?? null,
        name: nameOf(s.agent_id),
        currency: run?.currency ?? s.currency,
        base: run ? run.base_salary : s.monthly_salary,
        bonuses: run?.total_bonuses ?? null,
        deductions: run?.total_deductions ?? null,
        final: run?.final_payable ?? null,
        status: (run?.status ?? null) as PayrollStatus | null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);

  const totalCost = runs.reduce((a, r) => a + Number(r.final_payable), 0);
  const totalBonus = runs.reduce((a, r) => a + Number(r.total_bonuses), 0);
  const totalDeductions = runs.reduce((a, r) => a + Number(r.total_deductions), 0);

  const buildHref = (status?: string) => {
    const params = new URLSearchParams();
    params.set("month", month);
    if (status) params.set("status", status);
    return `/admin/payroll?${params.toString()}`;
  };

  const statusChips: { label: string; value?: PayrollStatus }[] = [
    { label: "All" },
    ...PAYROLL_STATUSES.map((s) => ({ label: PAYROLL_STATUS_LABELS[s], value: s })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description={`Monthly compensation overview — ${monthLabel(month)}.`}
      >
        <Button asChild variant="outline">
          <Link href={`/admin/payroll/adjustments?month=${month}`}>
            Bonuses &amp; deductions
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/payroll/reports?month=${month}`}>Reports</Link>
        </Button>
        <MonthSelector month={month} months={months} status={statusFilter} />
        <GeneratePayrollButton month={month} label={monthLabel(month)} />
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total payroll cost"
          value={formatMoney(totalCost, baseCurrency)}
          hint={`${runs.length}/${activeSettings.length} generated`}
          icon={Wallet}
          accent="blue"
        />
        <StatCard
          label="Total bonuses"
          value={formatMoney(totalBonus, baseCurrency)}
          icon={Gift}
          accent="green"
        />
        <StatCard
          label="Total deductions"
          value={formatMoney(totalDeductions, baseCurrency)}
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          label="On payroll"
          value={activeSettings.length}
          hint="active agents"
          icon={FileText}
          accent="violet"
        />
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {statusChips.map((c) => {
          const active = (c.value ?? undefined) === statusFilter;
          return (
            <Link
              key={c.label}
              href={buildHref(c.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent",
              )}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Payroll table */}
      <Card>
        <CardContent className="p-0 sm:p-2">
          {rows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payroll rows"
              description="Set up agent payroll under Agents, then generate the monthly run."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Base salary</TableHead>
                    <TableHead>Bonuses</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Final payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.agentId}
                      className={cn(!r.status && "bg-muted/30")}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/payroll/${r.agentId}?month=${month}`}
                          className="hover:underline"
                        >
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatMoney(r.base, r.currency)}
                      </TableCell>
                      <TableCell className="text-sm text-emerald-600">
                        {r.bonuses != null
                          ? `+${formatMoney(r.bonuses, r.currency)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-red-600">
                        {r.deductions != null
                          ? `-${formatMoney(r.deductions, r.currency)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {r.final != null ? formatMoney(r.final, r.currency) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.status ? (
                          <PayrollStatusBadge status={r.status} />
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs text-muted-foreground">
                            Not generated
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PayrollRowActions
                          agentId={r.agentId}
                          month={month}
                          runId={r.runId}
                          status={r.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Pagination-ready footer (counts only for now). */}
              <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Showing {rows.length} agent{rows.length === 1 ? "" : "s"}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
