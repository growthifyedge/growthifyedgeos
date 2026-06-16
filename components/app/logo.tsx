import { cn } from "@/lib/utils";

/**
 * GrowthifyEdge brand mark — inline SVG so it renders crisply at any size with
 * no extra network request. To use your own logo instead, replace this SVG (or
 * swap in an <Image src="/logo.svg" />; a copy lives at public/logo.svg).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-9 w-9", className)}
      role="img"
      aria-label="GrowthifyEdge"
    >
      <defs>
        <linearGradient
          id="ge-brand-grad"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ge-brand-grad)" />
      <rect x="17" y="34" width="7" height="13" rx="2" fill="#fff" fillOpacity="0.95" />
      <rect x="28.5" y="26" width="7" height="21" rx="2" fill="#fff" fillOpacity="0.95" />
      <rect x="40" y="18" width="7" height="29" rx="2" fill="#fff" fillOpacity="0.95" />
    </svg>
  );
}

/** Full lockup: mark + wordmark + tagline. Used in the sidebar. */
export function BrandLockup({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark className="h-9 w-9 shrink-0" />
      {!collapsed ? (
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">GrowthifyEdge</p>
          <p className="text-[11px] text-muted-foreground">
            Digital Marketing Operations
          </p>
        </div>
      ) : null}
    </div>
  );
}
