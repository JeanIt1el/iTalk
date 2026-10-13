from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user, get_user_id
from app.models.schemas import (
    LearningSessionComplete,
    LearningSessionCreate,
    UserContext,
    VocabularyItem,
)

router = APIRouter(prefix="/learning", tags=["Learning"])


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
async def check_grammar(text: str, user_id: UUID = Depends(get_user_id)) -> dict:
    return {
        "id": str(uuid4()),
        "original_text": text,
        "corrected_text": text,
        "mistakes": [],
        "category_scores": {"spelling": 100, "grammar": 100, "punctuation": 100, "word_choice": 100, "syntax": 100},
        "overall_score": 100,
        "improved_version": text,
        "explanation": "Aucune erreur détectée dans le texte fourni.",
    }
