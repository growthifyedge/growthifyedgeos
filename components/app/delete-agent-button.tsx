"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAgent } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteAgentButton({
  id,
  name,
  disabled,
  disabledReason,
}: {
  id: string;
  name: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        disabled
        title={disabledReason ?? "This account can't be deleted"}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete agent (disabled)</span>
      </Button>
    );
  }

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteAgent(id);
      if (!res.ok) setError(res.error ?? "Failed to delete");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700"
          title="Delete agent permanently"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete agent</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {name}?</DialogTitle>
          <DialogDescription>
            This will permanently delete this agent and cannot be restored. Are
            you sure?
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
