from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user
from app.models.schemas import ReadingContent, ReadingProgressRequest, UserContext

router = APIRouter(prefix="/reading", tags=["Reading"])


def _map_reading_content(item: dict) -> ReadingContent:
    return ReadingContent(
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


@router.get("/contents", response_model=list[ReadingContent])
def get_reading_contents(user: UserContext = Depends(get_current_user)) -> list[ReadingContent]:
    client = _create_supabase_client(user.access_token)
    response = (
        client.postgrest.from_("reading_contents")
        .select("id, title, level, topic, content")
        .order("created_at", desc=False)
        .execute()
    )
    if response.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response.error)
    return [_map_reading_content(item) for item in response.data]


@router.patch("/progress")
def update_reading_progress(
    payload: ReadingProgressRequest,
    user: UserContext = Depends(get_current_user),
) -> dict:
    client = _create_supabase_client(user.access_token)
    progress = {
        "user_id": str(user.user_id),
        "skill_name": "reading",
        "level_estimate": "A1",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    client.postgrest.from_("skill_progress").upsert(
        progress,
        on_conflict="user_id,skill_name",
    ).execute()
    return payload.model_dump()
