from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from services.database import init_db
from routers.research import router as research_router
from routers.sessions import router as sessions_router
from routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Dvelve API",
    description="Local-first multi-agent research pipeline powered by Ollama",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)

app.include_router(auth_router)
app.include_router(research_router)
app.include_router(sessions_router)


@app.get("/")
async def root():
    return {
        "app": "Dvelve",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }
