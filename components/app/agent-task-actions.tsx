"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Send } from "lucide-react";
import { startTask, pauseTask, submitTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stopwatch } from "@/components/app/stopwatch";
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

export function AgentTaskActions({
  task,
  runningSince,
}: {
  task: Task;
  runningSince: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(task.deliverable_url ?? "");
  const [note, setNote] = useState("");

  const running = task.status === "in_progress";
  const done = task.status === "completed";

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Time on task</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            <Stopwatch
              baseSeconds={task.active_seconds}
              since={runningSince}
              running={running}
            />
          </p>
        </div>
        <div className="flex gap-2">
          {!done &&
            (running ? (
              <Button
                variant="outline"
                onClick={() => run(() => pauseTask(task.id))}
                disabled={pending}
              >
                <Pause className="h-4 w-4" /> Pause
              </Button>
            ) : (
              <Button onClick={() => run(() => startTask(task.id))} disabled={pending}>
                <Play className="h-4 w-4" />{" "}
                {task.status === "paused" || task.status === "revision"
                  ? "Resume"
                  : "Start"}
              </Button>
            ))}

          {!done ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="success" disabled={pending}>
                  <Send className="h-4 w-4" /> Submit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit for review</DialogTitle>
                  <DialogDescription>
                    Add the deliverable link and any handover notes for the admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="link">Deliverable link</Label>
                    <Input
                      id="link"
                      placeholder="https://drive.google.com/..."
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="note">Notes (optional)</Label>
                    <Textarea
                      id="note"
                      placeholder="What you delivered, anything to flag..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      run(() => submitTask(task.id, link, note), () => setOpen(false))
                    }
                    disabled={pending}
                  >
                    Submit task
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
