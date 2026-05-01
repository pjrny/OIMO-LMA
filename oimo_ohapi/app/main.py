"""OIMO Internal OhAPI — FastAPI entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.api import characters, images, jobs, health

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="OIMO Internal OhAPI",
    version="0.1.0",
    description="Identity-first NSFW generation for the OIMO Likeness Engine.",
)

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to LMA + MAS V4 origins in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = settings.api_prefix
app.include_router(health.router, prefix=PREFIX, tags=["health"])
app.include_router(characters.router, prefix=f"{PREFIX}/characters", tags=["characters"])
app.include_router(images.router, prefix=f"{PREFIX}/images", tags=["images"])
app.include_router(jobs.router, prefix=f"{PREFIX}/jobs", tags=["jobs"])
