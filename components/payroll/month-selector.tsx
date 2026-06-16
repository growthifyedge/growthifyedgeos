"use client";

import { useRouter } from "next/navigation";
import { monthLabel } from "@/lib/payroll/period";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Month picker that navigates to /admin/payroll?month=...&status=... */
export function MonthSelector({
  month,
  months,
  status,
  basePath = "/admin/payroll",
}: {
  month: string;
  months: string[];
  status?: string;
  basePath?: string;
}) {
  const router = useRouter();

  const go = (m: string) => {
    const params = new URLSearchParams();
    params.set("month", m);
    if (status) params.set("status", status);
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <Select value={month} onValueChange={go}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m} value={m}>
            {monthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
