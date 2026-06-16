"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { requestLeave } from "@/lib/actions/leave";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/lib/constants";
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
import type { LeaveType } from "@/lib/types";

export function RequestLeaveDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leave_type: "casual" as LeaveType,
    start_date: "",
    end_date: "",
    is_half_day: false,
    reason: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Half-day (toggle or the "Half Day" type) collapses to a single day.
  const halfDay = form.is_half_day || form.leave_type === "half_day";

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestLeave({
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: halfDay ? form.start_date : form.end_date,
        is_half_day: halfDay,
        reason: form.reason || undefined,
      });
      if (!res.ok) setError(res.error ?? "Failed to submit request");
      else {
        setOpen(false);
        setForm({
          leave_type: "casual",
          start_date: "",
          end_date: "",
          is_half_day: false,
          reason: "",
        });
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="h-4 w-4" /> Request leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>
            Your manager will review and approve or reject this request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leave type</Label>
            <Select
              value={form.leave_type}
              onValueChange={(v) => set("leave_type", v as LeaveType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LEAVE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.is_half_day}
              onChange={(e) => set("is_half_day", e.target.checked)}
            />
            Half day (single day, half attendance expected)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End date</Label>
              <Input
                id="end"
                type="date"
                value={halfDay ? form.start_date : form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                disabled={halfDay}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason / note</Label>
            <Textarea
              id="reason"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="Optional context for your manager..."
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !form.start_date}>
            {pending ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
