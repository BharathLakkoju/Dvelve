import asyncpg
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from dotenv import load_dotenv
from models.schemas import ResearchSession, SessionSummary, SourceChunk, UserResponse

# This module reads DATABASE_URL at import time (below), and main.py imports
# it before anything else that happens to call load_dotenv() as a side
# effect — so .env must be loaded explicitly here, not assumed already loaded.
load_dotenv()

# FIX: Postgres (Neon) is the persistent store for users/sessions. Render's
# free plan has no durable disk at all, so the old SQLite file was silently
# wiped on every restart/redeploy — deleting every registered user and
# session. There is deliberately no SQLite fallback here: a persistence layer
# that degrades silently is worse than one that fails loudly at startup.
_DATABASE_URL_ENV = os.getenv("DATABASE_URL")
if not _DATABASE_URL_ENV:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. Set it to your Neon "
        "Postgres connection string — see backend/.env.example."
    )


def _to_asyncpg_dsn(url: str) -> str:
    """Strip DSN query params asyncpg's connector doesn't understand.

    Neon's connection strings append `channel_binding=require` (a psycopg/libpq
    SCRAM feature asyncpg doesn't implement) and `sslmode=require`. TLS is
    requested explicitly via the `ssl` kwarg on connect instead, since
    asyncpg's own sslmode DSN parsing is inconsistent across versions.
    """
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in ("channel_binding", "sslmode")]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


DATABASE_URL = _to_asyncpg_dsn(_DATABASE_URL_ENV)

_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # FIX: Bounded pool size — Neon's free tier caps concurrent connections,
        # and an unbounded pool from a runaway request burst could exhaust them.
        _pool = await asyncpg.create_pool(DATABASE_URL, ssl="require", min_size=1, max_size=5)
    return _pool


async def init_db():
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(id),
                query TEXT NOT NULL,
                model TEXT NOT NULL,
                depth TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                completed_at TEXT,
                report_markdown TEXT,
                sources_json TEXT,
                critic_score DOUBLE PRECISION,
                offline_mode INTEGER,
                llm_provider TEXT
            )
        """)


async def close_db():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


# ── User CRUD ─────────────────────────────────────────────────────────────────

async def create_user(email: str, username: str, hashed_password: str) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute(
            "INSERT INTO users (id, email, username, hashed_password, created_at) VALUES ($1, $2, $3, $4, $5)",
            user_id, email, username, hashed_password, now,
        )
    return {"id": user_id, "email": email, "username": username, "created_at": now}


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    pool = await _get_pool()
    async with pool.acquire() as db:
        row = await db.fetchrow("SELECT * FROM users WHERE email=$1", email)
        return dict(row) if row else None


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    pool = await _get_pool()
    async with pool.acquire() as db:
        row = await db.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
        return dict(row) if row else None


# ── Session CRUD ──────────────────────────────────────────────────────────────

async def create_session(query: str, model: str, depth: str, user_id: Optional[str] = None) -> str:
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute(
            """INSERT INTO sessions (id, user_id, query, model, depth, status, created_at)
               VALUES ($1, $2, $3, $4, $5, 'running', $6)""",
            session_id, user_id, query, model, depth, now,
        )
    return session_id


async def update_session(
    session_id: str,
    status: str,
    report_markdown: Optional[str] = None,
    sources: Optional[List[SourceChunk]] = None,
    critic_score: Optional[float] = None,
    offline_mode: Optional[bool] = None,
    llm_provider: Optional[str] = None,
):
    completed_at = datetime.now(timezone.utc).isoformat() if status == "complete" else None
    sources_json = (
        json.dumps([s.model_dump() for s in sources]) if sources else None
    )
    offline_mode_int = None if offline_mode is None else int(offline_mode)
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute(
            """UPDATE sessions SET status=$1, completed_at=$2, report_markdown=$3,
               sources_json=$4, critic_score=$5, offline_mode=$6, llm_provider=$7 WHERE id=$8""",
            status, completed_at, report_markdown, sources_json, critic_score, offline_mode_int, llm_provider, session_id,
        )


async def get_sessions(user_id: Optional[str] = None) -> List[SessionSummary]:
    pool = await _get_pool()
    async with pool.acquire() as db:
        if user_id:
            rows = await db.fetch(
                "SELECT id, query, model, depth, status, created_at, sources_json, critic_score, offline_mode, llm_provider "
                "FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
                user_id,
            )
        else:
            rows = await db.fetch(
                "SELECT id, query, model, depth, status, created_at, sources_json, critic_score, offline_mode, llm_provider "
                "FROM sessions ORDER BY created_at DESC LIMIT 50"
            )
    results = []
    for row in rows:
        sources = json.loads(row["sources_json"]) if row["sources_json"] else []
        results.append(
            SessionSummary(
                id=row["id"],
                query=row["query"],
                model=row["model"],
                depth=row["depth"],
                status=row["status"],
                created_at=datetime.fromisoformat(row["created_at"]),
                source_count=len(sources),
                critic_score=row["critic_score"],
                offline_mode=None if row["offline_mode"] is None else bool(row["offline_mode"]),
                llm_provider=row["llm_provider"],
            )
        )
    return results


async def get_session(session_id: str) -> Optional[ResearchSession]:
    pool = await _get_pool()
    async with pool.acquire() as db:
        row = await db.fetchrow("SELECT * FROM sessions WHERE id=$1", session_id)
    if not row:
        return None
    sources_data = json.loads(row["sources_json"]) if row["sources_json"] else []
    sources = [SourceChunk(**s) for s in sources_data]
    return ResearchSession(
        id=row["id"],
        user_id=row["user_id"],  # FIX: expose user_id for ownership checks
        query=row["query"],
        model=row["model"],
        depth=row["depth"],
        status=row["status"],
        created_at=datetime.fromisoformat(row["created_at"]),
        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
        report_markdown=row["report_markdown"],
        sources=sources,
        critic_score=row["critic_score"],
        offline_mode=None if row["offline_mode"] is None else bool(row["offline_mode"]),
        llm_provider=row["llm_provider"],
    )


async def delete_session(session_id: str):
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute("DELETE FROM sessions WHERE id=$1", session_id)


# FIX: Scoped deletion — only removes sessions belonging to the given user.
async def delete_user_sessions(user_id: str):
    pool = await _get_pool()
    async with pool.acquire() as db:
        await db.execute("DELETE FROM sessions WHERE user_id=$1", user_id)

# NOTE: delete_all_sessions() was removed — it was a footgun with no live route
# that would have wiped every user's data if ever accidentally re-exposed.
