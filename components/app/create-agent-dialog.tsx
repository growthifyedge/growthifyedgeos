"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createAgent } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { UserRole } from "@/lib/types";

export function CreateAgentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "agent" as UserRole,
    shift_start_time: "09:00",
    shift_end_time: "18:00",
    monthly_task_target: "60",
  });
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAgent({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        shift_start_time: form.shift_start_time,
        shift_end_time: form.shift_end_time,
        monthly_task_target: Number(form.monthly_task_target),
      });
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" /> Add agent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>
            Creates a login. Share the email &amp; password with the agent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd">Temporary password</Label>
            <Input
              id="pwd"
              type="text"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target">Monthly target</Label>
              <Input
                id="target"
                type="number"
                value={form.monthly_task_target}
                onChange={(e) => set("monthly_task_target", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ss">Shift start</Label>
              <Input
                id="ss"
                type="time"
                value={form.shift_start_time}
                onChange={(e) => set("shift_start_time", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se">Shift end</Label>
              <Input
                id="se"
                type="time"
                value={form.shift_end_time}
                onChange={(e) => set("shift_end_time", e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
