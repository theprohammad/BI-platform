/**
 * v2 Intelligence OS client — conversational intake, SSE research narrative,
 * twin workspace, cited analyst chat. Mirrors backend /v2 (stable interface).
 */
import axios from "axios";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

const client = axios.create({ baseURL: BASE_URL, timeout: 60_000 });

/* ---------- types (mirror app/graph/ontology.py — stable) ---------------- */

export interface TrustVector {
  confidence: number;
  source_quality: number;
  evidence_count: number;
  freshness: number;
  corroboration: number;
  reasoning_quality: number | null;
}

export interface GraphClaim {
  id: string;
  kind: "fact" | "event" | "metric";
  statement: string;
  value: string | null;
  topic: string;
  as_of: string | null;
  evidence_ids: string[];
  trust: TrustVector;
  created_at: string;
}

export interface GraphInsight {
  id: string;
  kind: string;
  title: string;
  body: string;
  claim_ids: string[];
  trust: TrustVector;
  authored_by: string;
  debate_status: string;
}

export interface EvidenceSummary {
  id: string;
  url: string;
  domain: string;
  title: string;
  published_date: string | null;
  retrieved_at: string;
  quality_score: number;
  preview: string;
}

export interface TwinView {
  organization: { id: string; name: string; website: string | null; industry: string | null };
  root_entity_id: string;
  coverage: Record<string, { claims: number; newest: string }>;
  profile_claims: GraphClaim[];
  timeline: GraphClaim[];
  insights: GraphInsight[];
}

export interface AnalyzeStarted {
  status: "started";
  run_id: string;
  organization_id: string;
  root_entity_id: string;
  brief: {
    organization: string;
    industry: string | null;
    location: string | null;
    objectives: string[];
  };
}

export interface AnalyzeClarify {
  status: "needs_clarification";
  question: string;
}

export interface RunEvent {
  type: string;
  run_id: string;
  payload: Record<string, unknown>;
  at: string;
}

export interface Citation {
  claim_id: string;
  statement: string;
  trust: TrustVector;
  evidence: { url: string; title: string }[];
}

export interface ChatAnswer {
  answer: string;
  citations: Citation[];
  needs_research: boolean;
  proposed_research: string | null;
}

/* ---------- calls --------------------------------------------------------- */

export async function startAnalysis(
  message: string,
  priorMessage?: string,
): Promise<AnalyzeStarted | AnalyzeClarify> {
  const { data } = await client.post("/v2/analyze", {
    message,
    prior_message: priorMessage ?? null,
  });
  return data;
}

export function streamRunEvents(
  runId: string,
  onEvent: (e: RunEvent) => void,
  onDone: (failed: boolean) => void,
): () => void {
  const source = new EventSource(`${BASE_URL}/v2/runs/${runId}/events`);
  source.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as RunEvent;
      onEvent(event);
      if (event.type === "run.completed" || event.type === "run.failed") {
        source.close();
        onDone(event.type === "run.failed");
      }
    } catch {
      /* keepalive */
    }
  };
  source.onerror = () => {
    source.close();
    onDone(true);
  };
  return () => source.close();
}

export async function fetchTwins() {
  const { data } = await client.get("/v2/twins");
  return data as { id: string; name: string; website: string | null; industry: string | null }[];
}

export async function fetchTwin(orgId: string): Promise<TwinView> {
  const { data } = await client.get(`/v2/twins/${orgId}`);
  return data;
}

export async function fetchTwinEvidence(orgId: string): Promise<EvidenceSummary[]> {
  const { data } = await client.get(`/v2/twins/${orgId}/evidence`);
  return data;
}

export async function askAnalyst(orgId: string, message: string): Promise<ChatAnswer> {
  const { data } = await client.post(`/v2/twins/${orgId}/chat`, { message }, { timeout: 120_000 });
  return data;
}
