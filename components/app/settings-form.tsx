"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSettings, type UpdateSettingsInput } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/payroll/constants";
import type { AppSettings } from "@/lib/types";

const FIELDS: { key: keyof AppSettings; label: string; hint: string }[] = [
  { key: "grace_period_minutes", label: "Late-login grace (min)", hint: "Minutes after shift start before a login counts as late." },
  { key: "early_logout_grace_min", label: "Early-logout grace (min)", hint: "Minutes before shift end allowed without penalty." },
  { key: "max_break_minutes", label: "Daily break allowance (min)", hint: "Total break time before the excessive-break penalty." },
  { key: "standard_work_minutes", label: "Standard work day (min)", hint: "Expected productive minutes per day." },
  { key: "low_completion_threshold", label: "Low-completion threshold (%)", hint: "Below this % of monthly target triggers a penalty." },
  { key: "high_quality_threshold", label: "High-quality threshold (0–10)", hint: "Avg quality at/above this earns a reward." },
];

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [currency, setCurrency] = useState(settings.base_currency ?? "USD");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])),
  );

  const submit = () => {
    setMsg(null);
    startTransition(async () => {
      const payload: UpdateSettingsInput = { base_currency: currency };
      for (const f of FIELDS) {
        (payload as Record<string, number | string>)[f.key] = Number(
          values[f.key],
        );
      }
      const res = await updateSettings(payload);
      setMsg(res.ok ? "Saved." : (res.error ?? "Failed"));
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="max-w-xs space-y-1.5">
        <Label>Agency base currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Default currency used when a new agent&apos;s payroll has none set.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              type="number"
              step="0.5"
              value={values[f.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          Save settings
        </Button>
        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      </div>
    </div>
  );
}
