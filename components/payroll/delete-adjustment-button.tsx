"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAdjustment } from "@/lib/payroll/actions";
import { Button } from "@/components/ui/button";

export function DeleteAdjustmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-red-600 hover:text-red-700"
      disabled={pending}
      title={error ?? "Delete adjustment"}
      onClick={() => {
        if (!window.confirm("Delete this adjustment? This can't be undone.")) return;
        startTransition(async () => {
          const res = await deleteAdjustment(id);
          if (!res.ok) setError(res.error ?? "Failed");
          else router.refresh();
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">Delete adjustment</span>
    </Button>
  );
}
