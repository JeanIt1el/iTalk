from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user, get_user_id
from app.models.schemas import (
    ConversationMessage,
    ProfileResponse,
    ReadingContent,
    ReadingProgressRequest,
    UserContext,
    VocabularyItem,
)

router = APIRouter(prefix="/learning", tags=["Learning"])


@router.get("/modules")
async def get_modules(user_id: UUID = Depends(get_user_id)) -> dict:
    return {
        "modules": [
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
                "completed_lessons": 2,
                "progress": 40,
                "is_locked": False,
            }
        ],
        "total": 1,
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
    if response.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response.error)
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
    client.postgrest.from_("review_events").insert(
        {
            "user_id": str(user.user_id),
            "vocabulary_item_id": item_id,
            "rating": rating,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return {"item_id": item_id, "rating": rating, "next_review": datetime.now(timezone.utc).isoformat()}


@router.get("/reading", response_model=list[ReadingContent])
def get_reading_texts(user: UserContext = Depends(get_current_user)) -> list[ReadingContent]:
    client = _create_supabase_client(user.access_token)
    response = (
        client.postgrest.from_("reading_contents")
        .select("id, title, level, topic, content")
        .execute()
    )
    if response.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response.error)
    return [
        ReadingContent(
            id=UUID(item["id"]),
            title=item["title"],
            author="",
            level=item["level"],
            content=item["content"],
            word_count=len(item["content"].split()),
            estimated_reading_time=0,
            topic=item["topic"],
            difficult_words=[],
            audio_url=None,
        )
        for item in response.data
    ]


@router.patch("/reading/progress")
async def update_reading_progress(
    payload: ReadingProgressRequest, user_id: UUID = Depends(get_user_id)
) -> dict:
    return payload.model_dump()


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
