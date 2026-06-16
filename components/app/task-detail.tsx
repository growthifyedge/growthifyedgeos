import { format } from "date-fns";
import { ExternalLink, Paperclip, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, PriorityBadge } from "@/components/app/badges";
import { DeadlineLabel } from "@/components/app/deadline";
import { NotesForm } from "@/components/app/notes-form";
import { formatDuration } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import type {
  TaskFeedRow,
  TaskNote,
  TaskAttachment,
  TaskStatus,
} from "@/lib/types";

type NoteWithAuthor = TaskNote & { author?: { full_name: string } | null };
type HistoryRow = {
  id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  created_at: string;
};

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function TaskDetail({
  task,
  notes,
  attachments,
  history,
  children,
}: {
  task: TaskFeedRow;
  notes: NoteWithAuthor[];
  attachments: TaskAttachment[];
  history: HistoryRow[];
  children?: React.ReactNode; // role-specific action panel
}) {
  const latestRevision = notes.find((n) => n.body.startsWith("[Revision]"));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {task.status === "revision" ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Revision requested · attempt #{task.revision_count}
              </p>
              <p className="text-sm text-amber-700">
                {latestRevision
                  ? latestRevision.body.replace(/^\[Revision\]\s*/, "")
                  : "Please review the feedback below and resubmit."}
              </p>
            </div>
          </div>
        ) : null}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.is_overdue ? (
                <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                  Overdue
                </span>
              ) : null}
            </div>
            <CardTitle className="mt-2 text-xl">{task.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Meta label="Client" value={task.client_name ?? "—"} />
              <Meta label="Platform" value={task.platform_name ?? "—"} />
              <Meta label="Task type" value={task.task_type_name ?? "—"} />
              <Meta label="Assignee" value={task.assignee_name ?? "Unassigned"} />
              <Meta
                label="Deadline"
                value={
                  <DeadlineLabel deadline={task.deadline} status={task.status} />
                }
              />
              <Meta
                label="Expected"
                value={task.expected_minutes ? `${task.expected_minutes} min` : "—"}
              />
              <Meta label="Time logged" value={formatDuration(task.active_seconds)} />
              <Meta label="Revisions" value={task.revision_count} />
              <Meta
                label="Quality"
                value={task.quality_score != null ? `${task.quality_score}/10` : "—"}
              />
            </div>

            {task.instructions ? (
              <>
                <Separator />
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Instructions</p>
                  <p className="whitespace-pre-wrap text-sm">{task.instructions}</p>
                </div>
              </>
            ) : null}

            {task.deliverable_url ? (
              <>
                <Separator />
                <a
                  href={task.deliverable_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> View submitted deliverable
                </a>
              </>
            ) : null}

            {attachments.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Attachments</p>
                  {attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      {a.file_name || a.url}
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {children ? (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
        ) : null}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes &amp; activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NotesForm taskId={task.id} />
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {n.author?.full_name ?? "Someone"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(n.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {h.from_status
                        ? `${STATUS_LABELS[h.from_status]} → ${STATUS_LABELS[h.to_status]}`
                        : `Created (${STATUS_LABELS[h.to_status]})`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                </li>
              ))}
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : null}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
