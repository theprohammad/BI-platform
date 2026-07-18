import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyAnalysis, PageHeader } from "@/components/layout/AppShell";
import { useAnalysis } from "@/hooks/use-analysis";
import { CompetitorsSection } from "@/components/analysis/sections";

export const Route = createFileRoute("/competitors")({
  head: () => ({
    meta: [
      { title: "Competitors — MABI" },
      { name: "description", content: "Competitor positioning, gaps and strategic recommendations." },
    ],
  }),
  component: Page,
});

function Page() {
  const { latest } = useAnalysis();
  return (
    <AppShell title="Competitors">
      <PageHeader
        title="Competitors"
        description="A live map of competitor positioning, gaps and threat level for your target market."
      />
      {latest?.data.competitors ? (
        <CompetitorsSection data={latest.data.competitors} />
      ) : (
        <EmptyAnalysis label="competitor analysis" />
      )}
    </AppShell>
  );
}
