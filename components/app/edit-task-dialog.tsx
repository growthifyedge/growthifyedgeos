"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateTask } from "@/lib/actions/tasks";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  STATUS_LABELS,
} from "@/lib/constants";
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
import type {
  Client,
  Platform,
  TaskType,
  Profile,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

type LookupItem = { id: string; name?: string; full_name?: string };

// Module-scope so the field doesn't remount (and lose focus) on each keystroke.
function LookupSelect({
  label,
  value,
  onChange,
  items,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: LookupItem[];
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((it) => (
            <SelectItem key={it.id} value={it.id}>
              {it.name ?? it.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Convert an ISO timestamp to a value the datetime-local input accepts. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function EditTaskDialog({
  task,
  clients,
  platforms,
  taskTypes,
  agents,
}: {
  task: Task;
  clients: Client[];
  platforms: Platform[];
  taskTypes: TaskType[];
  agents: Profile[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: task.title,
    instructions: task.instructions ?? "",
    client_id: task.client_id ?? "",
    platform_id: task.platform_id ?? "",
    task_type_id: task.task_type_id ?? "",
    assigned_to: task.assigned_to ?? "",
    priority: task.priority as TaskPriority,
    status: task.status as TaskStatus,
    deadline: toDatetimeLocal(task.deadline),
    expected_minutes: task.expected_minutes ? String(task.expected_minutes) : "",
    attachment_url: "",
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateTask({
        id: task.id,
        title: form.title,
        instructions: form.instructions || undefined,
        client_id: form.client_id || undefined,
        platform_id: form.platform_id || undefined,
        task_type_id: form.task_type_id || undefined,
        assigned_to: form.assigned_to || undefined,
        priority: form.priority,
        status: form.status,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        expected_minutes: form.expected_minutes
          ? Number(form.expected_minutes)
          : null,
        attachment_url: form.attachment_url || undefined,
      });
      if (!res.ok) setError(res.error ?? "Failed to save changes");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="h-4 w-4" /> Edit task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update any field below. Changing the assignee moves the task to that
            agent. To set a quality score on completion, use “Approve &amp;
            complete” instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LookupSelect
              label="Client"
              value={form.client_id}
              onChange={(v) => set("client_id", v)}
              items={clients}
              placeholder="Select client"
            />
            <LookupSelect
              label="Platform"
              value={form.platform_id}
              onChange={(v) => set("platform_id", v)}
              items={platforms}
              placeholder="Select platform"
            />
            <LookupSelect
              label="Task type"
              value={form.task_type_id}
              onChange={(v) => set("task_type_id", v)}
              items={taskTypes}
              placeholder="Select type"
            />
            <LookupSelect
              label="Assign to"
              value={form.assigned_to}
              onChange={(v) => set("assigned_to", v)}
              items={agents}
              placeholder="Select agent"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-deadline">Deadline</Label>
              <Input
                id="edit-deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-mins">Expected mins</Label>
              <Input
                id="edit-mins"
                type="number"
                min={0}
                value={form.expected_minutes}
                onChange={(e) => set("expected_minutes", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-attach">Add a reference link (optional)</Label>
            <Input
              id="edit-attach"
              value={form.attachment_url}
              onChange={(e) => set("attachment_url", e.target.value)}
              placeholder="https://... (appended to attachments)"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-instructions">Instructions</Label>
            <Textarea
              id="edit-instructions"
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !form.title.trim()}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
