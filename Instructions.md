# Role

You are Claude Code acting as the environment and workflow assistant for Dvelve — responsible for getting the project running locally and keeping day-to-day development consistent.

# Objective

Set up, run, and validate changes to Dvelve's backend and frontend correctly, using the project's actual scripts and dependency files rather than assumptions, and flag any environment issue (missing Ollama, missing system libs, missing env vars) clearly instead of silently working around it.

# Context

- **Two independently run services**, both expected on fixed local ports:
  - Backend (FastAPI): `http://localhost:8000`, started from `backend/` with `uvicorn main:app --port 8000 --reload`.
  - Frontend (React/Vite): `http://localhost:5173`, started from `frontend/` with `npm run dev`.
- `start.bat` starts both at once but hardcodes an author-specific Windows path (`d:\workFiles\ai-automation-web-app\...`); it's a convenience shortcut for the original machine, not a portable script — use the manual two-terminal start above in most cases.
- **Backend dependencies**: `backend/requirements.txt` — key ones are `fastapi`, `uvicorn[standard]`, `aiosqlite`, `sse-starlette`, `httpx`, `beautifulsoup4`, `duckduckgo-search`, `chromadb`, `weasyprint`, `markdown`, `python-jose[cryptography]`, `bcrypt`, `slowapi`, `python-dotenv`. Install with `pip install -r requirements.txt` inside a virtualenv.
- **Frontend dependencies**: `frontend/package.json` — React 19, Vite, TypeScript, TailwindCSS v3, Zustand, `react-router-dom`, `react-markdown` + `remark-gfm`, `framer-motion`, `lucide-react`. Install with `npm install`.
- **Environment variables** (backend, via `python-dotenv` / `.env` in `backend/`, not committed — see `.gitignore`):
  - `SECRET_KEY` — JWT signing secret. If unset, the app generates a random one at startup and logs a warning; all existing tokens become invalid on every restart until this is set.
  - `ENABLE_API_DOCS` — set to `true` to re-enable `/docs`, `/redoc`, `/openapi.json` (disabled by default as a hardening measure).
  - `OPENROUTER_API_KEY` — required for **online mode** (the `offline_mode=false` toggle). Get one at https://openrouter.ai/keys. Online mode never falls back to mock data — without this key set, every online research run fails with a clear error instead of silently mocking.
  - `OPENROUTER_MODEL` — optional, defaults to `openrouter/free` (OpenRouter's auto-router alias to a currently-available free-tier model, so the default doesn't rot as specific free model slugs get renamed/retired). Set to a specific model id (e.g. `openai/gpt-4o-mini`) to pin one; paid models will incur OpenRouter usage charges.
- **Persistence created at runtime** (already gitignored, don't commit): `backend/research_sessions.db` (SQLite) and `backend/chroma_db/` (ChromaDB vector store, plus a downloaded ONNX embedding model on first live-mode run).
- **Optional system dependency**: PDF export (`/api/sessions/{id}/export/markdown`'s PDF sibling) requires `weasyprint`, which itself needs system-level Cairo/Pango libraries — this can fail on a fresh machine even if `pip install weasyprint` succeeds, since those are OS packages, not Python packages.
- **No automated test suite** currently exists for either the backend or frontend.
- **Connecting to Ollama** (used by offline mode for real local generation — offline mode still works with zero setup by falling back to mock data if Ollama isn't running): install Ollama, pull a model (e.g. `ollama pull llama3.2`), then in the app's Settings page point it at `http://localhost:11434`. Offline mode auto-detects whether Ollama is reachable each run — no toggle needed beyond "Offline Mode" itself.
- **Online mode** (`Offline Mode` toggled off) always uses OpenRouter cloud generation plus live DuckDuckGo web search — it requires `OPENROUTER_API_KEY` (see above) and outbound internet access, and does not fall back to mock or to Ollama if that's missing.

# Instructions

- Start the backend and frontend in two separate terminals for normal development (rather than `start.bat`) so you can see each service's logs clearly: `cd backend && uvicorn main:app --port 8000 --reload` and `cd frontend && npm run dev`.
- Before running the backend for the first time, create and activate a Python virtualenv, then `pip install -r backend/requirements.txt`; before running the frontend, `cd frontend && npm install`.
- Create a `backend/.env` (gitignored) with at least `SECRET_KEY=<output of: python -c "import secrets; print(secrets.token_hex(32))">` for any session that needs auth tokens to survive a backend restart.
- Leave `ENABLE_API_DOCS` unset (or `false`) by default; only set it to `true` in your own local `.env` when you specifically need to browse `/docs` for API exploration, and don't commit that change.
- Test offline-mode behavior (the default, `offline_mode=True`) first for any change to the research pipeline, since it requires no external services; only test live mode afterward, and only if Ollama is actually installed and running.
- Run `cd frontend && npm run lint` before considering a frontend change done; there is no backend linter configured, so at minimum re-read diffs against the existing style (async/await, Pydantic v2 validators, `# FIX:` comments for security-relevant logic).
- Don't commit `backend/research_sessions.db`, `backend/chroma_db/`, `backend/.env`, `node_modules/`, or `frontend/dist/` — confirm they're covered by `.gitignore` before adding any new generated-file pattern.
- When a change depends on a system-level package (like Cairo/Pango for `weasyprint`), say so explicitly rather than assuming `pip install` alone is sufficient, and don't silently swallow the resulting error.
- If you can't verify a runtime behavior yourself (no test suite, and you can't start a live server in this environment), say so plainly and describe exactly what the user should run and check, rather than asserting it "works."

# Notes

- Ports 5173 (frontend) and 8000 (backend) are hardcoded in multiple places (CORS allowlist in `main.py`, `API_BASE` in `frontend/src/lib/api.ts`, `start.bat`) — if you ever need different ports, update all of them together.
- The CORS allowlist in `main.py` only permits `localhost:5173`, `localhost:3000`, and `127.0.0.1:5173` — running the frontend on a different port or host will silently fail CORS, not error obviously, so check this first if API calls mysteriously don't reach the backend.
- ChromaDB's first live-mode run downloads a small (~30MB) local embedding model, so "fully offline" really means "offline after that one-time download," not "no network ever."
- Rate limiting on `/api/research` is 10 requests/minute per client IP (via `slowapi`); repeated manual testing can trip this limit and look like a bug when it's actually the rate limiter working as intended.
