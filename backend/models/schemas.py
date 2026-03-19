from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ResearchDepth(str, Enum):
    quick = "quick"
    standard = "standard"
    deep = "deep"


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    model: str = Field(default="llama3:8b")
    depth: ResearchDepth = Field(default=ResearchDepth.standard)
    offline_mode: bool = Field(default=True)


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
    query: str
    model: str
    depth: str
    status: str  # pending | running | complete | failed
    created_at: datetime
    completed_at: Optional[datetime] = None
    report_markdown: Optional[str] = None
    sources: Optional[List[SourceChunk]] = None
    critic_score: Optional[float] = None


class SessionSummary(BaseModel):
    id: str
    query: str
    model: str
    depth: str
    status: str
    created_at: datetime
    source_count: int = 0
    critic_score: Optional[float] = None


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
    email: str = Field(..., min_length=5, max_length=255)
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str
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
