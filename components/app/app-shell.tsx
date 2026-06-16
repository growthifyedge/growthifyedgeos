import { Sidebar } from "@/components/app/sidebar";
import { SignOutButton } from "@/components/app/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-card/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/70 md:px-6">
          <div className="hidden text-sm text-muted-foreground sm:block">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {profile.full_name || profile.email}
              </p>
              <Badge variant="secondary" className="mt-0.5 capitalize">
                {profile.role}
              </Badge>
            </div>
            <Avatar className="ring-2 ring-background">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                {initials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-6 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
