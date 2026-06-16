import {
  format,
  isPast,
  differenceInHours,
  formatDistanceToNowStrict,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

/**
 * Human-friendly deadline display with overdue / due-soon coloring.
 * Pure component (no hooks) — safe in server components.
 */
export function DeadlineLabel({
  deadline,
  status,
  className,
}: {
  deadline: string | null;
  status: TaskStatus;
  className?: string;
}) {
  if (!deadline) {
    return (
      <span className={cn("text-muted-foreground", className)}>No deadline</span>
    );
  }

  const d = new Date(deadline);
  const abs = format(d, "MMM d, HH:mm");
  const completed = status === "completed";
  const overdue = !completed && isPast(d);
  const soon = !completed && !overdue && differenceInHours(d, new Date()) <= 24;

  if (completed) {
    return (
      <span className={cn("text-muted-foreground", className)}>{abs}</span>
    );
  }
  if (overdue) {
    return (
      <span className={cn("font-medium text-red-600", className)}>
        {abs} · {formatDistanceToNowStrict(d)} overdue
      </span>
    );
  }
  if (soon) {
    return (
      <span className={cn("font-medium text-amber-600", className)}>
        {abs} · due in {formatDistanceToNowStrict(d)}
      </span>
    );
  }
  return (
    <span className={cn("text-foreground", className)}>
      {abs} · in {formatDistanceToNowStrict(d)}
    </span>
  );
}
