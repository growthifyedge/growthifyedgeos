import Link from "next/link";
import { Inbox } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/app/badges";
import { DeadlineLabel } from "@/components/app/deadline";
import { EmptyState } from "@/components/app/empty-state";
import type { TaskFeedRow } from "@/lib/types";

export function TaskList({
  tasks,
  basePath,
  showAssignee = true,
  emptyTitle = "No tasks here yet",
  emptyDescription = "Tasks you create or get assigned will appear here.",
}: {
  tasks: TaskFeedRow[];
  basePath: string; // "/admin/tasks" or "/agent/tasks"
  showAssignee?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Platform</TableHead>
          {showAssignee ? <TableHead>Assignee</TableHead> : null}
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Deadline</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => (
          <TableRow key={t.id}>
            <TableCell>
              <Link
                href={`${basePath}/${t.id}`}
                className="font-medium hover:underline"
              >
                {t.title}
              </Link>
              {t.task_type_name ? (
                <p className="text-xs text-muted-foreground">{t.task_type_name}</p>
              ) : null}
            </TableCell>
            <TableCell className="text-sm">{t.client_name ?? "—"}</TableCell>
            <TableCell className="text-sm">{t.platform_name ?? "—"}</TableCell>
            {showAssignee ? (
              <TableCell className="text-sm">
                {t.assignee_name ?? "Unassigned"}
              </TableCell>
            ) : null}
            <TableCell>
              <PriorityBadge priority={t.priority} />
            </TableCell>
            <TableCell>
              <StatusBadge status={t.status} />
            </TableCell>
            <TableCell className="text-sm">
              <DeadlineLabel deadline={t.deadline} status={t.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
