import { createFileRoute } from "@tanstack/react-router";
import { AppShell, EmptyAnalysis, PageHeader } from "@/components/layout/AppShell";
import { useAnalysis } from "@/hooks/use-analysis";
import { AuditSection } from "@/components/analysis/sections";

export const Route = createFileRoute("/website-audit")({
  head: () => ({
    meta: [
      { title: "Website Audit — MABI" },
      { name: "description", content: "SEO, performance, UX scoring and critical issues." },
    ],
  }),
  component: Page,
});

function Page() {
  const { latest } = useAnalysis();
  return (
    <AppShell title="Website Audit">
      <PageHeader
        title="Website Audit"
        description="SEO, performance, UX scoring and critical issues detected on the target website."
      />
      {latest?.data.audit ? (
        <AuditSection data={latest.data.audit} />
      ) : (
        <EmptyAnalysis label="website audit" />
      )}
    </AppShell>
  );
}
