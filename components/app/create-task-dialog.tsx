"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import type { Client, Platform, TaskType, Profile, TaskPriority } from "@/lib/types";

type Lite = { id: string; name?: string; full_name?: string };

export function CreateTaskDialog({
  clients,
  platforms,
  taskTypes,
  agents,
}: {
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
    title: "",
    instructions: "",
    client_id: "",
    platform_id: "",
    task_type_id: "",
    assigned_to: "",
    priority: "medium" as TaskPriority,
    deadline: "",
    expected_minutes: "",
    attachment_url: "",
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createTask({
        title: form.title,
        instructions: form.instructions || undefined,
        client_id: form.client_id || undefined,
        platform_id: form.platform_id || undefined,
        task_type_id: form.task_type_id || undefined,
        assigned_to: form.assigned_to || undefined,
        priority: form.priority,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        expected_minutes: form.expected_minutes
          ? Number(form.expected_minutes)
          : undefined,
        attachment_url: form.attachment_url || undefined,
      });
      if (!res.ok) setError(res.error ?? "Failed to create task");
      else {
        setOpen(false);
        setForm({
          title: "",
          instructions: "",
          client_id: "",
          platform_id: "",
          task_type_id: "",
          assigned_to: "",
          priority: "medium",
          deadline: "",
          expected_minutes: "",
          attachment_url: "",
        });
        router.refresh();
      }
    });
  };

  const SelectField = ({
    label,
    value,
    onChange,
    items,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    items: Lite[];
    placeholder: string;
  }) => (
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Edit 30s reel for product launch"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Client"
              value={form.client_id}
              onChange={(v) => set("client_id", v)}
              items={clients}
              placeholder="Select client"
            />
            <SelectField
              label="Platform"
              value={form.platform_id}
              onChange={(v) => set("platform_id", v)}
              items={platforms}
              placeholder="Select platform"
            />
            <SelectField
              label="Task type"
              value={form.task_type_id}
              onChange={(v) => set("task_type_id", v)}
              items={taskTypes}
              placeholder="Select type"
            />
            <SelectField
              label="Assign to"
              value={form.assigned_to}
              onChange={(v) => set("assigned_to", v)}
              items={agents}
              placeholder="Select agent"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => set("priority", v)}
              >
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
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mins">Expected mins</Label>
              <Input
                id="mins"
                type="number"
                min={0}
                value={form.expected_minutes}
                onChange={(e) => set("expected_minutes", e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attach">Brief / reference link</Label>
            <Input
              id="attach"
              value={form.attachment_url}
              onChange={(e) => set("attachment_url", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="Detailed brief, do's and don'ts, brand notes..."
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || !form.title.trim()}>
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
