# Changelog

## 0.6.0-phase3 — Intelligence Layer (Critic, Swarm, Playbooks) — 2026-07-17
Built as one continuous effort on the frozen Phase 2.5 baseline. All Phase 2.5
invariants preserved; no public breakage (additive only).

### Added
- **The Critic** (`agents/critic.py`, judge tier): dispute adjudication with
  deterministic guardrails (verdicts must cite evidence linked to the disputed
  claims; cannot overrule a trust gap beyond TRUST_GATE_BAND without exclusive
  evidence; malformed/uncited/overreaching verdicts DEFER, never destroy).
  Also insight review → debate_status validated|rejected. Tools:
  `graph.resolve_dispute`, `graph.review_insight`.
- **Specialist swarm** (`agents/specialists.py`): BaseSpecialist contract;
  competitor, market, pricing specialists; failure-isolated; playbook-selected.
- **Playbooks** (`playbooks/registry.py`): named, versioned research programs as
  DATA — objectives, budgets, specialist set, extra watched predicates, refresh
  thresholds. `GET /v2/playbooks`; `analyze(playbook=…)` (422 on unknown).
  Stamped into the run manifest (rule 2).
- **Recommendations** (`agents/recommender.py`): synthesizes actionable
  recommendations from critic-VALIDATED insights; full rule-5 chain
  Recommendation → Insights → Claims → Evidence stays queryable.
- **Debate-aware chat**: analyst ranks validated insights + recommendations
  first; rejected/stale never surfaced.

### Hardened (audit B-tier, closed this phase)
- Reconciliation sweep (`diff.reconcile`): re-litigates functional predicates
  left with multiple active values by parallel writes (eventual-consistency hole).
- Insight staleness: a claim leaving `active` flags citing insights `stale`
  (disputes still auto-resolve).
- Job heartbeats + stale-job reaper; asyncio task refs held (GC safety).
- Event-outbox retention prune (`claim_transitions` remains retention-exempt).
- Read-time confidence in keyword ranking (was write-time).
- `value_entity_id` for entity-valued predicates: same canonical entity under
  different spellings no longer conflicts (diff + write_edge canonicalized).

### Migrations
- 0003: `claims.value_entity_id` (additive, reversible).

### Tests
64 passing (9 new Phase 3 + extended e2e), consecutive full runs.

### Fixed (final break-review, pre-freeze)
- supersede_claim made race-safe: concurrent adjudication/supersession of one
  claim now uses a conditional status flip; only the race winner logs the
  transition (history stayed single-rowed; state was always correct).


## 0.5.0-phase2.5 — Lifecycle Correctness (FROZEN BASELINE) — 2026-07-17
Phase 2.5 is CLOSED. This version is the stable baseline for Phase 3.

### Semantics
- Claim identity v2 (`CLAIM_IDENTITY_VERSION=2`): predicated claims with non-null
  values are identified by proposition — hash(ws | subject | predicate |
  normalized value). Prose and valueless-predicated claims keep statement identity.
- Versioned value normalizer v1 (`graph/predicates.py`; identity depends on it).
- Predicate classes: FUNCTIONAL may supersede/dispute; MULTI_VALUED accumulate;
  unknown predicates default multi-valued (destruction-proof).
- Claim state machine is law: `graph/CLAIM_LIFECYCLE.md` (7 transitions incl.
  recency-gated resurrection against the TERMINAL successor, stale-attach for
  unknown-dated re-assertions, new-domain-gated reactivation).
- `superseded_by` = mutable current-successor cache (non-null ⇔ superseded);
  lineage of record = append-only, retention-exempt `claim_transitions`.
- Disputes: one open dispute per claim pair; auto-resolve when either claim
  leaves `active`.
- Tenancy: entity/claim-referencing write tools validate workspace ownership;
  entity ids chase merge tombstones to the surviving entity on reads and writes.
- One claim door: `write_edge` composes the `write_claim` tool for backing
  claims (conformance-tested).

### Migrations
- 0002: `claim_transitions` table; deterministic identity-v2 recompute with
  collision merge (evidence union + lineage; read-cache synced). Downgrade
  restores v1 hashes on unmerged rows; merged rows are permanent (documented).

### Fixed (final implementation review)
- Chain-middle re-assertions resurrecting against stale incumbents (+ bogus disputes).
- Post-merge writes landing on entity tombstones.
- Entity-merge crash when duplicate edges shared evidence.
- Diff/identity value-normalization split (single authority now).
- Migration evidence read-cache drift.

### Tests
55 passing (full matrix incl. ingestion-order permutation invariance,
oscillation resurrection, migration data step, tenancy, dispute idempotency).

## 0.4.0-phase2 — Graph Depth & Twin Memory
S1 quality coverage + read-time trust freshness · S2 claim-backed edges +
predicates · S3 chunked/cached extraction v3 + embeddings · S4 layered entity
resolution + merge (asymmetric, auto-merge OFF) · S5 hybrid retrieval
(FTS ∥ vector ∥ traversal → RRF, 43-case eval gate) · S6 durable jobs/events +
SSE replay · S7 diff engine + change reports · S8 refresh + web.fetch ·
planner v2 (P1–P5) · Alembic (0001).

## 0.3.0-phase1.5 — Graph Integrity Hardening
Tools-only writes (conformance test) · junction tables + FK enforcement ·
claim identity v1 + status lifecycle · unique constraints + race-tolerant
upserts · root_entity_id resolution.

## 0.2.0-phase1 — Steel Thread
Conversation → research loop → intelligence graph → workspace → cited chat.
Five-object ontology (Evidence, Entity, Edge, Claim, Insight + TrustVector).

## 0.1.0-phase0 — Foundations
Provider layer (LLM router tiers, search) · config/versions/ledger/events ·
agent isolation · Docker + pgvector scaffold.
