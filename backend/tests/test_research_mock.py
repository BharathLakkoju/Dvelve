"""End-to-end test of the /api/research SSE pipeline in mock mode.

Forces llm_provider="mock" by making Ollama look unavailable, regardless of
whether the machine running these tests actually has Ollama installed —
without this, the test's behavior (and speed) would depend on local dev
machine state, which is exactly the kind of flakiness a test suite should
not have.
"""
import json

from services.ollama import ollama_service
from services.database import _get_pool


async def _force_ollama_unavailable(monkeypatch):
    async def _unavailable(*_args, **_kwargs):
        return False
    monkeypatch.setattr(ollama_service, "is_available", _unavailable)


def _parse_sse_events(raw_text: str):
    events = []
    for block in raw_text.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n")
        data_line = next((l for l in lines if l.startswith("data: ")), None)
        if data_line:
            events.append(json.loads(data_line[len("data: "):]))
    return events


async def test_offline_mock_pipeline_completes(client, registered_user, monkeypatch):
    await _force_ollama_unavailable(monkeypatch)

    async with client.stream(
        "POST", "/api/research",
        json={"query": "History of the printing press", "depth": "quick", "offline_mode": True},
        headers=registered_user["headers"],
    ) as r:
        assert r.status_code == 200
        session_id = r.headers["X-Session-Id"]
        raw = ""
        async for chunk in r.aiter_text():
            raw += chunk

    events = _parse_sse_events(raw)
    event_types = [e["event"] for e in events]

    assert "planner" in event_types
    assert "retriever" in event_types
    assert "ranker" in event_types
    assert "critic" in event_types
    assert "done" in event_types

    first_status = next(e for e in events if e["event"] == "status")
    assert first_status["data"]["llm_provider"] == "mock"

    planner_event = next(e for e in events if e["event"] == "planner")
    # "quick" depth == 3 sub-questions (agents/planner.py DEPTH_QUESTION_COUNT).
    assert planner_event["data"]["total_questions"] == 3

    # Persisted state matches what the stream reported.
    pool = await _get_pool()
    async with pool.acquire() as db:
        row = await db.fetchrow("SELECT status, llm_provider, report_markdown FROM sessions WHERE id=$1", session_id)
    assert row["status"] == "complete"
    assert row["llm_provider"] == "mock"
    assert row["report_markdown"]

    # cleanup
    async with pool.acquire() as db:
        await db.execute("DELETE FROM sessions WHERE id=$1", session_id)


async def test_research_requires_valid_body(client, registered_user):
    r = await client.post(
        "/api/research",
        json={"query": "ab", "offline_mode": True},  # below min_length=3
        headers=registered_user["headers"],
    )
    assert r.status_code == 422


async def test_research_works_without_auth(client, monkeypatch):
    """Anonymous research is allowed (get_current_user_optional) — sessions
    are just stored with user_id=None. Regression guard against accidentally
    tightening this to required auth, which would break anonymous use."""
    await _force_ollama_unavailable(monkeypatch)

    async with client.stream(
        "POST", "/api/research",
        json={"query": "Anonymous research query", "depth": "quick", "offline_mode": True},
    ) as r:
        assert r.status_code == 200
        session_id = r.headers["X-Session-Id"]
        async for _ in r.aiter_text():
            pass

    pool = await _get_pool()
    async with pool.acquire() as db:
        row = await db.fetchrow("SELECT user_id, status FROM sessions WHERE id=$1", session_id)
    assert row["user_id"] is None
    assert row["status"] == "complete"

    async with pool.acquire() as db:
        await db.execute("DELETE FROM sessions WHERE id=$1", session_id)
