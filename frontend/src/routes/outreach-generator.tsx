import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyAnalysis, PageHeader } from "@/components/layout/AppShell";
import { useAnalysis } from "@/hooks/use-analysis";
import { OutreachSection } from "@/components/analysis/sections";

export const Route = createFileRoute("/outreach-generator")({
  head: () => ({
    meta: [
      { title: "Outreach Generator — MABI" },
      { name: "description", content: "Ready-to-send emails, LinkedIn messages and cold call scripts." },
    ],
  }),
  component: Page,
});

function Page() {
  const { latest } = useAnalysis();
  return (
    <AppShell title="Outreach Generator">
      <PageHeader
        title="Outreach Generator"
        description="Ready-to-send emails, LinkedIn messages and a cold call script — generated for your target leads."
      />
      {latest?.data.outreach ? (
        <OutreachSection data={latest.data.outreach} />
      ) : (
        <EmptyAnalysis label="outreach content" />
      )}
    </AppShell>
  );
}
