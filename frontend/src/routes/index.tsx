import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  ArrowRight,
  Users,
  Target,
  Globe,
  Mail,
  TrendingUp,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  runAnalysis,
  extractApiError,
  type AnalysisRequest,
} from "@/services/api";
import { useAnalysis } from "@/hooks/use-analysis";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MABI Intelligence Platform" },
      {
        name: "description",
        content:
          "Multi-agent business intelligence dashboard: run market, competitor, lead, audit, pricing, opportunity and outreach analysis.",
      },
    ],
  }),
  component: DashboardPage,
});

const formSchema = z.object({
  company_name: z.string().min(2, "Company name is required"),
  website: z
    .string()
    .min(1, "Website is required")
    .refine(
      (v) => {
        try {
          const u = /^https?:\/\//i.test(v) ? v : `https://${v}`;
          new URL(u);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Enter a valid website URL" },
    ),
  industry: z.string().min(2, "Industry is required"),
  target_market: z.string().min(2, "Target market is required"),
});

type FormValues = z.infer<typeof formSchema>;

function DashboardPage() {
  const navigate = useNavigate();
  const { latest, setLatest } = useAnalysis();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: latest?.request.company_name ?? "",
      website: latest?.request.website ?? "",
      industry: latest?.request.industry ?? "",
      target_market: latest?.request.target_market ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const payload: AnalysisRequest = {
      company_name: values.company_name.trim(),
      website: /^https?:\/\//i.test(values.website)
        ? values.website.trim()
        : `https://${values.website.trim()}`,
      industry: values.industry.trim(),
      target_market: values.target_market.trim(),
    };
    const toastId = toast.loading("Running multi-agent analysis…", {
      description: "This can take a couple of minutes.",
    });
    try {
      const res = await runAnalysis(payload);
      if (!res?.success) throw new Error(res?.message || "Analysis failed");
      setLatest({ request: payload, data: res.data, completedAt: Date.now() });
      toast.success("Analysis complete", { id: toastId });
      navigate({ to: "/market-research" });
    } catch (err) {
      toast.error("Analysis failed", {
        id: toastId,
        description: extractApiError(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const data = latest?.data;
  const leadsCount = data?.leads?.qualified_leads?.length ?? 0;
  const competitorsCount = data?.competitors?.top_competitors?.length ?? 0;
  const opportunitiesCount = data?.opportunity?.top_opportunities?.length ?? 0;
  const overall = data?.audit?.overall_score;

  const stats = [
    {
      label: "Qualified Leads",
      value: leadsCount,
      icon: Target,
      to: "/lead-generation",
    },
    {
      label: "Competitors",
      value: competitorsCount,
      icon: Users,
      to: "/competitors",
    },
    {
      label: "Opportunities",
      value: opportunitiesCount,
      icon: Sparkles,
      to: "/opportunity-scoring",
    },
    {
      label: "Audit Score",
      value: typeof overall === "number" ? `${overall}` : "—",
      icon: Globe,
      to: "/website-audit",
      hint: typeof overall === "number" ? "/ 100" : undefined,
    },
  ];

  return (
    <AppShell title="Dashboard">
      <PageHeader
        title={
          latest
            ? `Welcome back, ${latest.request.company_name.split(" ")[0]}`
            : "Welcome to MABI"
        }
        description={
          latest
            ? "Your seven agents are ready. Jump into any section, or run a fresh analysis."
            : "Run your first multi-agent analysis. Market, competitors, leads, audit, pricing, opportunities and outreach — in one request."
        }
        actions={
          latest && (
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/market-research">
                Open results
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )
        }
      />

      {latest && (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                to={s.to}
                className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold tracking-tight">
                    {s.value}
                  </span>
                  {s.hint && (
                    <span className="text-xs text-muted-foreground">
                      {s.hint}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Run a new analysis
              </h2>
              <p className="text-xs text-muted-foreground">
                Sends to <code className="text-foreground/80">POST /analyze</code>
              </p>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-6 space-y-4"
            >
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://acme.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SaaS, fintech, e-commerce…"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="target_market"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target market</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="B2B SMBs in North America"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20 hover:opacity-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running agents…
                  </>
                ) : (
                  <>
                    Run analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-[11px] text-muted-foreground">
                Multi-agent pipeline usually takes 30–120 seconds.
              </p>
            </form>
          </Form>
        </div>

        <AgentList />
      </div>
    </AppShell>
  );
}

function AgentList() {
  const agents = [
    { name: "Market Research", desc: "Size, growth, trends, opportunities.", icon: TrendingUp },
    { name: "Competitor Intel", desc: "Top rivals, gaps, pricing insights.", icon: Users },
    { name: "Lead Generator", desc: "Qualified prospects with pain points.", icon: Target },
    { name: "Website Auditor", desc: "SEO, performance and UX scoring.", icon: Globe },
    { name: "Opportunity Scorer", desc: "Growth strategy and priorities.", icon: Sparkles },
    { name: "Outreach Composer", desc: "Emails, LinkedIn, call scripts.", icon: Mail },
  ];
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            AI agent pipeline
          </h3>
          <p className="text-xs text-muted-foreground">
            Coordinated multi-agent workflow.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {agents.map((a) => {
          const Icon = a.icon;
          return (
            <div
              key={a.name}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-background/40 p-3"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-fuchsia-300">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
