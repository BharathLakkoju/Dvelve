from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re

# Allowlist of known-safe Ollama model identifiers (name:tag format).
_ALLOWED_MODEL_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$')


class ResearchDepth(str, Enum):
    quick = "quick"
    standard = "standard"
    deep = "deep"


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    # FIX: validate model name against a safe pattern to prevent injection.
    model: str = Field(default="llama3:8b", min_length=1, max_length=100)
    depth: ResearchDepth = Field(default=ResearchDepth.standard)
    offline_mode: bool = Field(default=True)

    @field_validator('model')
    @classmethod
    def validate_model(cls, v: str) -> str:
        if not _ALLOWED_MODEL_PATTERN.match(v):
            raise ValueError('Invalid model name format')
        return v


class SubQuestion(BaseModel):
    id: int
    question: str
    search_query: str


class PlannerResult(BaseModel):
    sub_questions: List[SubQuestion]
    total_questions: int


class SourceChunk(BaseModel):
    id: int
    title: str
    url: str
    snippet: str
    content: str
    domain: str
    relevance_score: float = 0.0
    date: Optional[str] = None


class RetrieverResult(BaseModel):
    sources: List[SourceChunk]
    total_sources: int
    cached_count: int = 0


class RankerResult(BaseModel):
    ranked_sources: List[SourceChunk]
    deduplicated_count: int


class CriticResult(BaseModel):
    quality_score: float  # 0.0 - 10.0
    strengths: List[str]
    suggestions: List[str]
    citation_count: int


class ResearchSession(BaseModel):
    id: str
    user_id: Optional[str] = None  # Added for ownership checks
    query: str
    model: str
    depth: str
    status: str  # pending | running | complete | failed | cancelled
    created_at: datetime
    completed_at: Optional[datetime] = None
    report_markdown: Optional[str] = None
    sources: Optional[List[SourceChunk]] = None
    critic_score: Optional[float] = None
    # Whether retrieval stayed local/mock (True) or did live web search (False).
    # Mirrors the client's requested offline_mode — retrieval always honors it
    # directly (see research.py). None for sessions created before this field existed.
    offline_mode: Optional[bool] = None
    # Which backend actually generated + reviewed this report: "mock" (offline
    # templates), "ollama" (local, used when offline_mode=True and Ollama was
    # reachable — falls back to "mock" otherwise), or "openrouter" (cloud,
    # used whenever offline_mode=False). None for sessions predating this field.
    llm_provider: Optional[str] = None


class SessionSummary(BaseModel):
    id: str
    query: str
    model: str
    depth: str
    status: str
    created_at: datetime
    source_count: int = 0
    critic_score: Optional[float] = None
    offline_mode: Optional[bool] = None
    llm_provider: Optional[str] = None


class OllamaConfig(BaseModel):
    base_url: str = "http://localhost:11434"
    default_model: str = "llama3:8b"
    offline_mode: bool = True


class SSEEvent(BaseModel):
    event: str  # planner | retriever | ranker | writer | critic | done | error
    data: dict
    session_id: str


# ── Auth / User schemas ─────────────────────────────────────────────────────

class UserRegister(BaseModel):
    # FIX: Use EmailStr for proper email format validation.
    email: EmailStr
    # FIX: Restrict username to safe alphanumeric + underscore/hyphen characters.
    username: str = Field(..., min_length=2, max_length=50, pattern=r'^[a-zA-Z0-9_\-]+$')
    # FIX: Increased minimum password length from 6 to 8 characters.
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    # FIX: Use EmailStr so invalid email formats are rejected before hitting the DB.
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
