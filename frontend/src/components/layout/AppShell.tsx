import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Brain,
  LayoutGrid,
  Search,
  Users,
  Target,
  Globe,
  Sparkles,
  Mail,
  FileText,
  Settings as SettingsIcon,
  Bell,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAnalysis } from "@/hooks/use-analysis";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  badgeKey?: "leads";
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/intelligence", label: "Intelligence", icon: Brain },
  { to: "/market-research", label: "Market Research", icon: Search },
  { to: "/competitors", label: "Competitors", icon: Users },
  { to: "/lead-generation", label: "Lead Generation", icon: Target, badgeKey: "leads" },
  { to: "/website-audit", label: "Website Audit", icon: Globe },
  { to: "/opportunity-scoring", label: "Opportunity Scoring", icon: Sparkles },
  { to: "/outreach-generator", label: "Outreach Generator", icon: Mail },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function BrandMark() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-600 shadow-lg shadow-fuchsia-500/20">
      <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
    </div>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { latest } = useAnalysis();
  const leadCount = latest?.data.leads?.qualified_leads?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("px-5 pt-6 pb-6", collapsed && "px-3")}>
        <Link to="/" className="flex items-center gap-3" onClick={onNavigate}>
          <BrandMark />
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">
                MABI
              </div>
              <div className="text-[11px] text-muted-foreground">
                Intelligence Platform
              </div>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          const badge =
            item.badgeKey === "leads" && leadCount > 0 ? leadCount : null;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/[0.06] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {badge !== null && (
                    <span className="ml-auto rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                      {badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-colors"
        >
          <ChevronLeft
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { latest } = useAnalysis();
  const company = latest?.request.company_name;

  const sidebarWidth = collapsed ? "lg:w-20" : "lg:w-64";
  const contentOffset = collapsed ? "lg:pl-20" : "lg:pl-64";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background wash */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(139,92,246,0.12),transparent),radial-gradient(1000px_500px_at_100%_10%,rgba(217,70,239,0.08),transparent)]" />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-white/5 bg-background/60 backdrop-blur-xl lg:block transition-[width] duration-200",
          sidebarWidth,
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/5 bg-background shadow-2xl">
            <SidebarBody
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", contentOffset)}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-white/5 bg-background/70 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
            <button
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Workspace breadcrumb */}
            <div className="flex items-center gap-2 min-w-0">
              {company ? (
                <>
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-[10px] font-bold text-foreground border border-white/10">
                    {company
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate">
                    {company}
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  No workspace yet
                </span>
              )}
              {title && (
                <>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="text-sm text-muted-foreground truncate">
                    {title}
                  </span>
                </>
              )}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-muted-foreground w-72">
                <Search className="h-3.5 w-3.5" />
                <span>Search agents, reports…</span>
                <kbd className="ml-auto rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono">
                  ⌘K
                </kbd>
              </div>
              <button
                aria-label="Notifications"
                className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-[11px] font-bold text-white">
                JS
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyAnalysis({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
        <Sparkles className="h-5 w-5 text-fuchsia-300" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No {label} yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Run an analysis from the Dashboard to populate this view.
      </p>
      <div className="mt-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
        >
          <Sparkles className="h-4 w-4" />
          New analysis
        </Link>
      </div>
    </div>
  );
}
