import { cn } from "@/lib/utils";
import {
  PAYROLL_STATUS_LABELS,
  PAYROLL_STATUS_STYLES,
} from "@/lib/payroll/constants";
import type { PayrollStatus } from "@/types/payroll";

export function PayrollStatusBadge({
  status,
  className,
}: {
  status: PayrollStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        PAYROLL_STATUS_STYLES[status],
        className,
      )}
    >
      {PAYROLL_STATUS_LABELS[status]}
    </span>
  );
}
