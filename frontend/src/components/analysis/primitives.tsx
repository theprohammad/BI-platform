import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 md:flex-row md:items-end md:justify-between mb-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-1 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-indigo-500">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function InsightCard({
  title,
  children,
  footer,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      {title ? (
        <h3 className="text-sm font-semibold tracking-tight mb-3">{title}</h3>
      ) : null}
      <div className="text-sm leading-relaxed">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

export function BadgeList({
  items,
  variant = "default",
}: {
  items?: string[];
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  if (!items || items.length === 0) return null;
  const styles: Record<string, string> = {
    default: "bg-muted text-foreground",
    success:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    warning:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    info: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  };
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, i) => (
        <span
          key={`${i}-${it}`}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
            styles[variant],
          )}
        >
          {it}
        </span>
      ))}
    </div>
  );
}

export function BulletList({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
          <span className="text-foreground/90">{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const p = priority.toLowerCase();
  const cls =
    p === "high"
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
      : p === "medium"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        cls,
      )}
    >
      {priority}
    </span>
  );
}
