"""Database access. From Phase 1 the Intelligence Graph is the system of
record, so persistence defaults ON: DATABASE_URL falls back to a local SQLite
file for zero-infra dev; docker-compose provides Postgres/pgvector.

TODO(prod): enforce Postgres in `environment=prod` (SQLite is a dev
convenience only — Blueprint says Postgres day one; this fallback exists so
the repo runs with zero setup and tests run hermetically).
"""
import json
import uuid

from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import Base, Organization, Run, Workspace
from app.graph.models import EventRow, JobRow
from app.graph.store import IntelligenceGraph

log = get_logger("db")
_engine = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None
_graph: IntelligenceGraph | None = None

DEFAULT_WORKSPACE_ID = "ws_default"
_DEV_FALLBACK_URL = "sqlite+aiosqlite:///./sentient.db"


def enabled() -> bool:
    return _sessionmaker is not None


def graph() -> IntelligenceGraph:
    if _graph is None:
        raise RuntimeError("database not initialized — call init_db() first")
    return _graph


def _sync_dsn(dsn: str) -> str:
    return dsn.replace("sqlite+aiosqlite", "sqlite").replace("postgresql+asyncpg", "postgresql")


def _run_alembic_upgrade(dsn: str) -> None:
    """Schema management is Alembic's job from Phase 2 (spec M0)."""
    from alembic import command
    from alembic.config import Config
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[2]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "migrations"))
    cfg.set_main_option("sqlalchemy.url", _sync_dsn(dsn))
    command.upgrade(cfg, "head")


async def init_db(url: str | None = None, *, use_alembic: bool | None = None) -> None:
    global _engine, _sessionmaker, _graph
    dsn = url or get_settings().database_url or _DEV_FALLBACK_URL
    _engine = create_async_engine(dsn)
    if dsn.startswith("sqlite"):
        # SQLite does not enforce FKs unless told to (junction integrity — C3)
        @event.listens_for(_engine.sync_engine, "connect")
        def _fk_on(dbapi_conn, _record):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    import app.graph.models  # noqa: F401  register graph tables on Base
    if use_alembic is None:
        use_alembic = get_settings().environment != "test"
    if use_alembic:
        import asyncio
        await asyncio.to_thread(_run_alembic_upgrade, dsn)
    else:
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    async with _sessionmaker() as s:
        if await s.get(Workspace, DEFAULT_WORKSPACE_ID) is None:
            s.add(Workspace(id=DEFAULT_WORKSPACE_ID))
            await s.commit()
    _graph = IntelligenceGraph(_sessionmaker)
    # S6: persist every bus event to the outbox table (durable SSE/replay)
    from app.core.events import bus
    if _persist_event not in bus._subscribers:
        bus.subscribe(_persist_event)
    log.info("persistence enabled dsn=%s", dsn.split("@")[-1])


async def _persist_event(event) -> None:
    if _sessionmaker is None:
        return
    try:
        async with _sessionmaker() as s:
            s.add(EventRow(run_id=event.run_id, type=event.type,
                           payload=event.payload, at=event.at))
            await s.commit()
    except Exception:      # event persistence must never break a run
        pass


async def upsert_job(job_id: str, *, kind: str = "run", status: str = "running",
                     payload: dict | None = None, result: dict | None = None,
                     error: str | None = None) -> None:
    if _sessionmaker is None:
        return
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    try:
        async with _sessionmaker() as s:
            row = await s.get(JobRow, job_id)
            if row is None:
                row = JobRow(id=job_id, kind=kind, status=status,
                             payload=payload or {}, result=result or {},
                             error=error, heartbeat_at=now, created_at=now)
                s.add(row)
            else:
                row.status = status
                row.heartbeat_at = now
                if result is not None:
                    row.result = result
                if error is not None:
                    row.error = error
            await s.commit()
    except Exception as exc:
        log.warning("job upsert failed: %s", exc)


async def get_job(job_id: str):
    if _sessionmaker is None:
        return None
    async with _sessionmaker() as s:
        return await s.get(JobRow, job_id)


async def reap_stale_jobs(timeout_seconds: int = 120) -> int:
    """Mark 'running' jobs with a stale heartbeat as failed (crash recovery)."""
    if _sessionmaker is None:
        return 0
    from datetime import datetime, timedelta, timezone
    from app.graph.models import JobRow
    cutoff = (datetime.now(timezone.utc)
              - timedelta(seconds=timeout_seconds)).isoformat()
    async with _sessionmaker() as s:
        rows = (await s.execute(select(JobRow).where(
            JobRow.status == "running",
            JobRow.heartbeat_at < cutoff))).scalars().all()
        for row in rows:
            row.status, row.error = "failed", "reaped: heartbeat timeout"
        await s.commit()
        if rows:
            log.warning("reaped %d stale jobs", len(rows))
        return len(rows)


async def prune_events(older_than_days: int = 14) -> int:
    """Event outbox retention (audit B-item). claim_transitions is lineage of
    record and lives in its own retention-EXEMPT table — never touched here."""
    if _sessionmaker is None:
        return 0
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import delete as sa_delete
    from app.graph.models import EventRow
    cutoff = (datetime.now(timezone.utc)
              - timedelta(days=older_than_days)).isoformat()
    async with _sessionmaker() as s:
        result = await s.execute(sa_delete(EventRow).where(EventRow.at < cutoff))
        await s.commit()
        return result.rowcount or 0


async def events_for_run(run_id: str, after_seq: int = 0) -> list[dict]:
    if _sessionmaker is None:
        return []
    async with _sessionmaker() as s:
        rows = (await s.execute(select(EventRow)
                                .where(EventRow.run_id == run_id,
                                       EventRow.seq > after_seq)
                                .order_by(EventRow.seq))).scalars().all()
        return [{"seq": r.seq, "type": r.type, "run_id": r.run_id,
                 "payload": r.payload, "at": r.at} for r in rows]


async def get_or_create_organization(workspace_id: str, name: str, *,
                                     website: str | None = None,
                                     industry: str | None = None,
                                     root_entity_id: str | None = None) -> Organization:
    async with _sessionmaker() as s:
        row = (await s.execute(select(Organization).where(
            Organization.workspace_id == workspace_id, Organization.name == name,
        ))).scalar_one_or_none()
        if row is None:
            row = Organization(id=uuid.uuid4().hex[:32], workspace_id=workspace_id,
                               name=name, website=website, industry=industry,
                               root_entity_id=root_entity_id)
            s.add(row)
            await s.commit()
        elif root_entity_id and not row.root_entity_id:
            row.root_entity_id = root_entity_id   # backfill legacy rows at intake
            await s.commit()
        return row


async def get_organization(org_id: str) -> Organization | None:
    async with _sessionmaker() as s:
        return await s.get(Organization, org_id)


async def list_organizations(workspace_id: str) -> list[dict]:
    async with _sessionmaker() as s:
        rows = (await s.execute(select(Organization).where(
            Organization.workspace_id == workspace_id))).scalars().all()
        return [{"id": r.id, "name": r.name, "website": r.website,
                 "industry": r.industry, "created_at": str(r.created_at)} for r in rows]


async def persist_v2_run(run_id: str, workspace_id: str, org_id: str,
                         brief: dict, manifest: dict, costs: dict, stats: dict) -> None:
    async with _sessionmaker() as s:
        s.add(Run(id=run_id, workspace_id=workspace_id, organization_id=org_id,
                  request=brief, manifest=manifest, costs=costs,
                  status="completed", result=json.dumps(stats, default=str)))
        await s.commit()


# ---- legacy v1 support (kept until frontend migrates; then delete) --------
async def persist_run(ctx, results: dict) -> None:
    if _sessionmaker is None:
        return
    try:
        org = await get_or_create_organization(DEFAULT_WORKSPACE_ID,
                                               ctx.request.company_name,
                                               website=str(ctx.request.website),
                                               industry=ctx.request.industry)
        async with _sessionmaker() as s:
            s.add(Run(id=ctx.run_id, workspace_id=DEFAULT_WORKSPACE_ID,
                      organization_id=org.id,
                      request=ctx.request.model_dump(mode="json"),
                      manifest=results["meta"]["manifest"],
                      costs=results["meta"]["costs"],
                      status="degraded" if results["meta"]["degraded"] else "completed",
                      result=json.dumps(results, default=str)))
            await s.commit()
    except Exception as exc:
        log.warning("run_id=%s persist failed: %s", ctx.run_id, exc)
