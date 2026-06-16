import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/app/settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AppSettings } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  const settings = data as AppSettings;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Attendance and KPI thresholds that drive the penalty &amp; reward engine.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy thresholds</CardTitle>
          <CardDescription>
            Changes apply to future calculations. Re-run incentives to recompute the
            current month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings ? (
            <SettingsForm settings={settings} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Settings row missing — run the 0005_seed.sql migration.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
