import { createClient } from "@/lib/supabase/server";
import { ClientFormDialog } from "@/components/app/client-form-dialog";
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
import type { Client, ClientTaskStatusRow } from "@/lib/types";

export default async function ClientsPage() {
  const supabase = await createClient();
  const [clientsRes, statusRes] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("v_client_task_status").select("*"),
  ]);
  const clients = (clientsRes.data ?? []) as Client[];
  const status = (statusRes.data ?? []) as ClientTaskStatusRow[];
  const statusMap = new Map(status.map((s) => [s.client_id, s]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            The brands you deliver content for.
          </p>
        </div>
        <ClientFormDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{clients.length} clients</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Open tasks</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => {
                const s = statusMap.get(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.contact_name || "—"}
                      {c.contact_email ? (
                        <span className="block text-xs">{c.contact_email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{s ? s.total - s.completed : 0}</TableCell>
                    <TableCell className={s && s.overdue > 0 ? "text-red-600" : ""}>
                      {s?.overdue ?? 0}
                    </TableCell>
                    <TableCell>{s?.completed ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <ClientFormDialog client={c} />
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
