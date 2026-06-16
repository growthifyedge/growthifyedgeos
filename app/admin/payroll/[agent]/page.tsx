import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PayrollBreakdown } from "@/components/payroll/payroll-breakdown";
import { PayrollWorkflowPanel } from "@/components/payroll/payroll-workflow-panel";
import { AdjustmentItems } from "@/components/payroll/adjustment-items";
import { EmptyState } from "@/components/app/empty-state";
import { Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/payroll/format";
import {
  toPeriodMonth,
  currentPeriodMonth,
  monthLabel,
} from "@/lib/payroll/period";
import type {
  PayrollRun,
  PayrollAdjustment,
  PayrollSettings,
} from "@/types/payroll";

export default async function AdminPayrollDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agent: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { agent } = await params;
  const sp = await searchParams;
  const month = sp.month ? toPeriodMonth(sp.month) : currentPeriodMonth();

  const supabase = await createClient();
  const [profileRes, runRes, adjRes, settingsRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", agent).maybeSingle(),
    supabase
      .from("payroll_runs")
      .select("*")
      .eq("agent_id", agent)
      .eq("period_month", month)
      .maybeSingle(),
    supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("agent_id", agent)
      .eq("period_month", month)
      .order("created_at", { ascending: false }),
    supabase
      .from("payroll_settings")
      .select("*")
      .eq("agent_id", agent)
      .maybeSingle(),
  ]);

  if (!profileRes.data) notFound();
  const agentName = (profileRes.data.full_name as string) || "Agent";
  const run = (runRes.data as PayrollRun | null) ?? null;
  const adjustments = (adjRes.data ?? []) as PayrollAdjustment[];
  const settings = (settingsRes.data as PayrollSettings | null) ?? null;
  const cur = run?.currency ?? settings?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/payroll?month=${month}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to payroll
      </Link>

      {run ? (
        <>
          <PayrollBreakdown run={run} agentName={agentName} />

          <PayrollWorkflowPanel run={run} />

          <Card>
            <CardHeader>
              <CardTitle>Adjustment line items</CardTitle>
            </CardHeader>
            <CardContent>
              <AdjustmentItems adjustments={adjustments} currency={cur} />
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Wallet}
          title={`Payroll not generated for ${monthLabel(month)}`}
          description={`${agentName}'s base salary is ${formatMoney(
            settings?.monthly_salary ?? 0,
            cur,
          )}. Generate payroll from the Payroll dashboard to see the full breakdown.`}
        />
      )}
    </div>
  );
}
