"""Regression test for the "Stop Research" cancellation fix
(routers/research.py's `except asyncio.CancelledError` handler).

This deliberately does NOT use the httpx.ASGITransport-based `client`
fixture used everywhere else in this suite: ASGITransport runs the whole
request in-process with no real transport layer, so it never produces a
genuine client-disconnect signal — a manual reproduction (see git history /
PR notes) confirmed the server-side pipeline ran to completion regardless of
the test client bailing out early. A real client disconnect only happens
over an actual socket, so this test boots the app with a real uvicorn server
in a background thread and hits it with a real httpx client, matching the
setup that was used to originally verify this fix (and matches how a real
browser aborting `fetch()` behaves).
"""
import asyncio
import threading
import time

import httpx
import pytest
import pytest_asyncio
import uvicorn

from main import app as fastapi_app

_PORT = 8781
_BASE_URL = f"http://127.0.0.1:{_PORT}"


@pytest.fixture(scope="module")
def live_server():
    config = uvicorn.Config(fastapi_app, host="127.0.0.1", port=_PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    for _ in range(100):
        try:
            httpx.get(f"{_BASE_URL}/", timeout=0.2)
            break
        except Exception:
            time.sleep(0.1)
    else:
        raise RuntimeError("live test server did not start in time")

    yield _BASE_URL

    server.should_exit = True
    thread.join(timeout=5)

    # FIX: this server ran in its own thread with its own event loop (and its
    # own asyncpg pool, via FastAPI's lifespan). Reaching into services.database
    # from *this* test process's loop while that pool was still bound to the
    # server thread's (now-dead) loop reproduces the exact cross-loop asyncpg
    # corruption this suite hit earlier (see conftest.py's `_db_lifecycle`
    # comment) — so cleanup only happens here, after the server thread (and
    # its close_db()-triggered lifespan shutdown) has fully exited and reset
    # the module-level pool.
    import asyncio

    async def _cleanup():
        from services.database import init_db, close_db, _get_pool
        await init_db()
        pool = await _get_pool()
        async with pool.acquire() as db:
            await db.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'pytest-live-%')")
            await db.execute("DELETE FROM users WHERE email LIKE 'pytest-live-%'")
        await close_db()

    asyncio.run(_cleanup())


@pytest_asyncio.fixture
async def live_user(live_server):
    import uuid
    email = f"pytest-live-{uuid.uuid4().hex[:12]}@dvelvetest.com"
    async with httpx.AsyncClient(base_url=live_server) as client:
        r = await client.post("/api/auth/signup", json={
            "email": email, "username": f"pytestlive{uuid.uuid4().hex[:8]}", "password": "TestPassw0rd!",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        yield {"headers": headers, "user_id": data["user"]["id"]}

        await client.delete("/api/sessions", headers=headers)


async def test_disconnect_marks_session_cancelled(live_server, live_user):
    async with httpx.AsyncClient(base_url=live_server, timeout=30.0) as client:
        session_id = None
        async with client.stream(
            "POST", "/api/research",
            json={"query": "Live cancellation regression test", "depth": "standard", "offline_mode": True},
            headers=live_user["headers"],
        ) as r:
            assert r.status_code == 200
            session_id = r.headers["X-Session-Id"]
            seen = 0
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    seen += 1
                if seen >= 2:
                    break  # real socket close — the point of this test
        assert session_id is not None

        status = None
        for _ in range(40):
            r = await client.get(f"/api/sessions/{session_id}", headers=live_user["headers"])
            assert r.status_code == 200
            status = r.json()["status"]
            if status != "running":
                break
            await asyncio.sleep(0.25)

        assert status == "cancelled", f"expected 'cancelled', server reported {status!r}"
