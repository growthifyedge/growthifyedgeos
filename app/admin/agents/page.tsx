import { createClient } from "@/lib/supabase/server";
import { CreateAgentDialog } from "@/components/app/create-agent-dialog";
import {
  Card,
  CardContent,
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PayrollSettingsDialog } from "@/components/payroll/payroll-settings-dialog";
import { formatMoney } from "@/lib/payroll/format";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import type { PayrollSettings } from "@/types/payroll";

export default async function AgentsPage() {
  const supabase = await createClient();
  const [peopleRes, settingsRes, agencyRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("full_name"),
    supabase.from("payroll_settings").select("*"),
    supabase.from("app_settings").select("base_currency").eq("id", 1).single(),
  ]);
  const people = (peopleRes.data ?? []) as Profile[];
  const settings = (settingsRes.data ?? []) as PayrollSettings[];
  const settingsMap = new Map(settings.map((s) => [s.agent_id, s]));
  const baseCurrency = (agencyRes.data?.base_currency as string) || "USD";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage agents, shifts and monthly targets.
          </p>
        </div>
        <CreateAgentDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{people.length} members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Monthly target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Payroll</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => {
                const s = settingsMap.get(p.id) ?? null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{p.full_name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.role === "admin" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {p.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.shift_start_time?.slice(0, 5)} – {p.shift_end_time?.slice(0, 5)}
                    </TableCell>
                    <TableCell className="text-sm">{p.monthly_task_target}</TableCell>
                    <TableCell>
                      {p.is_active ? (
                        <span className="text-sm text-emerald-600">Active</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.role === "agent" ? (
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-sm">
                            {s && s.monthly_salary > 0 ? (
                              <>
                                <span className="font-medium">
                                  {formatMoney(s.monthly_salary, s.currency)}
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {formatMoney(s.daily_rate, s.currency)}/day
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not set</span>
                            )}
                          </span>
                          <PayrollSettingsDialog
                            agentId={p.id}
                            agentName={p.full_name || p.email || "Agent"}
                            settings={s}
                            defaultCurrency={baseCurrency}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
