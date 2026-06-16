import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { PayrollBreakdown } from "@/components/payroll/payroll-breakdown";
import { AdjustmentItems } from "@/components/payroll/adjustment-items";
import { MonthSelector } from "@/components/payroll/month-selector";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  toPeriodMonth,
  currentPeriodMonth,
  recentPeriodMonths,
  monthLabel,
} from "@/lib/payroll/period";
import type {
  PayrollRun,
  PayrollAdjustment,
  PayrollSettings,
} from "@/types/payroll";

export default async function AgentPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const month = sp.month ? toPeriodMonth(sp.month) : currentPeriodMonth();
  const months = recentPeriodMonths(12);
  if (!months.includes(month)) months.unshift(month);

  const supabase = await createClient();
  // RLS restricts every one of these to the agent's own rows.
  const [runRes, adjRes, settingsRes] = await Promise.all([
    supabase
      .from("payroll_runs")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("period_month", month)
      .maybeSingle(),
    supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("period_month", month)
      .order("created_at", { ascending: false }),
    supabase
      .from("payroll_settings")
      .select("*")
      .eq("agent_id", profile.id)
      .maybeSingle(),
  ]);

  const run = (runRes.data as PayrollRun | null) ?? null;
  const adjustments = (adjRes.data ?? []) as PayrollAdjustment[];
  const settings = (settingsRes.data as PayrollSettings | null) ?? null;
  const cur = run?.currency ?? settings?.currency ?? "USD";

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Payroll"
        description={`Your compensation summary for ${monthLabel(month)}.`}
      >
        <MonthSelector
          month={month}
          months={months}
          basePath="/agent/payroll"
        />
      </PageHeader>

      {run ? (
        <>
          <PayrollBreakdown
            run={run}
            agentName={profile.full_name || "You"}
          />

          <Card>
            <CardHeader>
              <CardTitle>Bonus &amp; deduction details</CardTitle>
            </CardHeader>
            <CardContent>
              <AdjustmentItems adjustments={adjustments} currency={cur} />
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Wallet}
          title={`Payroll not available for ${monthLabel(month)}`}
          description="Your payroll for this month hasn't been generated yet. Check back after your manager runs payroll."
        />
      )}
    </div>
  );
}
