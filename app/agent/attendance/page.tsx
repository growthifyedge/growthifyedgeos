import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AttendancePanel } from "@/components/app/attendance-panel";
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
import { formatDuration, todayISODate } from "@/lib/utils";
import type { AttendanceSession } from "@/lib/types";

export default async function AttendancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const today = todayISODate();

  const [sessionRes, historyRes] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("work_date", today)
      .maybeSingle(),
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("agent_id", profile.id)
      .order("work_date", { ascending: false })
      .limit(30),
  ]);

  const session = (sessionRes.data as AttendanceSession | null) ?? null;
  let openBreakStart: string | null = null;
  if (session && session.status === "on_break") {
    const { data: br } = await supabase
      .from("break_logs")
      .select("break_start")
      .eq("session_id", session.id)
      .is("break_end", null)
      .maybeSingle();
    openBreakStart = (br?.break_start as string | undefined) ?? null;
  }

  const history = (historyRes.data ?? []) as AttendanceSession[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Clock in/out, take breaks, and review your history.
        </p>
      </div>

      <AttendancePanel session={session} openBreakStart={openBreakStart} />

      <Card>
        <CardHeader>
          <CardTitle>Last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Work</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Early out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No attendance yet.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {format(new Date(s.work_date), "EEE, MMM d")}
                    </TableCell>
                    <TableCell>{format(new Date(s.shift_start), "HH:mm")}</TableCell>
                    <TableCell>
                      {s.shift_end ? format(new Date(s.shift_end), "HH:mm") : "—"}
                    </TableCell>
                    <TableCell>{formatDuration(s.work_seconds)}</TableCell>
                    <TableCell className="text-amber-600">
                      {formatDuration(s.break_seconds)}
                    </TableCell>
                    <TableCell className={s.is_late ? "text-red-600" : ""}>
                      {s.is_late ? `${s.late_minutes}m` : "—"}
                    </TableCell>
                    <TableCell className={s.is_early_logout ? "text-red-600" : ""}>
                      {s.is_early_logout ? `${s.early_minutes}m` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
