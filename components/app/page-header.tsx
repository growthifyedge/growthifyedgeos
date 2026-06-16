export function PageHeader({
  greeting,
  title,
  description,
  children,
}: {
  greeting?: string;
  title: string;
  description?: string;
  children?: React.ReactNode; // right-aligned actions
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {greeting ? (
          <p className="text-sm font-medium text-primary">{greeting}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
