import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { RequestLeaveDialog } from "@/components/app/request-leave-dialog";
import { LeaveStatusBadge } from "@/components/app/leave-status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import type { LeaveRequest } from "@/lib/types";

function dateRange(r: LeaveRequest) {
  const start = format(new Date(r.start_date), "MMM d, yyyy");
  if (r.is_half_day || r.start_date === r.end_date) {
    return r.is_half_day ? `${start} · half day` : start;
  }
  return `${start} → ${format(new Date(r.end_date), "MMM d, yyyy")}`;
}

function LeaveTable({ rows }: { rows: LeaveRequest[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Plane}
        title="No leave requests"
        description="Submit a request and track its status here."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Admin note</TableHead>
          <TableHead>Requested</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">
              {LEAVE_TYPE_LABELS[r.leave_type]}
            </TableCell>
            <TableCell className="text-sm">{dateRange(r)}</TableCell>
            <TableCell>
              <LeaveStatusBadge status={r.status} />
            </TableCell>
            <TableCell className="max-w-xs text-sm text-muted-foreground">
              {r.admin_note || "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {format(new Date(r.created_at), "MMM d")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AgentLeavePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("agent_id", profile.id)
    .order("created_at", { ascending: false });

  const all = (data ?? []) as LeaveRequest[];
  const pending = all.filter((r) => r.status === "pending");
  const approved = all.filter((r) => r.status === "approved");
  const rejected = all.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Requests"
        description="Request time off and track approvals. Approved leave protects your attendance KPIs."
      >
        <RequestLeaveDialog />
      </PageHeader>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <LeaveTable rows={all} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <LeaveTable rows={pending} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="approved">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <LeaveTable rows={approved} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rejected">
          <Card>
            <CardContent className="p-0 sm:p-2">
              <LeaveTable rows={rejected} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
