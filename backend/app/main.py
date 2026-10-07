from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    conversation,
    learning,
    profile,
    progress,
    reading,
    speech,
    vocabulary,
)
from app.core.config import get_settings
from app.models.schemas import HealthResponse

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="FastAPI backend for iTalk language learning",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(profile.router, prefix=settings.api_prefix)
app.include_router(conversation.router, prefix=settings.api_prefix)
app.include_router(learning.router, prefix=settings.api_prefix)
app.include_router(reading.router, prefix=settings.api_prefix)
app.include_router(vocabulary.router, prefix=settings.api_prefix)
app.include_router(progress.router, prefix=settings.api_prefix)
app.include_router(speech.router, prefix=settings.api_prefix)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="italk-api",
        version="1.0.0",
        supabase_configured=settings.is_supabase_configured,
        groq_configured=bool(settings.groq_api_key),
    )
