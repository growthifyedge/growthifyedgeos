import { requireAgent } from "@/lib/auth";
import { AppShell } from "@/components/app/app-shell";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAgent();
  return <AppShell profile={profile}>{children}</AppShell>;
}
