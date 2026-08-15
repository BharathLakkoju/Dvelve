import asyncio
import json
import logging
from typing import Optional
import anyio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from models.schemas import ResearchRequest
from agents.planner import run_planner
from agents.retriever import run_retriever
from agents.ranker import run_ranker
from agents.writer import run_writer_stream, WRITER_FAILURE_MARKER
from agents.critic import run_critic
from services.database import create_session, update_session
from services.auth import get_current_user_optional
from services.ollama import ollama_service
from services.openrouter import OPENROUTER_DEFAULT_MODEL

router = APIRouter(prefix="/api", tags=["research"])
logger = logging.getLogger(__name__)

# FIX: Rate-limit research to prevent resource exhaustion by anonymous or
# authenticated users. Running the full AI pipeline is expensive.
limiter = Limiter(key_func=get_remote_address)


async def research_event_generator(body: ResearchRequest, session_id: str):
    """Yields SSE events for the full research pipeline.

    FIX: Cancels cleanly when the client disconnects (e.g. "Stop Research",
    which now aborts the underlying fetch — see frontend/src/hooks/useSSE.ts).
    Starlette cancels this generator's task with asyncio.CancelledError as
    soon as it notices the write to the closed connection fail — NOT via
    polling Request.is_disconnected(), which was tried first and verified
    (via a standalone reproduction) to not fire reliably here. The pending
    Ollama/OpenRouter HTTP call is itself cancelled by this, actually
    stopping generation rather than just abandoning an already-running one.
    The DB write marking the session "cancelled" must run inside a shielded
    cancel scope — an unshielded await in this handler gets cancelled again
    immediately, before it can complete.
    """
    report_parts = []
    sources = []
    # Defaults until determined below — used by the cancellation/exception
    # handling if the pipeline stops before mode detection runs.
    effective_offline = body.offline_mode
    llm_provider = "mock"

    async def emit(event: str, data: dict):
        payload = json.dumps({"session_id": session_id, "event": event, "data": data})
        yield f"event: {event}\ndata: {payload}\n\n"

    try:
        # ── DETERMINE EFFECTIVE MODE ──────────────────────────────────────────
        # offline_mode toggle: True = local-first (retrieval stays on curated
        # mock fixtures — no live web search — and generation prefers local
        # Ollama, falling back to mock if it isn't reachable, so this path
        # always works with zero internet access). False = online (live web
        # retrieval + OpenRouter cloud generation — no silent mock fallback,
        # since the entire point of choosing online is real generation).
        effective_offline = body.offline_mode
        if body.offline_mode:
            ollama_available = await ollama_service.is_available()
            llm_provider = "ollama" if ollama_available else "mock"
        else:
            llm_provider = "openrouter"

        llm_model = body.model if llm_provider == "ollama" else OPENROUTER_DEFAULT_MODEL

        mode_msg = {
            "mock": "Offline mode — Ollama unavailable, using curated sources and a mock report",
            "ollama": "Offline mode — using local Ollama for generation",
            "openrouter": "Online mode — using OpenRouter cloud for generation",
        }[llm_provider]
        async for chunk in emit("status", {
            "message": mode_msg,
            "agent": "system",
            "stage": "init",
            "online": not effective_offline,
            "llm_provider": llm_provider,
        }):
            yield chunk

        # ── PLANNER ──────────────────────────────────────────
        async for chunk in emit("status", {"message": "Planner agent starting…", "agent": "planner", "stage": "thinking"}):
            yield chunk
        await asyncio.sleep(0.5)

        planner_result = await run_planner(
            body.query, llm_model, body.depth, llm_provider
        )
        async for chunk in emit("planner", {
            "sub_questions": [sq.model_dump() for sq in planner_result.sub_questions],
            "total_questions": planner_result.total_questions,
            "status": "complete",
        }):
            yield chunk

        # ── RETRIEVER ─────────────────────────────────────────
        retriever_msg = (
            "Retriever agent searching curated sources…"
            if effective_offline
            else "Retriever agent searching web & vector memory…"
        )
        async for chunk in emit("status", {"message": retriever_msg, "agent": "retriever", "stage": "searching"}):
            yield chunk
        await asyncio.sleep(0.8)

        retriever_result = await run_retriever(
            planner_result.sub_questions, body.query, body.depth, effective_offline
        )
        async for chunk in emit("retriever", {
            "sources": [s.model_dump() for s in retriever_result.sources],
            "total_sources": retriever_result.total_sources,
            "cached_count": retriever_result.cached_count,
            "status": "complete",
        }):
            yield chunk

        # ── RANKER ────────────────────────────────────────────
        async for chunk in emit("status", {"message": "Ranker agent scoring and deduplicating…", "agent": "ranker", "stage": "ranking"}):
            yield chunk
        await asyncio.sleep(0.3)

        ranker_result = await run_ranker(
            retriever_result.sources, body.model, effective_offline
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
            body.query,
            planner_result.sub_questions,
            sources,
            llm_model,
            llm_provider,
            body.depth,
        ):
            report_parts.append(token)
            payload = json.dumps({"session_id": session_id, "event": "writer", "data": {"token": token}})
            yield f"event: writer\ndata: {payload}\n\n"

        full_report = "".join(report_parts)

        # ── WRITER FAILURE CHECK ────────────────────────────────
        # Live-mode generation intentionally never falls back to mock content
        # (see writer.py) — instead it embeds WRITER_FAILURE_MARKER in the
        # stream. Treat that as a failed session: no report was actually
        # produced, so it must not be scored or shown as "complete".
        if WRITER_FAILURE_MARKER in full_report:
            logger.error("Writer agent failed to generate a report for session %s", session_id)
            await update_session(
                session_id,
                status="failed",
                report_markdown=full_report,
                sources=sources,
                offline_mode=effective_offline,
                llm_provider=llm_provider,
            )
            failure_message = (
                "Report generation failed. Check that OPENROUTER_API_KEY is set in backend/.env "
                "and that your OpenRouter account has access to the configured model."
                if llm_provider == "openrouter"
                else "Report generation failed. The selected Ollama model may not be available "
                     "— check Settings and confirm the model is pulled (ollama pull <model>)."
            )
            async for chunk in emit("error", {
                "message": failure_message,
                "stage": "writer",
            }):
                yield chunk
            return

        # ── CRITIC ────────────────────────────────────────────
        async for chunk in emit("status", {"message": "Critic agent reviewing report quality…", "agent": "critic", "stage": "reviewing"}):
            yield chunk
        await asyncio.sleep(0.3)

        critic_result = await run_critic(full_report, sources, llm_model, llm_provider)
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
            offline_mode=effective_offline,
            llm_provider=llm_provider,
        )
        async for chunk in emit("done", {"session_id": session_id, "status": "complete"}):
            yield chunk

    except asyncio.CancelledError:
        # FIX: The client disconnected (e.g. "Stop Research"). This also
        # interrupts whatever Ollama/OpenRouter call was in flight, rather
        # than letting it finish generating a report nobody will see.
        logger.info("Research session %s cancelled by client", session_id)
        with anyio.CancelScope(shield=True):
            await update_session(
                session_id,
                status="cancelled",
                offline_mode=effective_offline,
                llm_provider=llm_provider,
            )
        raise

    except Exception as e:
        # FIX: Log the full exception server-side; only send a generic error message
        # to the client to prevent information disclosure (stack traces, paths, etc.).
        logger.exception("Research pipeline error for session %s", session_id)
        await update_session(session_id, status="failed", offline_mode=effective_offline, llm_provider=llm_provider)
        async for chunk in emit("error", {"message": "An internal error occurred. Please try again."}):
            yield chunk


@router.post("/research")
@limiter.limit("10/minute")
async def start_research(
    request: Request,
    body: ResearchRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    user_id = current_user["sub"] if current_user else None
    session_id = await create_session(body.query, body.model, body.depth.value, user_id=user_id)

    return StreamingResponse(
        research_event_generator(body, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )
