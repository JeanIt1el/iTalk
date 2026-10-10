from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user
from app.models.schemas import UserContext, VocabularyItem, VocabularyItemCreate

router = APIRouter(prefix="/vocabulary", tags=["Vocabulary"])


def _raise_for_database_error(response, detail: str) -> None:
    if getattr(response, "error", None):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


def _map_vocabulary_item(item: dict, user: UserContext) -> VocabularyItem:
    return VocabularyItem(
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


@router.get("/items", response_model=list[VocabularyItem])
def get_vocabulary_items(user: UserContext = Depends(get_current_user)) -> list[VocabularyItem]:
    client = _create_supabase_client(user.access_token)
    response = (
        client.postgrest.from_("vocabulary_items")
        .select("id, word, translation, context_sentence, next_review_at, srs_level")
        .eq("user_id", str(user.user_id))
        .order("next_review_at", desc=False)
        .execute()
    )
    if getattr(response, "error", None):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to load vocabulary items")
    return [_map_vocabulary_item(item, user) for item in response.data]


@router.post("/items", response_model=VocabularyItem)
def create_vocabulary_item(
    payload: VocabularyItemCreate,
    user: UserContext = Depends(get_current_user),
) -> VocabularyItem:
    client = _create_supabase_client(user.access_token)
    response = client.postgrest.from_("vocabulary_items").insert(
        {
            "user_id": str(user.user_id),
            "word": payload.word,
            "translation": payload.translation,
            "context_sentence": payload.context_sentence,
        }
    ).select("id, word, translation, context_sentence, next_review_at, srs_level").execute()
    _raise_for_database_error(response, "Unable to save vocabulary item")
    return _map_vocabulary_item(response.data[0], user)


@router.patch("/items/{item_id}/review")
def review_vocabulary_item(
    item_id: str,
    rating: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    if rating not in {"again", "hard", "good", "easy"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid rating")

    client = _create_supabase_client(user.access_token)
    item_response = (
        client.postgrest.from_("vocabulary_items")
        .select("id")
        .eq("id", item_id)
        .eq("user_id", str(user.user_id))
        .execute()
    )
    if getattr(item_response, "error", None) or not item_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary item not found")

    now = datetime.now(timezone.utc)
    item_response = client.postgrest.from_("vocabulary_items").select(
        "srs_level, interval_days"
    ).eq("id", item_id).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(item_response, "Unable to load vocabulary item")
    item = item_response.data[0]
    current_level = item["srs_level"]
    next_level = 0 if rating == "again" else min(current_level + (2 if rating == "easy" else 1), 5)
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
