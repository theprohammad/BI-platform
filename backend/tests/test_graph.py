"""Mandated tests: graph persistence, evidence storage/dedup, retrieval."""
import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.models import Base
from app.graph.ontology import (Claim, Entity, EntityType, Evidence, Insight,
                                TrustVector)
from app.graph.store import IntelligenceGraph, content_hash


@pytest.fixture
async def store(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/graph.db")
    @event.listens_for(engine.sync_engine, "connect")
    def _fk(conn, _): conn.execute("PRAGMA foreign_keys=ON")
    import app.graph.models  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield IntelligenceGraph(async_sessionmaker(engine, expire_on_commit=False))
    await engine.dispose()


def ev(content: str, url="https://x.edu/a") -> Evidence:
    return Evidence(id="", url=url, canonical_url=url, domain="x.edu",
                    title="t", content=content)


async def test_evidence_dedup_is_identity(store):
    id1, created1 = await store.ingest_evidence(ev("Acme was founded in 2004."))
    id2, created2 = await store.ingest_evidence(ev("Acme  was founded   in 2004.",
                                                   url="https://mirror.com/b"))
    assert created1 is True and created2 is False
    assert id1 == id2 == content_hash("Acme was founded in 2004.")
    fetched = await store.get_evidence([id1])
    assert fetched[0].url == "https://x.edu/a"  # first provenance preserved


async def test_graph_persistence_roundtrip(store):
    entity = await store.resolve_entity("ws", "Acme University", EntityType.ORGANIZATION)
    again = await store.resolve_entity("ws", "acme  university")
    assert again.id == entity.id  # name-key resolution

    ev_id, _ = await store.ingest_evidence(ev("Acme enrolls 25000 students."))
    claim_id = await store.add_claim(Claim(
        id="", workspace_id="ws", subject_entity_id=entity.id,
        statement="Acme enrolls 25,000 students.", topic="profile",
        evidence_ids=[ev_id], trust=TrustVector(confidence=0.7)))
    fetched = await store.claims("ws", subject_entity_id=entity.id)
    assert fetched[0].id == claim_id and fetched[0].evidence_ids == [ev_id]

    with pytest.raises(Exception):  # claim without evidence is impossible
        await store.add_claim(Claim(id="", workspace_id="ws",
                                    subject_entity_id=entity.id,
                                    statement="unevidenced", evidence_ids=[]))

    with pytest.raises(ValueError):  # insight citing unknown claims is rejected
        await store.add_insight(Insight(id="", workspace_id="ws",
                                        organization_id="o", title="x", body="y",
                                        claim_ids=["missing"], authored_by="t"))

    ins_id = await store.add_insight(Insight(id="", workspace_id="ws",
                                             organization_id="o", title="x", body="y",
                                             claim_ids=[claim_id], authored_by="t"))
    assert (await store.insights("ws", "o"))[0].id == ins_id


async def test_coverage_and_retrieval(store):
    entity = await store.resolve_entity("ws", "Acme University", EntityType.ORGANIZATION)
    ev_id, _ = await store.ingest_evidence(ev("Tuition is 450k PKR per year."))
    await store.add_claim(Claim(id="", workspace_id="ws", subject_entity_id=entity.id,
                                statement="Acme tuition is 450,000 PKR per year.",
                                topic="pricing", evidence_ids=[ev_id],
                                trust=TrustVector(confidence=0.8)))
    cov = await store.coverage("ws", entity.id)
    assert cov["pricing"]["claims"] == 1

    hits = await store.search_claims("ws", "what is the tuition price")
    assert hits and "tuition" in hits[0].statement.lower()
