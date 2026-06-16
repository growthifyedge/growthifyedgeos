"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { reviewLeave } from "@/lib/actions/leave";
import { Button } from "@/components/ui/button";
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

export function LeaveReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const run = (status: "approved" | "rejected") => {
    setError(null);
    startTransition(async () => {
      const res = await reviewLeave(id, status, note);
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setOpen(false);
        setNote("");
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review leave request</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="admin-note">Note to agent (optional)</Label>
          <Textarea
            id="admin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a reason — shown to the agent, especially on rejection."
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => run("rejected")}
            disabled={pending}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
          <Button
            variant="success"
            onClick={() => run("approved")}
            disabled={pending}
          >
            <Check className="h-4 w-4" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
