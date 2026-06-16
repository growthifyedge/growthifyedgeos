"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/utils";

/**
 * Live ticking clock. Shows baseSeconds plus the time elapsed since `since`
 * while `running` is true.
 */
export function Stopwatch({
  baseSeconds = 0,
  since = null,
  running = false,
  className,
}: {
  baseSeconds?: number;
  since?: string | null;
  running?: boolean;
  className?: string;
}) {
  const compute = () => {
    let total = baseSeconds;
    if (running && since) {
      total += Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
    }
    return total;
  };

  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    setSeconds(compute());
    if (!running) return;
    const id = setInterval(() => setSeconds(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSeconds, since, running]);

  return <span className={className}>{formatClock(seconds)}</span>;
}
