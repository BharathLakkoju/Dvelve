"""Ownership/BOLA checks on /api/sessions* — regression coverage for the
`# FIX: Enforce ownership` comments in routers/sessions.py."""
import pytest_asyncio

from services.database import create_session
from tests.conftest import unique_email, unique_username, TEST_PASSWORD


@pytest_asyncio.fixture
async def other_user(client):
    email, username = unique_email(), unique_username()
    r = await client.post("/api/auth/signup", json={
        "email": email, "username": username, "password": TEST_PASSWORD,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    info = {
        "email": email, "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }
    yield info
    from services.database import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute("DELETE FROM sessions WHERE user_id=$1", info["user"]["id"])
        await db.execute("DELETE FROM users WHERE id=$1", info["user"]["id"])


async def test_list_sessions_scoped_to_owner(client, registered_user, other_user):
    mine = await create_session("owner's query", "llama3:8b", "quick", user_id=registered_user["user"]["id"])
    theirs = await create_session("other's query", "llama3:8b", "quick", user_id=other_user["user"]["id"])

    r = await client.get("/api/sessions", headers=registered_user["headers"])
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()]
    assert mine in ids
    assert theirs not in ids


async def test_get_session_denies_non_owner(client, registered_user, other_user):
    session_id = await create_session("owner's query", "llama3:8b", "quick", user_id=registered_user["user"]["id"])

    r_owner = await client.get(f"/api/sessions/{session_id}", headers=registered_user["headers"])
    assert r_owner.status_code == 200

    r_other = await client.get(f"/api/sessions/{session_id}", headers=other_user["headers"])
    assert r_other.status_code == 403


async def test_get_session_404_for_unknown_id(client, registered_user):
    r = await client.get("/api/sessions/00000000-0000-0000-0000-000000000000", headers=registered_user["headers"])
    assert r.status_code == 404


async def test_delete_session_denies_non_owner(client, registered_user, other_user):
    session_id = await create_session("owner's query", "llama3:8b", "quick", user_id=registered_user["user"]["id"])

    r = await client.delete(f"/api/sessions/{session_id}", headers=other_user["headers"])
    assert r.status_code == 403

    # Still there — the non-owner's delete must not have gone through.
    r_check = await client.get(f"/api/sessions/{session_id}", headers=registered_user["headers"])
    assert r_check.status_code == 200


async def test_delete_session_succeeds_for_owner(client, registered_user):
    session_id = await create_session("owner's query", "llama3:8b", "quick", user_id=registered_user["user"]["id"])

    r = await client.delete(f"/api/sessions/{session_id}", headers=registered_user["headers"])
    assert r.status_code == 200

    r_check = await client.get(f"/api/sessions/{session_id}", headers=registered_user["headers"])
    assert r_check.status_code == 404


async def test_delete_all_sessions_only_affects_caller(client, registered_user, other_user):
    mine = await create_session("owner's query", "llama3:8b", "quick", user_id=registered_user["user"]["id"])
    theirs = await create_session("other's query", "llama3:8b", "quick", user_id=other_user["user"]["id"])

    r = await client.delete("/api/sessions", headers=registered_user["headers"])
    assert r.status_code == 200

    r_mine = await client.get(f"/api/sessions/{mine}", headers=registered_user["headers"])
    assert r_mine.status_code == 404

    r_theirs = await client.get(f"/api/sessions/{theirs}", headers=other_user["headers"])
    assert r_theirs.status_code == 200


async def test_sessions_require_auth(client):
    r = await client.get("/api/sessions")
    assert r.status_code in (401, 403)
