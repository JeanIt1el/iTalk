from datetime import datetime, timezone
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_user_id
from app.core.config import get_settings
from app.models.schemas import (
    ConversationMessage,
    ConversationMessageRequest,
    ConversationSession,
    ConversationSessionCreate,
    ConversationSummary,
    Correction,
)

router = APIRouter(prefix="/conversation", tags=["Conversation"])
settings = get_settings()


async def generate_tutor_reply(
    messages: list[dict], user_message: str
) -> str:
    """Generate a tutor reply with the configured Groq model."""
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Groq API is not configured",
        )

    payload = {
        "model": settings.groq_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Tu es un tuteur de langue français qui aide l'utilisateur à "
                    "pratiquer la conversation. Réponds en français naturellement, "
                    "en proposant des corrections et des exemples lorsqu'ils sont utiles."
                ),
            },
            *messages,
            {"role": "user", "content": user_message},
        ],
        "temperature": settings.groq_temperature,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Groq returned an empty response",
        )
    return content.strip()


@router.get("/scenarios")
async def get_scenarios() -> list[dict]:
    return [
        {
            "id": "restaurant",
            "title": "Au restaurant",
            "description": "Commander un repas, demander des recommandations",
            "icon": "UtensilsCrossed",
            "level": "B1",
            "estimated_duration": 10,
        },
        {
            "id": "airport",
            "title": "À l'aéroport",
            "description": "Enregistrement, sécurité, correspondances",
            "icon": "Plane",
            "level": "B1",
            "estimated_duration": 8,
        },
    ]


@router.post("/sessions", response_model=ConversationSession)
async def start_session(
    payload: ConversationSessionCreate, user_id: UUID = Depends(get_user_id)
) -> ConversationSession:
    return ConversationSession(
        id=uuid4(),
        scenario=payload.scenario,
        title=payload.title or "Conversation libre",
        description=payload.description or "Conversation en langue cible",
        level="B1",
        messages=[
            ConversationMessage(
                id=uuid4(),
                role="assistant",
                content="Bonjour ! Je suis votre partenaire de conversation IA. De quoi aimeriez-vous parler aujourd'hui ?",
                translation="Bonjour ! Je suis votre partenaire de conversation IA. De quoi aimeriez-vous parler aujourd'hui ?",
            )
        ],
    )


@router.post("/sessions/{session_id}/messages", response_model=ConversationMessage)
async def send_message(
    session_id: UUID,
    payload: ConversationMessageRequest,
    user_id: UUID = Depends(get_user_id),
) -> ConversationMessage:
    reply = await generate_tutor_reply(
        messages=[
            {
                "role": "assistant",
                "content": "Bonjour ! Je suis votre partenaire de conversation IA.",
            }
        ],
        user_message=payload.content,
    )
    return ConversationMessage(
        role="assistant",
        content=reply,
        translation=reply,
        suggestions=["Je peux approfondir ce sujet", "Je peux donner un exemple"],
    )


@router.post("/sessions/{session_id}/end", response_model=ConversationSummary)
async def end_session(
    session_id: UUID, user_id: UUID = Depends(get_user_id)
) -> ConversationSummary:
    return ConversationSummary(
        session_id=session_id,
        duration=12,
        messages_exchanged=8,
        corrections_count=3,
        strengths=["Fluidité correcte", "Vocabulaire varié"],
        areas_to_improve=["Noms indénombrables", "Prépositions de temps"],
        new_vocabulary=[{"word": "to book", "translation": "réserver"}],
        overall_score=76,
    )


@router.get("/sessions/{session_id}/messages", response_model=list[ConversationMessage])
async def get_messages(
    session_id: UUID, user_id: UUID = Depends(get_user_id)
) -> list[ConversationMessage]:
    return []


@router.get("/sessions", response_model=list[ConversationSession])
async def get_sessions(user_id: UUID = Depends(get_user_id)) -> list[ConversationSession]:
    return []


@router.get("/corrections", response_model=list[Correction])
async def get_corrections(
    user_id: UUID = Depends(get_user_id),
) -> list[Correction]:
    return []
