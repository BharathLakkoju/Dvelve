from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, Response
from services.database import get_sessions, get_session, delete_session, delete_all_sessions
from services.ollama import ollama_service
from services.auth import get_current_user
import json

router = APIRouter(prefix="/api", tags=["sessions"])


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    sessions = await get_sessions(user_id=current_user["sub"])
    return [s.model_dump() for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str, current_user: dict = Depends(get_current_user)):
    await delete_session(session_id)
    return {"status": "deleted"}


@router.delete("/sessions")
async def clear_all_sessions(current_user: dict = Depends(get_current_user)):
    await delete_all_sessions()
    return {"status": "all sessions deleted"}


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
    url = body.get("url", "http://localhost:11434")
    from services.ollama import OllamaService
    svc = OllamaService(base_url=url)
    available = await svc.is_available()
    models = await svc.list_models() if available else []
    return {"available": available, "models": models}


@router.get("/sessions/{session_id}/export/markdown")
async def export_markdown(session_id: str):
    session = await get_session(session_id)
    if not session or not session.report_markdown:
        raise HTTPException(status_code=404, detail="Report not found")
    filename = session.query[:40].replace(" ", "_").replace("/", "_") + ".md"
    return Response(
        content=session.report_markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sessions/{session_id}/export/pdf")
async def export_pdf(session_id: str):
    session = await get_session(session_id)
    if not session or not session.report_markdown:
        raise HTTPException(status_code=404, detail="Report not found")
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
        filename = session.query[:40].replace(" ", "_") + ".pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="WeasyPrint not installed. Run: pip install weasyprint",
        )
