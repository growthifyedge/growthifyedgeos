"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRuleAmount } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PenaltyRewardRule } from "@/lib/types";

export function RulesEditor({ rules }: { rules: PenaltyRewardRule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Record<string, { amount: string; active: boolean }>>(
    Object.fromEntries(
      rules.map((r) => [r.code, { amount: String(r.amount), active: r.is_active }]),
    ),
  );

  const save = (code: string) => {
    const d = draft[code];
    startTransition(async () => {
      await updateRuleAmount(code, Number(d.amount), d.active);
      router.refresh();
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rule</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Active</TableHead>
          <TableHead className="text-right">Save</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((r) => (
          <TableRow key={r.code}>
            <TableCell>
              <p className="font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </TableCell>
            <TableCell>
              <Badge variant={r.type === "reward" ? "default" : "destructive"}>
                {r.type}
              </Badge>
            </TableCell>
            <TableCell>
              <Input
                type="number"
                className="w-24"
                value={draft[r.code].amount}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [r.code]: { ...d[r.code], amount: e.target.value },
                  }))
                }
              />
            </TableCell>
            <TableCell>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={draft[r.code].active}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [r.code]: { ...d[r.code], active: e.target.checked },
                  }))
                }
              />
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => save(r.code)}>
                Save
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
