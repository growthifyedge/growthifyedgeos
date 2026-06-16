"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { addAdjustment, updateAdjustment } from "@/lib/payroll/actions";
import {
  BONUS_CATEGORIES,
  categoriesForKind,
  categoryLabel,
} from "@/lib/payroll/constants";
import { monthLabel, toPeriodMonth } from "@/lib/payroll/period";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { AdjustmentKind, PayrollAdjustment } from "@/types/payroll";

export function AdjustmentDialog({
  agents,
  months,
  defaultMonth,
  adjustment,
}: {
  agents: { id: string; full_name: string }[];
  months: string[];
  defaultMonth: string;
  adjustment?: PayrollAdjustment;
}) {
  const router = useRouter();
  const editing = !!adjustment;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<AdjustmentKind>(adjustment?.kind ?? "bonus");
  const [category, setCategory] = useState(
    adjustment?.category ?? BONUS_CATEGORIES[0],
  );
  const [agentId, setAgentId] = useState(adjustment?.agent_id ?? "");
  const [month, setMonth] = useState(
    adjustment ? toPeriodMonth(adjustment.period_month) : defaultMonth,
  );
  const [amount, setAmount] = useState(
    adjustment ? String(adjustment.amount) : "",
  );
  const [reason, setReason] = useState(adjustment?.reason ?? "");

  const onKindChange = (k: AdjustmentKind) => {
    setKind(k);
    setCategory(categoriesForKind(k)[0]);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const payload = {
        agent_id: agentId,
        period_month: month,
        kind,
        category,
        amount: Number(amount),
        reason: reason || undefined,
      };
      const res = editing
        ? await updateAdjustment(adjustment.id, payload)
        : await addAdjustment(payload);
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
        {editing ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit adjustment</span>
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" /> Add adjustment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit adjustment" : "Add adjustment"}</DialogTitle>
          <DialogDescription>
            Bonuses add to, and deductions subtract from, the agent&apos;s monthly pay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => onKindChange(v as AdjustmentKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bonus (+)</SelectItem>
                  <SelectItem value="deduction">Deduction (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriesForKind(kind).map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
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
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">Amount</Label>
            <Input
              id="adj-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Context for this adjustment..."
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !agentId || !amount}>
            {pending ? "Saving..." : editing ? "Save changes" : "Add adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
