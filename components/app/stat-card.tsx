import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACCENTS = {
  blue: "from-blue-500 to-indigo-500",
  green: "from-emerald-500 to-teal-500",
  amber: "from-amber-500 to-orange-500",
  red: "from-rose-500 to-red-500",
  violet: "from-violet-500 to-purple-500",
  slate: "from-slate-500 to-slate-600",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "slate",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/70 shadow-premium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium-md">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-[28px] font-semibold leading-none tracking-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="truncate text-xs text-muted-foreground/80">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-premium-md",
            ACCENTS[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r opacity-0 transition-opacity group-hover:opacity-100",
          ACCENTS[accent],
        )}
      />
    </Card>
  );
}
