"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotesForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add a note..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={pending || !body.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await addNote(taskId, body);
              if (!res.ok) setError(res.error ?? "Failed");
              else {
                setBody("");
                router.refresh();
              }
            })
          }
        >
          Add note
        </Button>
      </div>
    </div>
  );
}
