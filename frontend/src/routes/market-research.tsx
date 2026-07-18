import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyAnalysis, PageHeader } from "@/components/layout/AppShell";
import { useAnalysis } from "@/hooks/use-analysis";
import { MarketSection } from "@/components/analysis/sections";

export const Route = createFileRoute("/market-research")({
  head: () => ({
    meta: [
      { title: "Market Research — MABI" },
      { name: "description", content: "Market size, growth, trends, opportunities and risks." },
    ],
  }),
  component: Page,
});

function Page() {
  const { latest } = useAnalysis();
  return (
    <AppShell title="Market Research">
      <PageHeader
        title="Market Research"
        description="Market size, growth, trends, opportunities and risks — synthesized by the market agent."
      />
      {latest?.data.market ? (
        <MarketSection data={latest.data.market} />
      ) : (
        <EmptyAnalysis label="market research" />
      )}
    </AppShell>
  );
}
