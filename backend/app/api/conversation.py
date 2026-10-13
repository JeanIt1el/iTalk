from datetime import datetime, timezone
import json
import logging
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user
from app.core.config import get_settings
from app.models.schemas import (
    ConversationMessage,
    ConversationMessageRequest,
    ConversationSession,
    ConversationSessionCreate,
    ConversationSummary,
    Correction,
    UserContext,
)

router = APIRouter(prefix="/conversation", tags=["Conversation"])
settings = get_settings()
logger = logging.getLogger(__name__)
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
SYSTEM_PROMPT = (
    "Tu es iTalk, un véritable partenaire de conversation en anglais, chaleureux et naturel, comme "
    "une personne avec qui l'on échange au quotidien. Maintiens un échange fluide, spontané et "
    "cohérent avec le contexte; parle principalement en anglais et adapte naturellement ton "
    "vocabulaire au niveau de l'apprenant. Quand l'utilisateur fait une erreur de syntaxe, de "
    "grammaire ou de vocabulaire, corrige-la avec tact au fil de ta réponse: reformule naturellement "
    "la phrase juste ou glisse le bon mot dans ta réponse, sans interrompre la conversation ni "
    "transformer l'échange en leçon. Réponds d'abord au sens de son message, puis termine chaque "
    "réponse par une question ouverte pertinente qui invite à continuer."
)


def _raise_for_database_error(response, detail: str) -> None:
    if getattr(response, "error", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )


def _get_owned_session(client, session_id: UUID, user_id: UUID) -> dict:
    response = (
        client.postgrest.from_("learning_sessions")
        .select("id, scenario, title, description, level, module_type, started_at, ended_at, duration_seconds, score")
        .eq("id", str(session_id))
        .eq("user_id", str(user_id))
        .eq("module_type", "conversation")
        .execute()
    )
    _raise_for_database_error(response, "Unable to load conversation session")
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation session not found")
    return response.data[0]


def _load_session_messages(client, session_id: UUID) -> list[dict]:
    response = (
        client.postgrest.from_("conversation_messages")
        .select("id, sender_role, content, translation, timestamp")
        .eq("session_id", str(session_id))
        .order("timestamp", desc=False)
        .execute()
    )
    _raise_for_database_error(response, "Unable to load conversation messages")
    return response.data


def _map_message(message: dict) -> ConversationMessage:
    return ConversationMessage(
        id=UUID(message["id"]),
        role=message["sender_role"],
        content=message["content"],
        translation=message.get("translation") or "",
        timestamp=datetime.fromisoformat(message["timestamp"].replace("Z", "+00:00")),
    )


async def generate_tutor_reply(
    messages: list[dict], user_message: str
) -> str:
    """Generate a tutor reply with the configured Groq model."""
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Groq API is not configured",
        )

    model = (settings.groq_model or "").strip()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Groq model is not configured",
        )

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    SYSTEM_PROMPT
                ),
            },
            *messages,
            {"role": "user", "content": user_message},
        ],
        "temperature": settings.groq_temperature,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        logger.debug(
            "Groq request URL=%s payload=%s",
            GROQ_CHAT_COMPLETIONS_URL,
            json.dumps(payload, ensure_ascii=False),
        )
        try:
            response = await client.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json=payload,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Groq request failed: status=%s URL=%s response=%s",
                exc.response.status_code,
                GROQ_CHAT_COMPLETIONS_URL,
                exc.response.text,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Groq API returned HTTP {exc.response.status_code}",
            ) from exc
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
    return []


@router.post("/sessions", response_model=ConversationSession)
async def start_session(
    payload: ConversationSessionCreate, user: UserContext = Depends(get_current_user)
) -> ConversationSession:
    client = _create_supabase_client(user.access_token)
    profile_response = (
        client.postgrest.from_("profiles")
        .select("id")
        .eq("id", str(user.user_id))
        .execute()
    )
    _raise_for_database_error(profile_response, "Unable to load user profile")
    if not profile_response.data:
        profile_insert = client.postgrest.from_("profiles").upsert(
            {
                "id": str(user.user_id),
                "full_name": user.full_name or user.email or "Utilisateur",
                "native_language": "fr",
                "target_language": "en",
                "level": "A1",
            },
            on_conflict="id",
        ).execute()
        _raise_for_database_error(profile_insert, "Unable to create user profile")

    session_id = uuid4()
    started_at = datetime.now(timezone.utc)
    title = payload.title or "Conversation libre"
    description = payload.description or "Conversation en langue cible"
    response = client.postgrest.from_("learning_sessions").insert(
        {
            "id": str(session_id),
            "user_id": str(user.user_id),
            "module_type": "conversation",
            "scenario": payload.scenario,
            "title": title,
            "description": description,
            "started_at": started_at.isoformat(),
        }
    ).execute()
    _raise_for_database_error(response, "Unable to create conversation session")

    welcome = ConversationMessage(
        role="assistant",
        content="Hello! I'm your English conversation partner. What would you like to talk about today?",
        translation="Bonjour ! Je suis votre partenaire de conversation en anglais. De quoi aimeriez-vous parler aujourd'hui ?",
    )
    message_response = client.postgrest.from_("conversation_messages").insert(
        {
            "id": str(welcome.id),
            "session_id": str(session_id),
            "sender_role": "assistant",
            "content": welcome.content,
            "translation": welcome.translation,
        }
    ).execute()
    _raise_for_database_error(message_response, "Unable to save conversation greeting")
    return ConversationSession(
        id=session_id,
        scenario=payload.scenario,
        title=title,
        description=description,
        level="B1",
        messages=[welcome],
        started_at=started_at,
        messages_count=1,
    )


@router.post("/sessions/{session_id}/messages", response_model=ConversationMessage)
async def send_message(
    session_id: UUID,
    payload: ConversationMessageRequest,
    user: UserContext = Depends(get_current_user),
) -> ConversationMessage:
    client = _create_supabase_client(user.access_token)
    session = _get_owned_session(client, session_id, user.user_id)
    user_message = {
        "id": str(uuid4()),
        "session_id": str(session_id),
        "sender_role": "user",
        "content": payload.content,
    }
    save_user_message = client.postgrest.from_("conversation_messages").insert(user_message).execute()
    _raise_for_database_error(save_user_message, "Unable to save user message")

    stored_messages = _load_session_messages(client, session_id)
    history = [
        {"role": message["sender_role"], "content": message["content"]}
        for message in stored_messages
        if message["id"] != user_message["id"]
    ]
    system_context = {
        "role": "system",
        "content": f"Contexte de la session : scénario {session.get('scenario') or 'conversation libre'}, "
        f"niveau {session.get('level') or 'B1'}. Titre : {session.get('title') or 'Conversation libre'}.",
    }
    reply = await generate_tutor_reply(
        messages=[system_context, *history],
        user_message=payload.content,
    )
    assistant_message = ConversationMessage(
        role="assistant",
        content=reply,
        translation="",
    )
    save_assistant_message = client.postgrest.from_("conversation_messages").insert(
        {
            "id": str(assistant_message.id),
            "session_id": str(session_id),
            "sender_role": "assistant",
            "content": reply,
        }
    ).execute()
    _raise_for_database_error(save_assistant_message, "Unable to save tutor response")
    return assistant_message


@router.post("/sessions/{session_id}/end", response_model=ConversationSummary)
async def end_session(
    session_id: UUID, user: UserContext = Depends(get_current_user)
) -> ConversationSummary:
    client = _create_supabase_client(user.access_token)
    _get_owned_session(client, session_id, user.user_id)
    messages = _load_session_messages(client, session_id)
    ended_at = datetime.now(timezone.utc)
    session_response = client.postgrest.from_("learning_sessions").select(
        "started_at"
    ).eq("id", str(session_id)).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(session_response, "Unable to load conversation session")
    started_at = datetime.fromisoformat(session_response.data[0]["started_at"].replace("Z", "+00:00"))
    duration_seconds = max(0, int((ended_at - started_at).total_seconds()))
    update_response = client.postgrest.from_("learning_sessions").update(
        {"ended_at": ended_at.isoformat(), "duration_seconds": duration_seconds}
    ).eq("id", str(session_id)).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(update_response, "Unable to end conversation session")
    user_message_count = sum(message["sender_role"] == "user" for message in messages)
    correction_response = client.postgrest.from_("corrections").select(
        "id", count="exact"
    ).in_("message_id", [message["id"] for message in messages]).execute() if messages else None
    if correction_response:
        _raise_for_database_error(correction_response, "Unable to load conversation corrections")
    return ConversationSummary(
        session_id=session_id,
        duration=duration_seconds // 60,
        messages_exchanged=user_message_count,
        corrections_count=correction_response.count or 0 if correction_response else 0,
        strengths=[],
        areas_to_improve=[],
        new_vocabulary=[],
        overall_score=0,
    )


@router.get("/sessions/{session_id}/messages", response_model=list[ConversationMessage])
async def get_messages(
    session_id: UUID, user: UserContext = Depends(get_current_user)
) -> list[ConversationMessage]:
    client = _create_supabase_client(user.access_token)
    _get_owned_session(client, session_id, user.user_id)
    return [_map_message(message) for message in _load_session_messages(client, session_id)]


@router.get("/sessions", response_model=list[ConversationSession])
async def get_sessions(user: UserContext = Depends(get_current_user)) -> list[ConversationSession]:
    client = _create_supabase_client(user.access_token)
    response = (
        client.postgrest.from_("learning_sessions")
        .select("id, scenario, title, description, started_at, ended_at, duration_seconds, score")
        .eq("user_id", str(user.user_id))
        .eq("module_type", "conversation")
        .order("started_at", desc=True)
        .execute()
    )
    _raise_for_database_error(response, "Unable to load conversation sessions")
    sessions = []
    for session in response.data:
        messages = _load_session_messages(client, UUID(session["id"]))
        sessions.append(
            ConversationSession(
                id=UUID(session["id"]),
                scenario=session.get("scenario") or "free_talk",
                title=session.get("title") or "Conversation libre",
                description=session.get("description") or "Conversation en langue cible",
                level="B1",
                messages=[_map_message(message) for message in messages],
                started_at=datetime.fromisoformat(session["started_at"].replace("Z", "+00:00")),
                ended_at=datetime.fromisoformat(session["ended_at"].replace("Z", "+00:00")) if session.get("ended_at") else None,
                duration=(session.get("duration_seconds") or 0) // 60,
                messages_count=len(messages),
            )
        )
    return sessions


@router.get("/corrections", response_model=list[Correction])
async def get_corrections(
    user: UserContext = Depends(get_current_user),
) -> list[Correction]:
    client = _create_supabase_client(user.access_token)
    session_response = client.postgrest.from_("learning_sessions").select("id").eq(
        "user_id", str(user.user_id)
    ).eq("module_type", "conversation").execute()
    _raise_for_database_error(session_response, "Unable to load conversation sessions")
    session_ids = [session["id"] for session in session_response.data]
    if not session_ids:
        return []
    message_response = client.postgrest.from_("conversation_messages").select("id").in_(
        "session_id", session_ids
    ).execute()
    _raise_for_database_error(message_response, "Unable to load conversation messages")
    message_ids = [message["id"] for message in message_response.data]
    if not message_ids:
        return []
    correction_response = client.postgrest.from_("corrections").select(
        "id, message_id, original_text, corrected_text, category, explanation"
    ).in_("message_id", message_ids).execute()
    _raise_for_database_error(correction_response, "Unable to load corrections")
    return [Correction(**correction) for correction in correction_response.data]
