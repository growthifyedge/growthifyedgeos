"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { editAgent } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Profile, UserRole } from "@/lib/types";
import type { PayrollSettings } from "@/types/payroll";

export function EditAgentDialog({
  profile,
  settings,
}: {
  profile: Profile;
  settings: PayrollSettings | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    email: profile.email ?? "",
    role: profile.role as UserRole,
    is_active: profile.is_active ? "active" : "inactive",
    shift_start_time: profile.shift_start_time?.slice(0, 5) ?? "09:00",
    shift_end_time: profile.shift_end_time?.slice(0, 5) ?? "18:00",
    monthly_task_target: String(profile.monthly_task_target ?? 60),
    monthly_salary: String(settings?.monthly_salary ?? 0),
    working_days_per_month: String(settings?.working_days_per_month ?? 26),
  });
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    setError(null);
    setSuccess(null);
    if (!form.shift_start_time || !form.shift_end_time) {
      setError("Shift start and end time are required.");
      return;
    }
    startTransition(async () => {
      const res = await editAgent({
        id: profile.id,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        is_active: form.is_active === "active",
        shift_start_time: form.shift_start_time,
        shift_end_time: form.shift_end_time,
        monthly_task_target: Number(form.monthly_task_target) || 0,
        monthly_salary: Number(form.monthly_salary) || 0,
        working_days_per_month: Number(form.working_days_per_month) || 0,
      });
      if (!res.ok) setError(res.error ?? "Failed to save");
      else {
        setSuccess("Agent updated successfully.");
        router.refresh();
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setError(null);
          setSuccess(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit agent">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit agent</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit agent</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ea-name">Full name</Label>
            <Input
              id="ea-name"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ea-email">Email</Label>
            <Input
              id="ea-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role / permissions</Label>
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
              <Label>Status</Label>
              <Select
                value={form.is_active}
                onValueChange={(v) => set("is_active", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ea-start">Shift start *</Label>
              <Input
                id="ea-start"
                type="time"
                value={form.shift_start_time}
                onChange={(e) => set("shift_start_time", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ea-end">Shift end *</Label>
              <Input
                id="ea-end"
                type="time"
                value={form.shift_end_time}
                onChange={(e) => set("shift_end_time", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ea-target">Monthly task target</Label>
              <Input
                id="ea-target"
                type="number"
                min={0}
                value={form.monthly_task_target}
                onChange={(e) => set("monthly_task_target", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ea-days">Working days / month</Label>
              <Input
                id="ea-days"
                type="number"
                min={1}
                max={31}
                value={form.working_days_per_month}
                onChange={(e) => set("working_days_per_month", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ea-salary">
                Monthly salary {settings?.currency ? `(${settings.currency})` : ""}
              </Label>
              <Input
                id="ea-salary"
                type="number"
                min={0}
                step="0.01"
                value={form.monthly_salary}
                onChange={(e) => set("monthly_salary", e.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? (
            <p className="text-sm font-medium text-emerald-600">{success}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Close
          </Button>
          <Button onClick={submit} disabled={pending || !form.full_name.trim()}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
