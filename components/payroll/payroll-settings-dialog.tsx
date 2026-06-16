"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { upsertPayrollSettings } from "@/lib/payroll/actions";
import { CURRENCIES } from "@/lib/payroll/constants";
import { formatMoney } from "@/lib/payroll/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PayrollSettings, SalaryType } from "@/types/payroll";

export function PayrollSettingsDialog({
  agentId,
  agentName,
  settings,
  defaultCurrency = "USD",
}: {
  agentId: string;
  agentName: string;
  settings: PayrollSettings | null;
  defaultCurrency?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    monthly_salary: settings ? String(settings.monthly_salary) : "0",
    currency: settings?.currency ?? defaultCurrency,
    salary_type: (settings?.salary_type ?? "monthly") as SalaryType,
    working_days_per_month: settings
      ? String(settings.working_days_per_month)
      : "26",
    joining_date: settings?.joining_date ?? "",
    is_active: settings?.is_active ?? true,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salary = Number(form.monthly_salary) || 0;
  const days = Number(form.working_days_per_month) || 0;
  const dailyRate = days > 0 ? salary / days : 0;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await upsertPayrollSettings({
        agent_id: agentId,
        monthly_salary: salary,
        currency: form.currency,
        salary_type: form.salary_type,
        working_days_per_month: days,
        joining_date: form.joining_date || null,
        is_active: form.is_active,
      });
      if (!res.ok) setError(res.error ?? "Failed to save");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wallet className="h-4 w-4" /> Payroll
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payroll settings — {agentName}</DialogTitle>
          <DialogDescription>
            Daily rate is calculated automatically from salary ÷ working days.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="salary">Monthly salary</Label>
              <Input
                id="salary"
                type="number"
                min={0}
                step="0.01"
                value={form.monthly_salary}
                onChange={(e) => set("monthly_salary", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => set("currency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Salary type</Label>
              <Select
                value={form.salary_type}
                onValueChange={(v) => set("salary_type", v as SalaryType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="days">Working days / month</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={31}
                value={form.working_days_per_month}
                onChange={(e) => set("working_days_per_month", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="joining">Joining date</Label>
              <Input
                id="joining"
                type="date"
                value={form.joining_date}
                onChange={(e) => set("joining_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payroll status</Label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.is_active}
                  onChange={(e) => set("is_active", e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">Calculated daily rate: </span>
            <span className="font-semibold">
              {formatMoney(dailyRate, form.currency)}
            </span>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving..." : "Save settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
