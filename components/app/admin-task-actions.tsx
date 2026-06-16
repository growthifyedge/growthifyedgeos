"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { requestRevision, completeTask } from "@/lib/actions/tasks";
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
import type { Task } from "@/lib/types";

export function AdminTaskActions({ task }: { task: Task }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revOpen, setRevOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [note, setNote] = useState("");
  const [quality, setQuality] = useState("8");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else {
        after?.();
        router.refresh();
      }
    });
  };

  if (task.status === "completed") {
    return (
      <p className="text-sm text-emerald-600">
        Completed{task.quality_score != null ? ` · Quality ${task.quality_score}/10` : ""}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Request revision */}
      <Dialog open={revOpen} onOpenChange={setRevOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            <RotateCcw className="h-4 w-4" /> Request revision
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a revision</DialogTitle>
            <DialogDescription>
              Tell the agent what needs to change. This increments the revision count.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Feedback for the agent..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={() =>
                run(() => requestRevision(task.id, note), () => setRevOpen(false))
              }
              disabled={pending}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve & complete */}
      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogTrigger asChild>
          <Button variant="success" disabled={pending}>
            <CheckCircle2 className="h-4 w-4" /> Approve & complete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve &amp; complete</DialogTitle>
            <DialogDescription>
              Set a quality score (0–10). A late completion auto-applies the
              missed-deadline penalty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="quality">Quality score</Label>
            <Input
              id="quality"
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                run(
                  () => completeTask(task.id, Number(quality)),
                  () => setDoneOpen(false),
                )
              }
              disabled={pending}
            >
              Mark completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
