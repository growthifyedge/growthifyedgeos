"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Building2,
  BarChart3,
  Gauge,
  Coins,
  Settings,
  CalendarClock,
  Plane,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLockup, BrandMark } from "@/components/app/logo";
import type { UserRole } from "@/lib/types";

type NavItem = { label: string; href: string; icon: LucideIcon };

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Tasks", href: "/admin/tasks", icon: ListChecks },
  { label: "Agents", href: "/admin/agents", icon: Users },
  { label: "Leave Management", href: "/admin/leave", icon: Plane },
  { label: "Clients", href: "/admin/clients", icon: Building2 },
  { label: "KPI & Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Penalties & Rewards", href: "/admin/penalties", icon: Coins },
  { label: "Payroll", href: "/admin/payroll", icon: Wallet },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const AGENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/agent", icon: LayoutDashboard },
  { label: "My Tasks", href: "/agent/tasks", icon: ListChecks },
  { label: "Attendance", href: "/agent/attendance", icon: CalendarClock },
  { label: "Leave Requests", href: "/agent/leave", icon: Plane },
  { label: "My Payroll", href: "/agent/payroll", icon: Wallet },
  { label: "My KPIs", href: "/agent/kpis", icon: Gauge },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/agent") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const nav = role === "admin" ? ADMIN_NAV : AGENT_NAV;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center border-b px-5">
          <BrandLockup />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Menu
          </p>
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-premium-md"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <p className="text-xs font-medium text-foreground">
            {role === "admin" ? "Owner / Admin" : "Agent"} workspace
          </p>
          <p className="text-[11px] text-muted-foreground">GrowthifyEdge © 2026</p>
        </div>
      </aside>

      {/* Mobile top nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-b bg-card p-2 md:hidden">
        <BrandMark className="mr-1 h-8 w-8 shrink-0" />
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
