"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/payroll/period";
import {
  PAYROLL_STATUSES,
  PAYROLL_STATUS_LABELS,
} from "@/lib/payroll/constants";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filters = {
  month: string;
  status?: string;
  agent?: string;
  paid?: string;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function PayrollReportFilters({
  month,
  months,
  status,
  agent,
  paid,
  agents,
}: Filters & {
  months: string[];
  agents: { id: string; full_name: string }[];
}) {
  const router = useRouter();

  const push = (next: Partial<Filters>) => {
    const cur: Filters = { month, status, agent, paid, ...next };
    const params = new URLSearchParams();
    if (cur.month) params.set("month", cur.month);
    if (cur.status) params.set("status", cur.status);
    if (cur.agent) params.set("agent", cur.agent);
    if (cur.paid) params.set("paid", cur.paid);
    router.push(`/admin/payroll/reports?${params.toString()}`);
  };

  const opt = (v: string) => (v === "all" ? undefined : v);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="Month">
        <Select value={month} onValueChange={(v) => push({ month: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Status">
        <Select
          value={status ?? "all"}
          onValueChange={(v) => push({ status: opt(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PAYROLL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PAYROLL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Paid state">
        <Select value={paid ?? "all"} onValueChange={(v) => push({ paid: opt(v) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Agent">
        <Select
          value={agent ?? "all"}
          onValueChange={(v) => push({ agent: opt(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
