from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user
from app.models.schemas import UserContext, VocabularyItem

router = APIRouter(prefix="/vocabulary", tags=["Vocabulary"])


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
    if response.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response.error)
    return [_map_vocabulary_item(item, user) for item in response.data]


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
    if item_response.error or not item_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary item not found")

    client.postgrest.from_("review_events").insert(
        {
            "user_id": str(user.user_id),
            "vocabulary_item_id": item_id,
            "rating": rating,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()

    return {
        "item_id": item_id,
        "rating": rating,
        "next_review": datetime.now(timezone.utc).isoformat(),
    }
