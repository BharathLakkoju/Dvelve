"""
Shared pytest fixtures for the backend test suite.

IMPORTANT: these tests run against the real Neon Postgres database configured
via DATABASE_URL (there is no separate test database — see CLAUDE.md/
Instructions.md; the app deliberately has no SQLite fallback). Every fixture
that creates data uses a `pytest-<uuid>` namespaced email/username and cleans
up after itself, so the suite is safe to run against your real dev database.
Never assert against "all rows" in a table for this reason — only ever
query/assert on rows scoped to data this test run itself created.
"""
import os
import sys
import uuid

import httpx
import pytest
import pytest_asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402
from services.database import init_db, close_db, _get_pool  # noqa: E402
from routers.auth import limiter as auth_limiter  # noqa: E402
from routers.research import limiter as research_limiter  # noqa: E402

TEST_PASSWORD = "TestPassw0rd!"


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """FIX: each router file makes its own slowapi `Limiter()` instance with
    its own in-memory counters (see the `# FIX: Rate-limit` comments in
    routers/auth.py and routers/research.py) — those counters are real
    per-process state, not something to weaken for tests. Since every test
    client request comes from the same source IP, a full suite run creating
    many users would otherwise trip the real 5/minute signup limit purely
    from test-to-test interference. Resetting between tests keeps the limiter
    itself completely intact while giving each test the clean quota it would
    have gotten from a genuinely new client/time window in production."""
    auth_limiter.reset()
    research_limiter.reset()
    yield


@pytest_asyncio.fixture
async def _db_lifecycle():
    """Starts/stops the asyncpg pool for each test — mirrors what main.py's
    lifespan does, without needing an ASGI lifespan-aware client just to
    trigger it. FIX: deliberately function-scoped, not session-scoped —
    pytest-asyncio runs each test function in its own event loop by default,
    and asyncpg connections are bound to the loop they were created on.
    A session-scoped pool reused across tests running in different loops
    corrupted the connection protocol (asyncpg.InterfaceError: "another
    operation is in progress") the moment a second test tried to use it."""
    await init_db()
    yield
    await close_db()


@pytest_asyncio.fixture
async def client(_db_lifecycle):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


def unique_email() -> str:
    return f"pytest-{uuid.uuid4().hex[:12]}@dvelvetest.com"


def unique_username() -> str:
    return f"pytest{uuid.uuid4().hex[:10]}"


@pytest_asyncio.fixture
async def registered_user(client):
    """Creates a real user via the public signup endpoint (exercising the
    same validation/hashing path production traffic does) and tears it down
    afterward — including any sessions it created, since `sessions.user_id`
    has a foreign key on `users.id`."""
    email = unique_email()
    username = unique_username()
    r = await client.post("/api/auth/signup", json={
        "email": email, "username": username, "password": TEST_PASSWORD,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    info = {
        "email": email,
        "username": username,
        "password": TEST_PASSWORD,
        "token": data["access_token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }
    yield info

    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute("DELETE FROM sessions WHERE user_id=$1", info["user"]["id"])
        await db.execute("DELETE FROM users WHERE id=$1", info["user"]["id"])
