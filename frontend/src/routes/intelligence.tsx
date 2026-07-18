/**
 * Intelligence (Steel Thread) — conversation → research → graph → workspace → cited chat.
 * Phase 1 minimal workspace; widens into the full workspace in Phase 4 (Blueprint).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Activity, ArrowUp, Brain, CalendarClock, ExternalLink, FileSearch,
  Lightbulb, Loader2, MessageSquare, ShieldCheck,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  askAnalyst, fetchTwin, fetchTwinEvidence, fetchTwins, startAnalysis,
  streamRunEvents,
  type ChatAnswer, type EvidenceSummary, type RunEvent, type TwinView,
} from "@/services/intelligence";

export const Route = createFileRoute("/intelligence")({ component: IntelligencePage });

type Phase = "intake" | "clarify" | "running" | "workspace";

function IntelligencePage() {
  const [phase, setPhase] = useState<Phase>("intake");
  const [message, setMessage] = useState("");
  const [priorMessage, setPriorMessage] = useState<string | undefined>();
  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [twin, setTwin] = useState<TwinView | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSummary[]>([]);
  const [twins, setTwins] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTwins().then(setTwins).catch(() => {});
  }, []);

  const loadTwin = async (id: string) => {
    setOrgId(id);
    const [t, ev] = await Promise.all([fetchTwin(id), fetchTwinEvidence(id)]);
    setTwin(t);
    setEvidence(ev);
    setPhase("workspace");
  };

  const submit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await startAnalysis(message, priorMessage);
      if (res.status === "needs_clarification") {
        setClarifyQuestion(res.question);
        setPriorMessage(priorMessage ? `${priorMessage}\n${message}` : message);
        setMessage("");
        setPhase("clarify");
      } else {
        setOrgId(res.organization_id);
        setEvents([]);
        setPhase("running");
        streamRunEvents(
          res.run_id,
          (e) => setEvents((prev) => [...prev, e]),
          async (failed) => {
            if (failed) setError("The research run failed. Partial results may exist.");
            await loadTwin(res.organization_id);
          },
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Intelligence"
        description="Conversation → research → knowledge graph → cited answers"
      />
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {(phase === "intake" || phase === "clarify") && (
        <IntakeView
          phase={phase}
          message={message}
          setMessage={setMessage}
          clarifyQuestion={clarifyQuestion}
          submitting={submitting}
          onSubmit={submit}
          twins={twins}
          onOpenTwin={loadTwin}
        />
      )}
      {phase === "running" && <ResearchNarrative events={events} />}
      {phase === "workspace" && twin && orgId && (
        <TwinWorkspace
          twin={twin}
          evidence={evidence}
          orgId={orgId}
          onNewAnalysis={() => {
            setPhase("intake");
            setPriorMessage(undefined);
            setMessage("");
            fetchTwins().then(setTwins).catch(() => {});
          }}
        />
      )}
    </AppShell>
  );
}

/* ------------------------------ intake ---------------------------------- */

function IntakeView(props: {
  phase: Phase;
  message: string;
  setMessage: (v: string) => void;
  clarifyQuestion: string;
  submitting: boolean;
  onSubmit: () => void;
  twins: { id: string; name: string }[];
  onOpenTwin: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl pt-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
          <Brain className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          What would you like to analyze?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name an organization and what you want to understand. No forms.
        </p>
      </div>

      {props.phase === "clarify" && (
        <div className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm">
          {props.clarifyQuestion}
        </div>
      )}

      <div className="relative">
        <Textarea
          value={props.message}
          onChange={(e) => props.setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) props.onSubmit();
          }}
          placeholder={
            props.phase === "clarify"
              ? "Your answer…"
              : "Analyze Superior University Lahore. I want to understand competitors, admissions, digital presence, and growth opportunities."
          }
          className="min-h-[120px] resize-none rounded-2xl pr-14 text-[15px]"
        />
        <Button
          size="icon"
          className="absolute bottom-3 right-3 h-9 w-9 rounded-xl"
          onClick={props.onSubmit}
          disabled={props.submitting || !props.message.trim()}
        >
          {props.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">⌘/Ctrl + Enter to send</p>

      {props.twins.length > 0 && (
        <div className="mt-10">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Organization twins
          </div>
          <div className="flex flex-wrap gap-2">
            {props.twins.map((t) => (
              <Button key={t.id} variant="outline" size="sm" className="rounded-full"
                onClick={() => props.onOpenTwin(t.id)}>
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- live research narrative ----------------------- */

function eventLine(e: RunEvent): string | null {
  const p = e.payload as Record<string, any>;
  switch (e.type) {
    case "research.stage":
      if (p.stage === "understand") return p.reused ? "Profile already known — delta research" : `Understanding: ${p.detail ?? ""}`;
      if (p.stage === "hypothesize" && p.hypotheses) return `Hypotheses: ${(p.hypotheses as string[]).join(" · ")}`;
      if (p.stage === "hypothesize") return "Generating research hypotheses…";
      if (p.stage === "investigate") return p.stopped ? `Budget stop (${p.topic})` : `Investigating ${p.topic}: ${p.question ?? ""}`;
      if (p.stage === "verify") return `Verifying ${p.claims} claims against their evidence…`;
      if (p.stage === "synthesize") return `Specialist synthesis: ${p.specialist}`;
      return p.stage;
    case "tool.invoked":
      return p.tool === "web.search" ? "Searching the web…" : null;
    case "research.extracted":
      return `Extracted ${p.claims} claims, ${p.edges} relationships (${p.topic})`;
    case "research.done":
      return `Research complete — ${p.claims} verified claims, ${p.evidence_new} new sources, ${p.evidence_reused} reused`;
    case "run.completed":
      return "Building workspace…";
    case "run.failed":
      return "Run failed.";
    default:
      return null;
  }
}

function ResearchNarrative({ events }: { events: RunEvent[] }) {
  const lines = events.map(eventLine).filter(Boolean) as string[];
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [lines.length]);
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Activity className="h-4 w-4 text-violet-500" />
        <CardTitle className="text-base">Researching…</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[420px] space-y-2 overflow-y-auto text-sm">
        {lines.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Starting research loop…
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className={cn("flex items-start gap-2",
            i === lines.length - 1 ? "text-foreground" : "text-muted-foreground")}>
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ workspace -------------------------------- */

function TrustBadge({ trust }: { trust: { confidence: number; evidence_count: number } }) {
  const pct = Math.round(trust.confidence * 100);
  const tone = pct >= 70 ? "text-emerald-500" : pct >= 45 ? "text-amber-500" : "text-rose-500";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", tone)}
      title={`confidence ${pct}% · ${trust.evidence_count} evidence`}>
      <ShieldCheck className="h-3 w-3" /> {pct}%
    </span>
  );
}

function ClaimRow({ c }: { c: TwinView["profile_claims"][number] }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <div>
        <div className="text-sm">{c.statement}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="h-4 rounded px-1 text-[10px]">{c.topic}</Badge>
          {c.as_of && <span>as of {c.as_of.slice(0, 10)}</span>}
          <span>{c.evidence_ids.length} source{c.evidence_ids.length > 1 ? "s" : ""}</span>
        </div>
      </div>
      <TrustBadge trust={c.trust} />
    </div>
  );
}

function TwinWorkspace(props: {
  twin: TwinView;
  evidence: EvidenceSummary[];
  orgId: string;
  onNewAnalysis: () => void;
}) {
  const { twin, evidence } = props;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{twin.organization.name}</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {twin.organization.industry && <Badge variant="secondary">{twin.organization.industry}</Badge>}
              {Object.entries(twin.coverage).map(([topic, cov]) => (
                <Badge key={topic} variant="outline">{topic}: {cov.claims}</Badge>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={props.onNewAnalysis}>New analysis</Button>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile"><FileSearch className="mr-1 h-3.5 w-3.5" />Profile</TabsTrigger>
            <TabsTrigger value="timeline"><CalendarClock className="mr-1 h-3.5 w-3.5" />Timeline</TabsTrigger>
            <TabsTrigger value="insights"><Lightbulb className="mr-1 h-3.5 w-3.5" />Insights</TabsTrigger>
            <TabsTrigger value="evidence"><ExternalLink className="mr-1 h-3.5 w-3.5" />Evidence</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-3 space-y-2">
            {twin.profile_claims.length === 0 && <Empty label="No claims yet." />}
            {twin.profile_claims.map((c) => <ClaimRow key={c.id} c={c} />)}
          </TabsContent>

          <TabsContent value="timeline" className="mt-3 space-y-2">
            {twin.timeline.length === 0 && <Empty label="No dated events discovered yet." />}
            {twin.timeline.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2">
                <div className="w-20 shrink-0 text-xs font-medium text-violet-400">
                  {(c.as_of ?? c.created_at).slice(0, 10)}
                </div>
                <div className="text-sm">{c.statement}</div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="insights" className="mt-3 space-y-2">
            {twin.insights.length === 0 && <Empty label="No insights yet." />}
            {twin.insights.map((i) => (
              <div key={i.id} className="rounded-lg border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{i.title}</div>
                  <Badge variant="outline" className="text-[10px]">{i.debate_status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{i.body}</p>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {i.authored_by} · cites {i.claim_ids.length} claim{i.claim_ids.length > 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="evidence" className="mt-3 space-y-2">
            {evidence.length === 0 && <Empty label="No evidence yet." />}
            {evidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-border/60 px-3 py-2">
                <a href={e.url} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-violet-400 hover:underline">
                  {e.title || e.url} <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
                <div className="text-[11px] text-muted-foreground">
                  {e.domain} · quality {Math.round(e.quality_score * 100)}%
                  {e.published_date ? ` · ${e.published_date.slice(0, 10)}` : ""}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.preview}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <AnalystPanel orgId={props.orgId} />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{label}</div>;
}

/* ------------------------------- chat ------------------------------------ */

type ChatMessage = { role: "user" | "analyst"; text: string; answer?: ChatAnswer };

function AnalystPanel({ orgId }: { orgId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length, busy]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const answer = await askAnalyst(orgId, q);
      setMessages((m) => [...m, { role: "analyst", text: answer.answer, answer }]);
    } catch {
      setMessages((m) => [...m, { role: "analyst", text: "Something went wrong — try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex h-[640px] flex-col">
      <CardHeader className="flex flex-row items-center gap-2 border-b pb-3">
        <MessageSquare className="h-4 w-4 text-violet-500" />
        <CardTitle className="text-base">Ask the analyst</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Answers come from the intelligence graph with citations — try
            “Why is X a competitor? Show evidence.”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[95%] rounded-xl px-3 py-2 text-sm",
            m.role === "user" ? "ml-auto bg-violet-600/90 text-white" : "bg-muted")}>
            <div className="whitespace-pre-wrap">{m.text.replace(/\[C:[0-9a-f]+\]/g, "")}</div>
            {m.answer && m.answer.citations.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                {m.answer.citations.map((c) => (
                  <div key={c.claim_id} className="text-[11px] text-muted-foreground">
                    <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-500" />
                    {c.statement}{" "}
                    {c.evidence.map((e, j) => (
                      <a key={j} href={e.url} target="_blank" rel="noreferrer"
                        className="text-violet-400 hover:underline">[{j + 1}]</a>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {m.answer?.needs_research && m.answer.proposed_research && (
              <div className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600">
                Not in the graph yet — proposed research: {m.answer.proposed_research}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Consulting the graph…
          </div>
        )}
        <div ref={endRef} />
      </CardContent>
      <div className="border-t p-3">
        <div className="relative">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything about this organization…"
            className="min-h-[44px] resize-none rounded-xl pr-12 text-sm" />
          <Button size="icon" className="absolute bottom-2 right-2 h-8 w-8 rounded-lg"
            onClick={send} disabled={busy || !input.trim()}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
