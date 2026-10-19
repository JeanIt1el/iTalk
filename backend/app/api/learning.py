from datetime import datetime, timedelta, timezone
import json
from typing import Literal
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError

from app.api.dependencies import _create_supabase_client, get_current_user, get_user_id
from app.core.config import get_settings
from app.models.schemas import (
    LearningSessionComplete,
    LearningSessionCreate,
    UserContext,
    VocabularyItem,
)

router = APIRouter(prefix="/learning", tags=["Learning"])
settings = get_settings()
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"

GrammarCategory = Literal["spelling", "grammar", "punctuation", "word_choice", "syntax"]


class GrammarCheckRequest(BaseModel):
    text: str = Field(min_length=3, max_length=5000)
    level: Literal["A1", "A2", "B1", "B2", "C1", "C2"] = "B1"


class GrammarMistakeDraft(BaseModel):
    original_text: str = Field(min_length=1)
    corrected_text: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    category: GrammarCategory


class GrammarCategoryScores(BaseModel):
    spelling: int = Field(ge=0, le=100)
    grammar: int = Field(ge=0, le=100)
    punctuation: int = Field(ge=0, le=100)
    word_choice: int = Field(ge=0, le=100)
    syntax: int = Field(ge=0, le=100)


class GrammarAnalysis(BaseModel):
    mistakes: list[GrammarMistakeDraft]
    category_scores: GrammarCategoryScores
    improved_version: str = Field(min_length=1)
    explanation: str = Field(min_length=1)


def _raise_for_database_error(response, detail: str) -> None:
    if getattr(response, "error", None):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


@router.post("/sessions")
def start_learning_session(
    payload: LearningSessionCreate,
    user: UserContext = Depends(get_current_user),
) -> dict:
    client = _create_supabase_client(user.access_token)
    session_id = uuid4()
    started_at = datetime.now(timezone.utc)
    response = client.postgrest.from_("learning_sessions").insert(
        {
            "id": str(session_id),
            "user_id": str(user.user_id),
            "module_type": payload.module_type,
            "scenario": payload.scenario,
            "title": payload.title,
            "description": payload.description,
            "level": payload.level,
            "started_at": started_at.isoformat(),
        }
    ).execute()
    _raise_for_database_error(response, "Unable to start learning session")
    return {"id": str(session_id), "started_at": started_at.isoformat()}


@router.patch("/sessions/{session_id}/complete")
def complete_learning_session(
    session_id: UUID,
    payload: LearningSessionComplete,
    user: UserContext = Depends(get_current_user),
) -> dict:
    client = _create_supabase_client(user.access_token)
    response = client.postgrest.from_("learning_sessions").update(
        {
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": payload.duration_seconds,
            "score": payload.score,
        }
    ).eq("id", str(session_id)).eq("user_id", str(user.user_id)).select("*").execute()
    _raise_for_database_error(response, "Unable to complete learning session")
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning session not found")
    session = response.data[0]
    progress_response = client.postgrest.from_("skill_progress").upsert(
        {
            "user_id": str(user.user_id),
            "skill_name": session["module_type"],
            "level_estimate": session["level"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,skill_name",
    ).execute()
    _raise_for_database_error(progress_response, "Unable to update skill progress")
    return session


@router.get("/modules")
async def get_modules(user: UserContext = Depends(get_current_user)) -> dict:
    client = _create_supabase_client(user.access_token)
    response = client.postgrest.from_("learning_sessions").select(
        "scenario, ended_at"
    ).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(response, "Unable to load module progress")
    completed_by_module: dict[str, int] = {}
    for session in response.data:
        if session.get("scenario") and session.get("ended_at"):
            module_id = session["scenario"]
            completed_by_module[module_id] = completed_by_module.get(module_id, 0) + 1

    modules = [
        {
            "id": "mod-001",
            "title": "Conversation au restaurant",
            "description": "Commandez, demandez des recommandations et payez.",
            "category": "conversation",
            "skill": "conversation",
            "level": "B1",
            "topic": "Voyage",
            "duration_minutes": 10,
            "difficulty": "intermediate",
            "thumbnail_color": "primary",
            "lessons_count": 5,
            "is_locked": False,
        }
    ]
    for module in modules:
        module["completed_lessons"] = min(completed_by_module.get(module["id"], 0), module["lessons_count"])
        module["progress"] = round(module["completed_lessons"] / module["lessons_count"] * 100)
    return {
        "modules": modules,
        "total": len(modules),
    }


@router.get("/vocabulary", response_model=list[VocabularyItem])
def get_vocabulary(user: UserContext = Depends(get_current_user)) -> list[VocabularyItem]:
    client = _create_supabase_client(user.access_token)
    response = (
        client.postgrest.from_("vocabulary_items")
        .select("id, word, translation, context_sentence, next_review_at, srs_level")
        .eq("user_id", str(user.user_id))
        .execute()
    )
    if getattr(response, "error", None):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to load vocabulary")
    return [
        VocabularyItem(
            id=UUID(item["id"]),
            word=item["word"],
            translation=item["translation"],
            language="fr",
            phonetic="",
            part_of_speech="",
            example=item.get("context_sentence", ""),
            example_translation="",
            level="A1",
            collection="personal",
            srs_level=item["srs_level"],
            next_review=datetime.fromisoformat(item["next_review_at"].replace("Z", "+00:00")),
            last_reviewed=None,
        )
        for item in response.data
    ]


@router.patch("/vocabulary/{item_id}/review")
def review_vocabulary(
    item_id: str,
    rating: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    if rating not in {"again", "hard", "good", "easy"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid rating")
    client = _create_supabase_client(user.access_token)
    item_response = client.postgrest.from_("vocabulary_items").select(
        "srs_level, interval_days"
    ).eq("id", item_id).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(item_response, "Unable to load vocabulary item")
    if not item_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary item not found")
    item = item_response.data[0]
    now = datetime.now(timezone.utc)
    next_level = 0 if rating == "again" else min(item["srs_level"] + (2 if rating == "easy" else 1), 5)
    interval_days = {
        "again": 0,
        "hard": max(1, item["interval_days"]),
        "good": max(1, item["interval_days"] * 2),
        "easy": max(2, item["interval_days"] * 3),
    }[rating]
    next_review = now + timedelta(days=interval_days)
    update_response = client.postgrest.from_("vocabulary_items").update(
        {
            "srs_level": next_level,
            "interval_days": interval_days,
            "next_review_at": next_review.isoformat(),
            "updated_at": now.isoformat(),
        }
    ).eq("id", item_id).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(update_response, "Unable to update vocabulary schedule")
    event_response = client.postgrest.from_("review_events").insert(
        {
            "user_id": str(user.user_id),
            "vocabulary_item_id": item_id,
            "rating": rating,
            "reviewed_at": now.isoformat(),
        }
    ).execute()
    _raise_for_database_error(event_response, "Unable to save vocabulary review")
    return {
        "item_id": item_id,
        "rating": rating,
        "next_review": next_review.isoformat(),
        "srs_level": next_level,
    }


@router.post("/grammar")
async def check_grammar(
    request: GrammarCheckRequest, user_id: UUID = Depends(get_user_id)
) -> dict:
    if not settings.groq_api_key or not settings.groq_model.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Groq is not configured",
        )

    system_prompt = (
        "Analyse ce texte d'apprenant en anglais avec précision, sans inventer d'erreur. "
        "Réponds uniquement en JSON avec les clés mistakes, category_scores, improved_version, explanation. "
        "Chaque mistake doit contenir original_text (sous-chaîne exacte et contiguë du texte), corrected_text, "
        "explanation (en français, contexte et règle), category parmi spelling, grammar, punctuation, "
        "word_choice, syntax. category_scores doit donner un entier 0-100 pour chaque catégorie. "
        "L'explication générale doit résumer les tendances et priorités de progrès. Conserve le sens et le registre. "
        "Pour un texte correct, retourne mistakes vide, scores à 100 et une explication positive. "
    )
    payload = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Niveau CECR de l'apprenant : {request.level}.\nTexte à analyser :\n{request.text}",
            },
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json=payload,
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        analysis = GrammarAnalysis.model_validate(json.loads(content))
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to analyse grammar text",
        ) from exc

    mistakes = []
    search_from = 0
    for mistake in analysis.mistakes:
        start_index = request.text.find(mistake.original_text, search_from)
        if start_index < 0:
            start_index = request.text.find(mistake.original_text)
        if start_index < 0:
            continue
        end_index = start_index + len(mistake.original_text)
        search_from = end_index
        mistakes.append(
            {
                "id": str(uuid4()),
                **mistake.model_dump(),
                "start_index": start_index,
                "end_index": end_index,
            }
        )

    category_scores = analysis.category_scores.model_dump()
    overall_score = round(sum(category_scores.values()) / len(category_scores))
    return {
        "id": str(uuid4()),
        "original_text": request.text,
        "corrected_text": analysis.improved_version,
        "mistakes": mistakes,
        "category_scores": category_scores,
        "overall_score": overall_score,
        "improved_version": analysis.improved_version,
        "explanation": analysis.explanation,
    }
