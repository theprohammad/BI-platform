import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyAnalysis, PageHeader } from "@/components/layout/AppShell";
import { useAnalysis } from "@/hooks/use-analysis";
import {
  OpportunitySection,
  PricingSection,
} from "@/components/analysis/sections";

export const Route = createFileRoute("/opportunity-scoring")({
  head: () => ({
    meta: [
      { title: "Opportunity Scoring — MABI" },
      { name: "description", content: "Prioritized growth opportunities, pricing intelligence and next steps." },
    ],
  }),
  component: Page,
});

function Page() {
  const { latest } = useAnalysis();
  const opportunity = latest?.data.opportunity;
  const pricing = latest?.data.pricing;
  const has = Boolean(opportunity || pricing);
  return (
    <AppShell title="Opportunity Scoring">
      <PageHeader
        title="Opportunity Scoring"
        description="The scoring agent synthesizes signals across research, competitors and audit to surface what to do next."
      />
      {!has ? (
        <EmptyAnalysis label="opportunity scoring" />
      ) : (
        <div className="space-y-12">
          {opportunity ? <OpportunitySection data={opportunity} /> : null}
          {pricing ? <PricingSection data={pricing} /> : null}
        </div>
      )}
    </AppShell>
  );
}
