import Link from "next/link";
import { format } from "date-fns";
import { Plane, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { LeaveStatusBadge } from "@/components/app/leave-status-badge";
import { LeaveReviewActions } from "@/components/app/leave-review-actions";
import { EmptyState } from "@/components/app/empty-state";
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
import { cn, todayISODate } from "@/lib/utils";
import { LEAVE_TYPE_LABELS } from "@/lib/constants";
import type { LeaveRequest, LeaveStatus, Profile } from "@/lib/types";

function dateRange(r: LeaveRequest) {
  const start = format(new Date(r.start_date), "MMM d");
  if (r.is_half_day) return `${start} · half day`;
  if (r.start_date === r.end_date) return start;
  return `${start} → ${format(new Date(r.end_date), "MMM d")}`;
}

export default async function AdminLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; agent?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status as LeaveStatus | undefined;
  const agentFilter = sp.agent;
  const today = todayISODate();

  const supabase = await createClient();
  const [leaveRes, agentsRes] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "agent")
      .order("full_name"),
  ]);

  const all = (leaveRes.data ?? []) as LeaveRequest[];
  const agents = (agentsRes.data ?? []) as Pick<Profile, "id" | "full_name">[];
  const nameOf = (id: string) =>
    agents.find((a) => a.id === id)?.full_name ?? "Unknown";

  const filtered = all.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!agentFilter || r.agent_id === agentFilter),
  );

  const offToday = all.filter(
    (r) => r.status === "approved" && r.start_date <= today && r.end_date >= today,
  );
  const upcoming = all
    .filter((r) => r.status === "approved" && r.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 8);

  const buildHref = (next: { status?: string; agent?: string }) => {
    const params = new URLSearchParams();
    const status = next.status ?? statusFilter;
    const agent = next.agent ?? agentFilter;
    if (status) params.set("status", status);
    if (agent) params.set("agent", agent);
    const qs = params.toString();
    return qs ? `/admin/leave?${qs}` : "/admin/leave";
  };

  const statusChips: { label: string; value?: LeaveStatus }[] = [
    { label: "All" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Review requests and see who's off. Approved leave waives attendance & late penalties."
      />

      {/* Who's off today + upcoming */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-muted-foreground" /> Off today (
              {offToday.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone is in today.</p>
            ) : (
              <ul className="space-y-2">
                {offToday.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{nameOf(r.agent_id)}</span>
                    <span className="text-muted-foreground">
                      {LEAVE_TYPE_LABELS[r.leave_type]}
                      {r.is_half_day ? " · half day" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" /> Upcoming
              leave
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming approved leave.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{nameOf(r.agent_id)}</span>
                    <span className="text-muted-foreground">{dateRange(r)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {statusChips.map((c) => {
          const active = (c.value ?? undefined) === statusFilter;
          return (
            <Link
              key={c.label}
              href={buildHref({ status: c.value ?? "" })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent",
              )}
            >
              {c.label}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" />
        <Link
          href={buildHref({ agent: "" })}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            !agentFilter
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card hover:bg-accent",
          )}
        >
          All agents
        </Link>
        {agents.map((a) => {
          const active = a.id === agentFilter;
          return (
            <Link
              key={a.id}
              href={buildHref({ agent: a.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent",
              )}
            >
              {a.full_name}
            </Link>
          );
        })}
      </div>

      {/* Requests table */}
      <Card>
        <CardContent className="p-0 sm:p-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="No leave requests"
              description="Requests from your team will appear here for review."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{nameOf(r.agent_id)}</TableCell>
                    <TableCell className="text-sm">
                      {LEAVE_TYPE_LABELS[r.leave_type]}
                    </TableCell>
                    <TableCell className="text-sm">{dateRange(r)}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                      {r.reason || "—"}
                    </TableCell>
                    <TableCell>
                      <LeaveStatusBadge status={r.status} />
                      {r.admin_note ? (
                        <p className="mt-0.5 max-w-[14rem] truncate text-xs text-muted-foreground">
                          {r.admin_note}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <LeaveReviewActions id={r.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.reviewed_at
                            ? format(new Date(r.reviewed_at), "MMM d")
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
