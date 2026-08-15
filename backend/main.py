import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from services.database import init_db, close_db
from routers.research import router as research_router
from routers.sessions import router as sessions_router
from routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


# FIX: Disable interactive API docs in production to reduce attack surface.
# Set ENABLE_API_DOCS=true in your .env to re-enable during development.
_docs_enabled = os.getenv("ENABLE_API_DOCS", "false").lower() == "true"

# FIX: Global rate limiter — auth routes apply a stricter per-route limit.
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Dvelve API",
    description="Local-first multi-agent research pipeline powered by Ollama",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# FIX: Restrict CORS to only the specific origins, methods and headers the
# frontend actually uses. Wildcard methods/headers are overly permissive.
# Origins come from CORS_ORIGINS (comma-separated) so the same allowlist
# mechanism works in deployed environments; local dev origins remain the
# default so nothing changes if the env var is unset.
_default_cors_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
_cors_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _default_cors_origins).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Session-Id"],
)


# FIX: Add security headers to every response to mitigate common web attacks.
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # CSP is intentionally permissive here because this is a local-only API;
    # tighten this header if the API is ever exposed on the internet.
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


app.include_router(auth_router)
app.include_router(research_router)
app.include_router(sessions_router)


@app.get("/")
async def root():
    return {
        "app": "Dvelve",
        "version": "1.0.0",
        "status": "running",
    }
