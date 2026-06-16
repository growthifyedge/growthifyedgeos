import { cn } from "@/lib/utils";
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_STYLES } from "@/lib/constants";
import type { LeaveStatus } from "@/lib/types";

export function LeaveStatusBadge({
  status,
  className,
}: {
  status: LeaveStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        LEAVE_STATUS_STYLES[status],
        className,
      )}
    >
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}
