"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Coffee, LogOut, RotateCcw, AlertCircle } from "lucide-react";
import {
  startShift,
  startBreak,
  endBreak,
  endShift,
} from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stopwatch } from "@/components/app/stopwatch";
import type { AttendanceSession } from "@/lib/types";

export function AttendancePanel({
  session,
  openBreakStart,
}: {
  session: AttendanceSession | null;
  openBreakStart: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else router.refresh();
    });
  };

  const status = session?.status ?? null;
  const onBreak = status === "on_break";
  const active = status === "active";
  const ended = status === "ended";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Shift status</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={
                  "h-2.5 w-2.5 rounded-full " +
                  (active
                    ? "bg-emerald-500 animate-pulse-dot"
                    : onBreak
                      ? "bg-amber-500 animate-pulse-dot"
                      : "bg-slate-300")
                }
              />
              <p className="text-lg font-semibold">
                {active
                  ? "Working"
                  : onBreak
                    ? "On break"
                    : ended
                      ? "Shift ended"
                      : "Not clocked in"}
              </p>
              {session?.is_late ? (
                <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" /> Late {session.late_minutes}m
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Work time</p>
              <p className="font-mono text-xl font-semibold tabular-nums">
                <Stopwatch
                  baseSeconds={
                    session
                      ? Math.max(
                          0,
                          Math.floor(
                            (Date.now() - new Date(session.shift_start).getTime()) /
                              1000,
                          ) - session.break_seconds,
                        )
                      : 0
                  }
                  since={session?.shift_start ?? null}
                  running={active}
                />
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Break time</p>
              <p className="font-mono text-xl font-semibold tabular-nums text-amber-600">
                <Stopwatch
                  baseSeconds={session?.break_seconds ?? 0}
                  since={openBreakStart}
                  running={onBreak}
                />
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {!session || ended ? (
            <Button onClick={() => run(startShift)} disabled={pending || ended}>
              <Play className="h-4 w-4" /> Start shift
            </Button>
          ) : null}

          {active ? (
            <>
              <Button
                variant="outline"
                onClick={() => run(() => startBreak())}
                disabled={pending}
              >
                <Coffee className="h-4 w-4" /> Take a break
              </Button>
              <Button
                variant="destructive"
                onClick={() => run(endShift)}
                disabled={pending}
              >
                <LogOut className="h-4 w-4" /> End shift
              </Button>
            </>
          ) : null}

          {onBreak ? (
            <Button variant="success" onClick={() => run(endBreak)} disabled={pending}>
              <RotateCcw className="h-4 w-4" /> Resume work
            </Button>
          ) : null}
        </div>

        {!session ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Press <span className="font-medium text-foreground">Start shift</span> to
            begin your work day — your login time is recorded for attendance.
          </p>
        ) : active ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You&apos;re clocked in and working. Take a break or end your shift when
            you&apos;re done.
          </p>
        ) : onBreak ? (
          <p className="mt-3 text-sm text-amber-700">
            You&apos;re on a break — break time is being counted. Press{" "}
            <span className="font-medium">Resume work</span> to continue.
          </p>
        ) : null}

        {ended ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You have ended your shift for today. See you tomorrow!
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
