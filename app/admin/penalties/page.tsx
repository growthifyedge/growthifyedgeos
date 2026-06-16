import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { RulesEditor } from "@/components/app/rules-editor";
import { RunIncentivesButton } from "@/components/app/run-incentives-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PenaltyRewardRule, LedgerEntry } from "@/lib/types";

type LedgerWithAgent = LedgerEntry & { agent?: { full_name: string } | null };

export default async function PenaltiesPage() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStr = monthStart.toISOString().slice(0, 10);

  const [rulesRes, ledgerRes] = await Promise.all([
    supabase.from("penalty_reward_rules").select("*").order("type").order("label"),
    supabase
      .from("penalty_reward_ledger")
      .select("*, agent:profiles(full_name)")
      .eq("period_month", monthStr)
      .order("created_at", { ascending: false }),
  ]);

  const rules = (rulesRes.data ?? []) as PenaltyRewardRule[];
  const ledger = (ledgerRes.data ?? []) as LedgerWithAgent[];

  // Per-agent net summary for the month
  const summary = new Map<string, { name: string; penalties: number; rewards: number }>();
  for (const e of ledger) {
    const key = e.agent_id;
    const cur = summary.get(key) ?? {
      name: e.agent?.full_name ?? "Unknown",
      penalties: 0,
      rewards: 0,
    };
    if (e.type === "penalty") cur.penalties += Number(e.amount);
    else cur.rewards += Number(e.amount);
    summary.set(key, cur);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Penalties &amp; Rewards</h1>
          <p className="text-sm text-muted-foreground">
            {format(monthStart, "MMMM yyyy")} ledger. Late logins, missed deadlines and
            excessive breaks are applied automatically.
          </p>
        </div>
        <RunIncentivesButton />
      </div>

      {/* Net summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly net by agent</CardTitle>
          <CardDescription>Rewards minus penalties (points).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>Penalties</TableHead>
                <TableHead>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...summary.values()].length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No entries this month yet.
                  </TableCell>
                </TableRow>
              ) : (
                [...summary.values()]
                  .sort((a, b) => b.rewards - b.penalties - (a.rewards - a.penalties))
                  .map((s) => {
                    const net = s.rewards - s.penalties;
                    return (
                      <TableRow key={s.name}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-emerald-600">+{s.rewards}</TableCell>
                        <TableCell className="text-red-600">-{s.penalties}</TableCell>
                        <TableCell className={net >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {net >= 0 ? "+" : ""}
                          {net}
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Ledger entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.agent?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.type === "reward" ? "default" : "destructive"}>
                        {e.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.label}</TableCell>
                    <TableCell className={e.type === "reward" ? "text-emerald-600" : "text-red-600"}>
                      {e.type === "reward" ? "+" : "-"}
                      {e.amount}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {e.reason}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(e.created_at), "MMM d, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Tune the amounts and toggle rules on/off.</CardDescription>
        </CardHeader>
        <CardContent>
          <RulesEditor rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
