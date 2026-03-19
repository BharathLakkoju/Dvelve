import aiosqlite
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from models.schemas import ResearchSession, SessionSummary, SourceChunk, UserResponse

DB_PATH = "research_sessions.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        # Sessions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                query TEXT NOT NULL,
                model TEXT NOT NULL,
                depth TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                completed_at TEXT,
                report_markdown TEXT,
                sources_json TEXT,
                critic_score REAL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        # Migrate existing sessions table to add user_id if missing
        try:
            await db.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
        except Exception:
            pass
        await db.commit()


# ── User CRUD ─────────────────────────────────────────────────────────────────

async def create_user(email: str, username: str, hashed_password: str) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO users (id, email, username, hashed_password, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email, username, hashed_password, now),
        )
        await db.commit()
    return {"id": user_id, "email": email, "username": username, "created_at": now}


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE email=?", (email,))
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE id=?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row)


# ── Session CRUD ──────────────────────────────────────────────────────────────

async def create_session(query: str, model: str, depth: str, user_id: Optional[str] = None) -> str:
    session_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO sessions (id, user_id, query, model, depth, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'running', ?)""",
            (session_id, user_id, query, model, depth, now),
        )
        await db.commit()
    return session_id


async def update_session(
    session_id: str,
    status: str,
    report_markdown: Optional[str] = None,
    sources: Optional[List[SourceChunk]] = None,
    critic_score: Optional[float] = None,
):
    completed_at = datetime.utcnow().isoformat() if status == "complete" else None
    sources_json = (
        json.dumps([s.model_dump() for s in sources]) if sources else None
    )
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """UPDATE sessions SET status=?, completed_at=?, report_markdown=?,
               sources_json=?, critic_score=? WHERE id=?""",
            (status, completed_at, report_markdown, sources_json, critic_score, session_id),
        )
        await db.commit()


async def get_sessions(user_id: Optional[str] = None) -> List[SessionSummary]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            cursor = await db.execute(
                "SELECT id, query, model, depth, status, created_at, sources_json, critic_score "
                "FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
                (user_id,),
            )
        else:
            cursor = await db.execute(
                "SELECT id, query, model, depth, status, created_at, sources_json, critic_score "
                "FROM sessions ORDER BY created_at DESC LIMIT 50"
            )
        rows = await cursor.fetchall()
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
                )
            )
        return results


async def get_session(session_id: str) -> Optional[ResearchSession]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id=?", (session_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        sources_data = json.loads(row["sources_json"]) if row["sources_json"] else []
        sources = [SourceChunk(**s) for s in sources_data]
        return ResearchSession(
            id=row["id"],
            query=row["query"],
            model=row["model"],
            depth=row["depth"],
            status=row["status"],
            created_at=datetime.fromisoformat(row["created_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
            report_markdown=row["report_markdown"],
            sources=sources,
            critic_score=row["critic_score"],
        )


async def delete_session(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM sessions WHERE id=?", (session_id,))
        await db.commit()


async def delete_all_sessions():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM sessions")
        await db.commit()
