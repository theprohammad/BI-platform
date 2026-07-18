"""v2 API — the steel-thread surface. Thin adapters over the Tool Layer and
the run orchestration; NO business logic lives here (owner rule 3/8)."""
import asyncio
import json
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.chat.analyst import AnalystChat
from app.core.config import get_settings
from app.core.events import Event, bus
from app.core.ledger import CostLedger
from app.core.logging import get_logger
from app.core.versions import run_manifest
from app.db import session as db
from app.graph.ontology import EntityType
from app.intake.intake_agent import IntakeAgent
from app.providers.llm.router import LLMRouter, build_provider
from app.providers.search.tavily_provider import build_search_provider
from app.research.loop import ResearchLoop
from app.runner.task_runner import runner
from app.tools.registry import Budget, ToolContext, registry  # noqa: F401 (registry import loads tools)
import app.tools.graph_tools  # noqa: F401  register graph tools
import app.tools.web_tools    # noqa: F401  register web tools

log = get_logger("api.v2")
router = APIRouter(prefix="/v2")

WORKSPACE = db.DEFAULT_WORKSPACE_ID


class AnalyzeIn(BaseModel):
    message: str
    # continuation of a clarification exchange, optional:
    prior_message: str | None = None
    playbook: str | None = None       # Phase 3: named research program


class ChatIn(BaseModel):
    message: str


def _tool_ctx(run_id: str, organization_id: str | None = None,
              playbook_id: str | None = None) -> ToolContext:
    from app.playbooks.registry import get_playbook
    settings = get_settings()
    ledger = CostLedger()
    playbook = get_playbook(playbook_id)
    return ToolContext(
        workspace_id=WORKSPACE, run_id=run_id, graph=db.graph(),
        search=build_search_provider(),
        llm=LLMRouter(build_provider(), ledger=ledger, run_id=run_id),
        budget=Budget(max_searches=playbook.max_searches,
                      max_llm_calls=playbook.max_llm_calls,
                      deadline_epoch=time.time() + settings.run_wallclock_budget_seconds),
        organization_id=organization_id,
        ledger=ledger,
        playbook=playbook,
    )


@router.get("/playbooks")
async def playbooks():
    """Phase 3: available research programs."""
    from app.playbooks.registry import list_playbooks
    return list_playbooks()


@router.post("/analyze")
async def analyze(body: AnalyzeIn):
    """Conversational intake → either a clarifying question, or a started run."""
    if not db.enabled():
        raise HTTPException(503, "Persistence is required for v2 (set DATABASE_URL)")
    from app.playbooks.registry import get_playbook
    try:
        get_playbook(body.playbook)                    # 422 before any work
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    run_id = uuid.uuid4().hex[:12]
    ctx = _tool_ctx(run_id, playbook_id=body.playbook)

    message = f"{body.prior_message}\n{body.message}" if body.prior_message else body.message
    brief = await IntakeAgent().run(ctx.llm, message)

    if brief.needs_clarification:
        return {"status": "needs_clarification",
                "question": brief.clarifying_question or
                "Which organization would you like me to analyze?"}

    root = await registry.invoke(ctx, "graph.resolve_entity",
                                 name=brief.organization,
                                 type=EntityType.ORGANIZATION)
    org = await db.get_or_create_organization(WORKSPACE, brief.organization,
                                              website=brief.website,
                                              industry=brief.industry,
                                              root_entity_id=root.id)
    ctx.organization_id = org.id

    async def job():
        stats = await ResearchLoop().run(ctx, brief=brief.model_dump(),
                                         root_entity_id=root.id)
        await db.persist_v2_run(run_id, WORKSPACE, org.id, brief.model_dump(),
                                run_manifest(), ctx.ledger.summary(), stats)
        await bus.publish(Event("run.completed", run_id,
                                {"organization_id": org.id, **{k: v for k, v in stats.items() if k != "insights"}}))
        return stats

    runner.start(job, run_id=run_id)
    return {"status": "started", "run_id": run_id,
            "organization_id": org.id, "root_entity_id": root.id,
            "brief": brief.model_dump()}


@router.get("/runs/{run_id}")
async def run_status(run_id: str):
    job = runner.status(run_id)          # same-process cache
    if job is not None:
        return {"run_id": run_id, "status": job.status, "error": job.error,
                "result": job.result if job.status == "completed" else None}
    row = await db.get_job(run_id)       # S6: DB is the source of truth
    if row is None:
        raise HTTPException(404, "unknown run")
    return {"run_id": run_id, "status": row.status, "error": row.error,
            "result": row.result if row.status == "completed" else None}


@router.get("/runs/{run_id}/events")
async def run_events(run_id: str):
    """SSE: replay from the events TABLE (survives restarts — B3 fix), then
    live-follow the bus with a table-tail fallback; terminal state from the
    jobs table so streams always end."""
    async def stream():
        queue: asyncio.Queue = asyncio.Queue()

        async def handler(event: Event):
            if event.run_id == run_id:
                await queue.put(event.as_dict())

        last_seq = 0
        for past in await db.events_for_run(run_id):
            last_seq = past["seq"]
            yield f"data: {json.dumps(past)}\n\n"
            if past["type"] in ("run.completed", "run.failed"):
                return
        bus.subscribe(handler)
        try:
            idle_cycles = 0
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=5)
                    idle_cycles = 0
                    yield f"data: {json.dumps(event)}\n\n"
                    if event["type"] in ("run.completed", "run.failed"):
                        return
                except asyncio.TimeoutError:
                    idle_cycles += 1
                    # table tail (another process may be running the job)
                    for row in await db.events_for_run(run_id, after_seq=last_seq):
                        last_seq = row["seq"]
                        yield f"data: {json.dumps(row)}\n\n"
                        if row["type"] in ("run.completed", "run.failed"):
                            return
                    job = await db.get_job(run_id)
                    if job is not None and job.status in ("completed", "failed"):
                        yield f"data: {json.dumps({'type': f'run.{job.status}', 'run_id': run_id, 'payload': {}})}\n\n"
                        return
                    if idle_cycles >= 60:      # 5-min hard stop, never hangs
                        return
                    yield ": keepalive\n\n"
        finally:
            if handler in bus._subscribers:
                bus._subscribers.remove(handler)

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/twins")
async def twins():
    return await db.list_organizations(WORKSPACE)


@router.get("/twins/{org_id}")
async def twin(org_id: str):
    org = await db.get_organization(org_id)
    if org is None:
        raise HTTPException(404, "unknown organization")
    if not org.root_entity_id:
        raise HTTPException(409, "twin has no root entity (re-run analysis)")
    ctx = _tool_ctx(f"view-{org_id[:8]}", org_id)
    root_id = org.root_entity_id            # C6: reads never resolve-by-name
    profile = await registry.invoke(ctx, "graph.claims",
                                    subject_entity_id=root_id, limit=100)
    timeline = await registry.invoke(ctx, "graph.timeline", subject_entity_id=root_id)
    insights = await registry.invoke(ctx, "graph.insights")
    coverage = await registry.invoke(ctx, "graph.coverage", subject_entity_id=root_id)
    return {
        "organization": {"id": org.id, "name": org.name, "website": org.website,
                         "industry": org.industry},
        "root_entity_id": root_id,
        "coverage": coverage,
        "profile_claims": [c.model_dump() for c in profile],
        "timeline": [c.model_dump() for c in timeline],
        "insights": [i.model_dump() for i in insights],
    }


@router.get("/twins/{org_id}/evidence")
async def twin_evidence(org_id: str):
    org = await db.get_organization(org_id)
    if org is None:
        raise HTTPException(404, "unknown organization")
    if not org.root_entity_id:
        raise HTTPException(409, "twin has no root entity (re-run analysis)")
    ctx = _tool_ctx(f"view-{org_id[:8]}", org_id)
    claims = await registry.invoke(ctx, "graph.claims",
                                   subject_entity_id=org.root_entity_id, limit=300)
    ev_ids = list(dict.fromkeys(eid for c in claims for eid in c.evidence_ids))[:100]
    evidence = await registry.invoke(ctx, "graph.evidence", evidence_ids=ev_ids)
    return [{"id": e.id, "url": e.url, "domain": e.domain, "title": e.title,
             "published_date": e.published_date, "retrieved_at": e.retrieved_at,
             "quality_score": e.quality_score,
             "preview": e.content[:400]} for e in evidence]


@router.post("/twins/{org_id}/chat")
async def twin_chat(org_id: str, body: ChatIn):
    org = await db.get_organization(org_id)
    if org is None:
        raise HTTPException(404, "unknown organization")
    if not org.root_entity_id:
        raise HTTPException(409, "twin has no root entity (re-run analysis)")
    ctx = _tool_ctx(f"chat-{uuid.uuid4().hex[:8]}", org_id)
    answer = await AnalystChat().ask(ctx, organization=org.name,
                                     root_entity_id=org.root_entity_id,
                                     question=body.message)
    return answer.model_dump()


@router.post("/twins/{org_id}/refresh")
async def twin_refresh(org_id: str):
    """S8 Monitoring Stage A: delta run targeting stale/weak/disputed topics
    (quality coverage) + re-fetch of high-fan-in evidence URLs."""
    org = await db.get_organization(org_id)
    if org is None:
        raise HTTPException(404, "unknown organization")
    if not org.root_entity_id:
        raise HTTPException(409, "twin has no root entity (run an analysis first)")
    from datetime import datetime, timezone
    run_id = uuid.uuid4().hex[:12]
    ctx = _tool_ctx(run_id, org.id)
    since = datetime.now(timezone.utc).isoformat()

    async def job():
        from app.research.refresh import run_refresh
        stats = await run_refresh(ctx, organization=org.name,
                                  root_entity_id=org.root_entity_id,
                                  since_iso=since)
        await db.persist_v2_run(run_id, WORKSPACE, org.id,
                                {"mode": "refresh"}, run_manifest(),
                                ctx.ledger.summary(), stats)
        await bus.publish(Event("run.completed", run_id,
                                {"organization_id": org.id, "mode": "refresh"}))
        return stats

    runner.start(job, run_id=run_id)
    return {"status": "started", "run_id": run_id, "organization_id": org.id,
            "mode": "refresh"}


@router.get("/twins/{org_id}/changes")
async def twin_changes(org_id: str, since: str):
    """S7: change report — what the graph learned since a timestamp."""
    org = await db.get_organization(org_id)
    if org is None:
        raise HTTPException(404, "unknown organization")
    if not org.root_entity_id:
        raise HTTPException(409, "twin has no root entity")
    ctx = _tool_ctx(f"chg-{org_id[:8]}", org_id)
    from app.graph.diff import build_change_report
    return await build_change_report(ctx, org.root_entity_id, since)


@router.get("/tools")
async def tools():
    """The Tool Layer, self-describing (rule 4 documentation)."""
    return registry.describe()
