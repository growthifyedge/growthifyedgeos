"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { runIncentives } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function RunIncentivesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await runIncentives();
            setMsg(res.ok ? "Recalculated." : (res.error ?? "Failed"));
            if (res.ok) router.refresh();
          })
        }
      >
        <RefreshCw className={"h-4 w-4 " + (pending ? "animate-spin" : "")} />
        Recalculate this month
      </Button>
      {msg ? <span className="text-sm text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
