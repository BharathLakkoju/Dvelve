import asyncio
import json
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from models.schemas import ResearchRequest
from agents.planner import run_planner
from agents.retriever import run_retriever
from agents.ranker import run_ranker
from agents.writer import run_writer_stream
from agents.critic import run_critic
from services.database import create_session, update_session
from services.auth import get_current_user_optional

router = APIRouter(prefix="/api", tags=["research"])


async def research_event_generator(request: ResearchRequest, session_id: str):
    """Yields SSE events for the full research pipeline."""
    report_parts = []
    sources = []

    async def emit(event: str, data: dict):
        payload = json.dumps({"session_id": session_id, "event": event, "data": data})
        yield f"event: {event}\ndata: {payload}\n\n"

    try:
        # ── PLANNER ──────────────────────────────────────────
        async for chunk in emit("status", {"message": "Planner agent starting…", "agent": "planner", "stage": "thinking"}):
            yield chunk
        await asyncio.sleep(0.5)

        planner_result = await run_planner(
            request.query, request.model, request.depth, request.offline_mode
        )
        async for chunk in emit("planner", {
            "sub_questions": [sq.model_dump() for sq in planner_result.sub_questions],
            "total_questions": planner_result.total_questions,
            "status": "complete",
        }):
            yield chunk

        # ── RETRIEVER ─────────────────────────────────────────
        async for chunk in emit("status", {"message": "Retriever agent searching sources…", "agent": "retriever", "stage": "searching"}):
            yield chunk
        await asyncio.sleep(0.8)

        retriever_result = await run_retriever(
            planner_result.sub_questions, request.query, request.depth, request.offline_mode
        )
        async for chunk in emit("retriever", {
            "sources": [s.model_dump() for s in retriever_result.sources],
            "total_sources": retriever_result.total_sources,
            "status": "complete",
        }):
            yield chunk

        # ── RANKER ────────────────────────────────────────────
        async for chunk in emit("status", {"message": "Ranker agent scoring and deduplicating…", "agent": "ranker", "stage": "ranking"}):
            yield chunk
        await asyncio.sleep(0.3)

        ranker_result = await run_ranker(
            retriever_result.sources, request.model, request.offline_mode
        )
        async for chunk in emit("ranker", {
            "ranked_count": len(ranker_result.ranked_sources),
            "deduplicated_count": ranker_result.deduplicated_count,
            "status": "complete",
        }):
            yield chunk

        sources = ranker_result.ranked_sources

        # ── WRITER ────────────────────────────────────────────
        async for chunk in emit("status", {"message": "Writer agent generating report…", "agent": "writer", "stage": "writing"}):
            yield chunk
        await asyncio.sleep(0.2)

        async for token in run_writer_stream(
            request.query,
            planner_result.sub_questions,
            sources,
            request.model,
            request.offline_mode,
        ):
            report_parts.append(token)
            payload = json.dumps({"session_id": session_id, "event": "writer", "data": {"token": token}})
            yield f"event: writer\ndata: {payload}\n\n"

        full_report = "".join(report_parts)

        # ── CRITIC ────────────────────────────────────────────
        async for chunk in emit("status", {"message": "Critic agent reviewing report quality…", "agent": "critic", "stage": "reviewing"}):
            yield chunk
        await asyncio.sleep(0.3)

        critic_result = await run_critic(full_report, sources)
        async for chunk in emit("critic", {
            "quality_score": critic_result.quality_score,
            "strengths": critic_result.strengths,
            "suggestions": critic_result.suggestions,
            "citation_count": critic_result.citation_count,
            "status": "complete",
        }):
            yield chunk

        # ── DONE ──────────────────────────────────────────────
        await update_session(
            session_id,
            status="complete",
            report_markdown=full_report,
            sources=sources,
            critic_score=critic_result.quality_score,
        )
        async for chunk in emit("done", {"session_id": session_id, "status": "complete"}):
            yield chunk

    except Exception as e:
        await update_session(session_id, status="failed")
        async for chunk in emit("error", {"message": str(e)}):
            yield chunk


@router.post("/research")
async def start_research(
    request: ResearchRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["sub"] if current_user else None
    session_id = await create_session(request.query, request.model, request.depth.value, user_id=user_id)

    return StreamingResponse(
        research_event_generator(request, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )
