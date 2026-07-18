import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyAnalysis, PageHeader } from "@/components/layout/AppShell";
import { useAnalysis } from "@/hooks/use-analysis";
import { LeadsSection } from "@/components/analysis/sections";

export const Route = createFileRoute("/lead-generation")({
  head: () => ({
    meta: [
      { title: "Lead Generation — MABI" },
      { name: "description", content: "Qualified leads sourced and scored by the lead generation agent." },
    ],
  }),
  component: Page,
});

function Page() {
  const { latest } = useAnalysis();
  return (
    <AppShell title="Lead Generation">
      <PageHeader
        title="Lead Generation"
        description="Qualified leads sourced and scored by the lead generation agent."
      />
      {latest?.data.leads ? (
        <LeadsSection data={latest.data.leads} />
      ) : (
        <EmptyAnalysis label="qualified leads" />
      )}
    </AppShell>
  );
}
