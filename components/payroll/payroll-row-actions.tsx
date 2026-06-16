"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  RefreshCw,
  ClipboardCheck,
  CheckCircle2,
  BadgeDollarSign,
} from "lucide-react";
import { generatePayroll, setPayrollStatus } from "@/lib/payroll/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { PayrollStatus } from "@/types/payroll";

/**
 * Workflow actions for a payroll row. View + Generate always available (unless
 * finalized). Review/Approve/Mark-paid follow the strict draft → reviewed →
 * approved → paid path; Approve & Mark-paid ask for confirmation.
 */
export function PayrollRowActions({
  agentId,
  month,
  runId,
  status,
}: {
  agentId: string;
  month: string;
  runId: string | null;
  status: PayrollStatus | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const finalized = status === "approved" || status === "paid";

  const generate = () =>
    startTransition(async () => {
      const res = await generatePayroll(agentId, month);
      if (!res.ok) window.alert(res.error ?? "Failed to generate");
      else router.refresh();
    });

  const changeStatus = (
    to: "reviewed" | "approved" | "paid",
    confirmLabel?: string,
  ) => {
    if (!runId) return;
    if (confirmLabel && !window.confirm(`${confirmLabel}? This is audit-sensitive.`))
      return;
    startTransition(async () => {
      const res = await setPayrollStatus(runId, to);
      if (!res.ok) window.alert(res.error ?? "Failed");
      else router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Actions
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/admin/payroll/${agentId}?month=${month}`}>
            <Eye className="h-4 w-4" /> View payroll
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={finalized || pending}
          onSelect={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <RefreshCw className="h-4 w-4" /> {status ? "Regenerate" : "Generate"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status !== "draft" || pending}
          onSelect={(e) => {
            e.preventDefault();
            changeStatus("reviewed");
          }}
        >
          <ClipboardCheck className="h-4 w-4" /> Mark reviewed
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status !== "reviewed" || pending}
          onSelect={(e) => {
            e.preventDefault();
            changeStatus("approved", "Approve payroll");
          }}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status !== "approved" || pending}
          onSelect={(e) => {
            e.preventDefault();
            changeStatus("paid", "Mark as paid (locks payroll)");
          }}
        >
          <BadgeDollarSign className="h-4 w-4" /> Mark paid
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
