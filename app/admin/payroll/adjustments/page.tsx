import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, Gift, TrendingDown, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { MonthSelector } from "@/components/payroll/month-selector";
import { AdjustmentDialog } from "@/components/payroll/adjustment-dialog";
import { DeleteAdjustmentButton } from "@/components/payroll/delete-adjustment-button";
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
import { categoryLabel } from "@/lib/payroll/constants";
import {
  toPeriodMonth,
  currentPeriodMonth,
  recentPeriodMonths,
  monthLabel,
} from "@/lib/payroll/period";
import type { PayrollAdjustment, PayrollSettings } from "@/types/payroll";

export default async function PayrollAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ? toPeriodMonth(sp.month) : currentPeriodMonth();
  const months = recentPeriodMonths(12);
  if (!months.includes(month)) months.unshift(month);

  const supabase = await createClient();
  const [agentsRes, adjRes, settingsRes, agencyRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "agent")
      .order("full_name"),
    supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("period_month", month)
      .order("created_at", { ascending: false }),
    supabase.from("payroll_settings").select("agent_id, currency"),
    supabase.from("app_settings").select("base_currency").eq("id", 1).single(),
  ]);

  const agents = (agentsRes.data ?? []) as { id: string; full_name: string }[];
  const adjustments = (adjRes.data ?? []) as PayrollAdjustment[];
  const settings = (settingsRes.data ?? []) as Pick<
    PayrollSettings,
    "agent_id" | "currency"
  >[];
  const baseCurrency = (agencyRes.data?.base_currency as string) || "USD";

  const nameOf = (id: string) =>
    agents.find((a) => a.id === id)?.full_name ?? "Unknown";
  const currencyOf = (id: string) =>
    settings.find((s) => s.agent_id === id)?.currency ?? baseCurrency;

  const totalBonus = adjustments
    .filter((a) => a.kind === "bonus")
    .reduce((s, a) => s + Number(a.amount), 0);
  const totalDeduction = adjustments
    .filter((a) => a.kind === "deduction")
    .reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/payroll"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to payroll
      </Link>

      <PageHeader
        title="Bonuses & Deductions"
        description={`Adjustments for ${monthLabel(month)}. These feed the monthly payroll run.`}
      >
        <MonthSelector
          month={month}
          months={months}
          basePath="/admin/payroll/adjustments"
        />
        <AdjustmentDialog agents={agents} months={months} defaultMonth={month} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total bonuses"
          value={formatMoney(totalBonus, baseCurrency)}
          icon={Gift}
          accent="green"
        />
        <StatCard
          label="Total deductions"
          value={formatMoney(totalDeduction, baseCurrency)}
          icon={TrendingDown}
          accent="red"
        />
        <StatCard
          label="Net adjustment"
          value={formatMoney(totalBonus - totalDeduction, baseCurrency)}
          icon={Scale}
          accent="blue"
        />
      </div>

      <Card>
        <CardContent className="p-0 sm:p-2">
          {adjustments.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No adjustments this month"
              description="Add a bonus or deduction — it will be included when you generate payroll."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((a) => {
                  const isBonus = a.kind === "bonus";
                  const cur = currencyOf(a.agent_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {nameOf(a.agent_id)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                            isBonus
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700",
                          )}
                        >
                          {isBonus ? "Bonus" : "Deduction"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {categoryLabel(a.category)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-sm font-medium",
                          isBonus ? "text-emerald-600" : "text-red-600",
                        )}
                      >
                        {isBonus ? "+" : "−"}
                        {formatMoney(a.amount, cur)}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                        {a.reason || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(a.created_at), "MMM d")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <AdjustmentDialog
                            agents={agents}
                            months={months}
                            defaultMonth={month}
                            adjustment={a}
                          />
                          <DeleteAdjustmentButton id={a.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
