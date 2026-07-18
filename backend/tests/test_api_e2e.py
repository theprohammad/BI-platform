"""End-to-end steel thread over the real HTTP surface with fake providers:
conversation → research → graph → twin endpoints → cited chat (owner rule 7:
smallest complete product, verified as one flow)."""
import asyncio

import httpx
import pytest

from app.db import session as db
from app.main import app
from tests.fakes_v2 import UNI, FakeSearchV2, ScriptedLLM


@pytest.fixture
async def client(monkeypatch, tmp_path):
    await db.init_db(f"sqlite+aiosqlite:///{tmp_path}/e2e.db", use_alembic=False)
    llm = ScriptedLLM()

    orig = ScriptedLLM.complete_json_route
    async def routed(self, prompt):
        if "competitive intelligence specialist" in prompt:
            claims = await db.graph().claims(db.DEFAULT_WORKSPACE_ID, limit=3)
            self.insight_claim_ids = [c.id for c in claims]
        if "AI analyst" in prompt:
            claims = await db.graph().claims(db.DEFAULT_WORKSPACE_ID, limit=1)
            cid = claims[0].id if claims else "x"
            return {"answer": f"Founded in 2004 [C:{cid}].",
                    "cited_claim_ids": [cid], "needs_research": False,
                    "proposed_research": None}
        return await orig(self, prompt)
    monkeypatch.setattr(ScriptedLLM, "complete_json_route", routed)
    monkeypatch.setattr("app.api.v2.build_provider", lambda: llm)
    monkeypatch.setattr("app.api.v2.build_search_provider", lambda: FakeSearchV2())

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        yield c


async def test_steel_thread_end_to_end(client):
    # 1. conversation
    r = await client.post("/v2/analyze", json={"message":
        "Analyze Acme University Lahore. Focus on competitors."})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "started" and body["brief"]["organization"] == UNI
    run_id, org_id = body["run_id"], body["organization_id"]

    # 2. research job completes
    for _ in range(100):
        await asyncio.sleep(0.05)
        status = (await client.get(f"/v2/runs/{run_id}")).json()
        if status["status"] != "running":
            break
    assert status["status"] == "completed", status
    assert status["result"]["claims"] > 0

    # 3. graph → twin workspace
    twin = (await client.get(f"/v2/twins/{org_id}")).json()
    assert twin["organization"]["name"] == UNI
    assert len(twin["profile_claims"]) > 0
    assert any(c["kind"] == "event" for c in twin["timeline"])
    assert twin["insights"] and twin["insights"][0]["claim_ids"]

    evidence = (await client.get(f"/v2/twins/{org_id}/evidence")).json()
    assert evidence and evidence[0]["url"].startswith("https://")

    # 4. cited chat
    chat = (await client.post(f"/v2/twins/{org_id}/chat",
                              json={"message": "When was it founded?"})).json()
    assert chat["citations"], chat
    assert chat["citations"][0]["evidence"][0]["url"]
    assert "[C:" in chat["answer"] or chat["answer"]

    # 5. run events were recorded (SSE source material, durable table)
    events = (await client.get(f"/v2/runs/{run_id}/events")).text
    assert "research.stage" in events and "run.completed" in events

    # 6. SECOND RUN (spec §7): delta research must be measurably cheaper
    r2 = await client.post("/v2/analyze", json={"message":
        "Analyze Acme University Lahore again. Focus on competitors."})
    run2 = r2.json()["run_id"]
    for _ in range(100):
        await asyncio.sleep(0.05)
        status2 = (await client.get(f"/v2/runs/{run2}")).json()
        if status2["status"] != "running":
            break
    assert status2["status"] == "completed", status2
    first, second = status["result"], status2["result"]
    assert second["cache_hits"] > 0                    # extraction cache working
    assert second["evidence_reused"] > 0               # corpus dedup working
    assert second["searches"] <= first["searches"]     # delta ≤ first-run cost

    # 7. Phase 3: playbooks are listable, stamped into results, and validated
    books = (await client.get("/v2/playbooks")).json()
    assert any(b["id"] == "full_analysis" for b in books)
    assert first["playbook"]["id"] == "full_analysis"
    assert "adjudication" in first and "review" in first
    assert (await client.post("/v2/analyze", json={
        "message": "Analyze Acme University Lahore.",
        "playbook": "nonexistent"})).status_code == 422

    # 7b. change report endpoint
    changes = (await client.get(
        f"/v2/twins/{org_id}/changes",
        params={"since": "2000-01-01T00:00:00+00:00"})).json()
    assert changes["new_claims"] > 0


async def test_reads_never_mutate_graph(client):
    """C6: a GET must not create entities (read-path purity)."""
    from sqlalchemy import func, select
    from app.graph.models import EntityRow

    r = await client.post("/v2/analyze", json={"message": "Analyze Acme University."})
    body = r.json()
    run_id, org_id = body["run_id"], body["organization_id"]
    for _ in range(100):
        await asyncio.sleep(0.05)
        if (await client.get(f"/v2/runs/{run_id}")).json()["status"] != "running":
            break

    async def entity_count():
        async with db._sessionmaker() as s:
            return (await s.execute(select(func.count()).select_from(EntityRow))).scalar()

    before = await entity_count()
    for _ in range(3):
        assert (await client.get(f"/v2/twins/{org_id}")).status_code == 200
        assert (await client.get(f"/v2/twins/{org_id}/evidence")).status_code == 200
    assert await entity_count() == before
