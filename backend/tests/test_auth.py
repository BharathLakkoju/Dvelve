from tests.conftest import unique_email, unique_username, TEST_PASSWORD


async def test_signup_returns_token_and_user(client):
    email, username = unique_email(), unique_username()
    r = await client.post("/api/auth/signup", json={
        "email": email, "username": username, "password": TEST_PASSWORD,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == email
    assert body["user"]["username"] == username
    assert "access_token" in body

    # cleanup
    from services.database import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute("DELETE FROM users WHERE email=$1", email)


async def test_signup_rejects_duplicate_email(client, registered_user):
    r = await client.post("/api/auth/signup", json={
        "email": registered_user["email"],
        "username": unique_username(),
        "password": TEST_PASSWORD,
    })
    assert r.status_code == 400


async def test_signup_rejects_weak_password(client):
    r = await client.post("/api/auth/signup", json={
        "email": unique_email(), "username": unique_username(), "password": "short",
    })
    assert r.status_code == 422


async def test_signin_with_correct_credentials(client, registered_user):
    r = await client.post("/api/auth/signin", json={
        "email": registered_user["email"], "password": registered_user["password"],
    })
    assert r.status_code == 200
    assert r.json()["user"]["email"] == registered_user["email"]


async def test_signin_with_wrong_password(client, registered_user):
    r = await client.post("/api/auth/signin", json={
        "email": registered_user["email"], "password": "TotallyWrongPassword1",
    })
    assert r.status_code == 401


async def test_signin_with_unknown_email(client):
    r = await client.post("/api/auth/signin", json={
        "email": unique_email(), "password": "WhateverPassword1",
    })
    assert r.status_code == 401


async def test_me_requires_auth(client):
    r = await client.get("/api/auth/me")
    assert r.status_code in (401, 403)


async def test_me_rejects_garbage_token(client):
    r = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


async def test_me_returns_current_user(client, registered_user):
    r = await client.get("/api/auth/me", headers=registered_user["headers"])
    assert r.status_code == 200
    assert r.json()["id"] == registered_user["user"]["id"]


async def test_signin_is_rate_limited(client, registered_user):
    """Regression guard for the `# FIX: Strict rate limits on auth endpoints`
    in routers/auth.py (5/minute) — brute-force protection must still fire.
    Uses wrong-password attempts against a real user so this never depends
    on (or risks tripping) the signup limiter tested elsewhere."""
    for _ in range(5):
        r = await client.post("/api/auth/signin", json={
            "email": registered_user["email"], "password": "WrongPassword1",
        })
        assert r.status_code == 401

    r = await client.post("/api/auth/signin", json={
        "email": registered_user["email"], "password": "WrongPassword1",
    })
    assert r.status_code == 429
