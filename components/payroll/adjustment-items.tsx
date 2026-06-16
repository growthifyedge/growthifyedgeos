import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/payroll/constants";
import { formatMoney } from "@/lib/payroll/format";
import type { PayrollAdjustment } from "@/types/payroll";

function Section({
  title,
  items,
  sign,
  tone,
  currency,
  empty,
}: {
  title: string;
  items: PayrollAdjustment[];
  sign: string;
  tone: string;
  currency: string;
  empty: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.id} className="py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{categoryLabel(a.category)}</span>
                <span className={cn("font-medium", tone)}>
                  {sign}
                  {formatMoney(a.amount, currency)}
                </span>
              </div>
              {a.reason ? (
                <p className="text-xs text-muted-foreground">{a.reason}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Read-only itemized bonuses + deductions, grouped. Shared by admin & agent. */
export function AdjustmentItems({
  adjustments,
  currency,
}: {
  adjustments: PayrollAdjustment[];
  currency: string;
}) {
  if (adjustments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No bonuses or deductions this month.
      </p>
    );
  }
  const bonuses = adjustments.filter((a) => a.kind === "bonus");
  const deductions = adjustments.filter((a) => a.kind === "deduction");
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Section
        title="Bonuses"
        items={bonuses}
        sign="+"
        tone="text-emerald-600"
        currency={currency}
        empty="No bonuses."
      />
      <Section
        title="Deductions"
        items={deductions}
        sign="−"
        tone="text-red-600"
        currency={currency}
        empty="No deductions."
      />
    </div>
  );
}
