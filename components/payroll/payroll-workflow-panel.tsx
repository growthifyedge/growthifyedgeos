"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Lock, ShieldCheck } from "lucide-react";
import { setPayrollStatus, updatePayrollRun } from "@/lib/payroll/actions";
import {
  NEXT_PAYROLL_STATUS,
  NEXT_STATUS_ACTION_LABEL,
  transitionNeedsConfirm,
} from "@/lib/payroll/constants";
import { formatMoney } from "@/lib/payroll/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PayrollStatusBadge } from "@/components/payroll/payroll-status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PayrollRun, PayrollStatus } from "@/types/payroll";

export function PayrollWorkflowPanel({ run }: { run: PayrollRun }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [override, setOverride] = useState(
    run.override_amount != null ? String(run.override_amount) : "",
  );
  const [note, setNote] = useState(run.admin_note ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const locked = run.status === "paid";
  const next = NEXT_PAYROLL_STATUS[run.status];

  const saveEdits = () => {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await updatePayrollRun(
        run.id,
        override.trim() === "" ? null : Number(override),
        note,
      );
      if (!res.ok) setError(res.error ?? "Failed to save");
      else {
        setMsg("Saved");
        router.refresh();
      }
    });
  };

  const doTransition = (status: PayrollStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await setPayrollStatus(
        run.id,
        status as "reviewed" | "approved" | "paid",
      );
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setConfirmOpen(false);
        router.refresh();
      }
    });
  };

  const onAdvance = () => {
    if (!next) return;
    if (transitionNeedsConfirm(next)) setConfirmOpen(true);
    else doTransition(next);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payroll workflow</CardTitle>
        <PayrollStatusBadge status={run.status} />
      </CardHeader>
      <CardContent className="space-y-5">
        {run.last_generated_at ? (
          <p className="text-xs text-muted-foreground">
            Last refreshed{" "}
            {format(new Date(run.last_generated_at), "MMM d, yyyy HH:mm")}
          </p>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="override">
              Override final payable ({run.currency})
            </Label>
            <Input
              id="override"
              type="number"
              step="0.01"
              min={0}
              value={override}
              disabled={locked}
              onChange={(e) => setOverride(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the computed amount (
              {formatMoney(run.computed_payable, run.currency)}).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminnote">Admin note</Label>
            <Textarea
              id="adminnote"
              value={note}
              disabled={locked}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Visible to the agent on their payroll."
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveEdits} disabled={pending || locked}>
              Save override &amp; note
            </Button>
            {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium">
              Final payable: {formatMoney(run.final_payable, run.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              Status path: Draft → Reviewed → Approved → Paid
            </p>
          </div>
          {locked ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> Locked
            </span>
          ) : next ? (
            <Button
              variant={next === "reviewed" ? "default" : "success"}
              onClick={onAdvance}
              disabled={pending}
            >
              {NEXT_STATUS_ACTION_LABEL[run.status]}
            </Button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {next === "paid" ? "Confirm payment" : "Confirm approval"}
            </DialogTitle>
            <DialogDescription>
              {next === "paid"
                ? `Marking PAID locks this payroll permanently. Final payable is ${formatMoney(run.final_payable, run.currency)}.`
                : `Approving locks the figures from further regeneration. Final payable is ${formatMoney(run.final_payable, run.currency)}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => next && doTransition(next)}
              disabled={pending}
            >
              {next === "paid" ? "Confirm paid" : "Confirm approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
