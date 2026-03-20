import re
import logging
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from services.database import get_sessions, get_session, delete_session, delete_user_sessions
from services.ollama import ollama_service
from services.auth import get_current_user
import json

router = APIRouter(prefix="/api", tags=["sessions"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_filename(text: str, ext: str) -> str:
    """Return a sanitized filename safe for use in a Content-Disposition header.
    
    FIX: Strips all characters that could inject into the HTTP header value
    (quotes, CR, LF, semicolons, etc.).  Only alphanumerics, hyphens, and
    underscores are allowed.
    """
    safe = re.sub(r'[^\w\-]', '_', text[:50], flags=re.ASCII)
    safe = safe.strip('_') or "report"
    return safe + ext


def _validate_ollama_url(url: str) -> str:
    """FIX: Guard against SSRF by only allowing localhost/loopback targets.
    
    Raises HTTPException(400) for any URL that could reach an internal or
    external host.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https URLs are permitted")

    hostname = (parsed.hostname or "").lower()
    allowed_hosts = {"localhost", "127.0.0.1", "::1"}
    if hostname not in allowed_hosts:
        raise HTTPException(
            status_code=400,
            detail="Only localhost URLs are allowed for Ollama connection testing",
        )
    return url


# ---------------------------------------------------------------------------
# Session routes
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    sessions = await get_sessions(user_id=current_user["sub"])
    return [s.model_dump() for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # FIX: Enforce ownership — users may only read their own sessions (BOLA/IDOR fix).
    if session.user_id != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return session.model_dump()


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # FIX: Enforce ownership — users may only delete their own sessions (BOLA/IDOR fix).
    if session.user_id != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    await delete_session(session_id)
    return {"status": "deleted"}


@router.delete("/sessions")
async def clear_user_sessions(current_user: dict = Depends(get_current_user)):
    # FIX: Only delete sessions belonging to the authenticated user, not all users.
    await delete_user_sessions(current_user["sub"])
    return {"status": "all sessions deleted"}


# ---------------------------------------------------------------------------
# Ollama / model routes
# ---------------------------------------------------------------------------

@router.get("/models")
async def list_models():
    models = await ollama_service.list_models()
    return {"models": models}


@router.get("/ollama/status")
async def ollama_status():
    available = await ollama_service.is_available()
    return {"available": available, "base_url": ollama_service.base_url}


@router.post("/ollama/test")
async def test_ollama_connection(body: dict):
    # FIX: Validate the caller-supplied URL to prevent SSRF.
    raw_url = body.get("url", "http://localhost:11434")
    url = _validate_ollama_url(raw_url)
    from services.ollama import OllamaService
    svc = OllamaService(base_url=url)
    available = await svc.is_available()
    models = await svc.list_models() if available else []
    return {"available": available, "models": models}


# ---------------------------------------------------------------------------
# Export routes — FIX: require authentication and ownership check
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/export/markdown")
async def export_markdown(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session or not session.report_markdown:
        raise HTTPException(status_code=404, detail="Report not found")
    # FIX: Enforce ownership before serving the file.
    if session.user_id != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    # FIX: Sanitize filename to prevent HTTP header injection.
    filename = _safe_filename(session.query, ".md")
    return Response(
        content=session.report_markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


@router.get("/sessions/{session_id}/export/pdf")
async def export_pdf(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session or not session.report_markdown:
        raise HTTPException(status_code=404, detail="Report not found")
    # FIX: Enforce ownership before serving the file.
    if session.user_id != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        import markdown as md_lib
        import weasyprint

        html_body = md_lib.markdown(session.report_markdown, extensions=["tables", "fenced_code"])
        html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body {{ font-family: Georgia, serif; max-width: 800px; margin: 40px auto; line-height: 1.6; color: #222; }}
  h1 {{ color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }}
  h2 {{ color: #312e81; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin-top: 2em; }}
  h3 {{ color: #4338ca; }}
  a {{ color: #4f46e5; }}
  code {{ background: #f4f4f8; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }}
  blockquote {{ border-left: 4px solid #4f46e5; margin-left: 0; padding-left: 16px; color: #555; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
  th {{ background: #f0f0ff; }}
</style>
</head><body>{html_body}</body></html>"""

        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        # FIX: Sanitize filename to prevent HTTP header injection.
        filename = _safe_filename(session.query, ".pdf")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
        )
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="WeasyPrint not installed. Run: pip install weasyprint",
        )
