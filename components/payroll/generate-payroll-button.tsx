"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { generatePayrollAll } from "@/lib/payroll/actions";
import { Button } from "@/components/ui/button";

export function GeneratePayrollButton({
  month,
  label,
}: {
  month: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Generate payroll for all active agents for ${label}? Draft/reviewed runs are refreshed; approved or paid runs are skipped.`,
            )
          )
            return;
          startTransition(async () => {
            setMsg(null);
            const res = await generatePayrollAll(month);
            if (!res.ok) setMsg(res.error ?? "Failed");
            else {
              setMsg(
                res.count != null ? `Generated ${res.count} run(s)` : "Done",
              );
              router.refresh();
            }
          });
        }}
      >
        <Sparkles className="h-4 w-4" />
        {pending ? "Generating..." : "Generate payroll"}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
