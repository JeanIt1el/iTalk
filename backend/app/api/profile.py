from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user
from app.models.schemas import ProfileResponse, ProfileUpdate, UserContext

router = APIRouter(prefix="/profile", tags=["Profile"])


def _load_profile(user: UserContext) -> dict:
    client = _create_supabase_client(user.access_token)
    profile_response = client.postgrest.from_("profiles").select(
        "id, full_name, native_language, target_language, level, avatar_url, created_at"
    ).eq("id", str(user.user_id)).execute()
    if getattr(profile_response, "error", None) or not profile_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    preferences_response = (
        client.postgrest.from_("learning_preferences")
        .select("daily_goal_minutes, topics, interests")
        .eq("user_id", str(user.user_id))
        .execute()
    )
    preferences = preferences_response.data[0] if preferences_response.data else {}
    profile = profile_response.data[0]
    return {
        **profile,
        "email": user.email,
        "goals": preferences.get("topics", []),
        "interests": preferences.get("interests", []),
        "daily_goal_minutes": preferences.get("daily_goal_minutes", 20),
        "pace": "regular",
        "streak_days": 0,
        "total_minutes_studied": 0,
        "preferences": {
            "show_translations": True,
            "auto_play_audio": False,
            "text_size": "medium",
            "reduced_motion": False,
        },
    }


@router.get("/me", response_model=ProfileResponse)
def get_profile(user: UserContext = Depends(get_current_user)) -> ProfileResponse:
    profile = _load_profile(user)
    joined_at = profile["created_at"]
    if isinstance(joined_at, str):
        joined_at = datetime.fromisoformat(joined_at.replace("Z", "+00:00"))
    return ProfileResponse(
        id=UUID(profile["id"]),
        name=profile["full_name"],
        email=user.email,
        avatar_url=profile.get("avatar_url"),
        interface_language=profile["native_language"],
        target_language=profile["target_language"],
        cefr_level=profile["level"],
        goals=profile["goals"],
        interests=profile["interests"],
        pace=profile["pace"],
        daily_goal_minutes=profile["daily_goal_minutes"],
        streak_days=profile["streak_days"],
        total_minutes_studied=profile["total_minutes_studied"],
        joined_at=joined_at.astimezone(timezone.utc) if joined_at.tzinfo else joined_at,
        preferences=profile["preferences"],
    )


@router.patch("/me", response_model=ProfileResponse)
def update_profile(
    updates: ProfileUpdate, user: UserContext = Depends(get_current_user)
) -> ProfileResponse:
    client = _create_supabase_client(user.access_token)
    profile_updates = {
        key: value
        for key, value in {
            "full_name": updates.full_name,
            "native_language": updates.native_language,
            "target_language": updates.target_language,
            "level": updates.level,
        }.items()
        if value is not None
    }
    client.postgrest.from_("profiles").update(profile_updates).eq(
        "id", str(user.user_id)
    ).execute()

    if updates.goals or updates.interests or updates.pace or updates.daily_goal_minutes:
        preference_data = {
            "user_id": str(user.user_id),
            "daily_goal_minutes": updates.daily_goal_minutes or 20,
            "topics": updates.goals or [],
            "interests": updates.interests or [],
        }
        preferences_response = (
            client.postgrest.from_("learning_preferences")
            .select("id")
            .eq("user_id", str(user.user_id))
            .execute()
        )
        if preferences_response.data:
            client.postgrest.from_("learning_preferences").update(preference_data).eq(
                "user_id", str(user.user_id)
            ).execute()
        else:
            client.postgrest.from_("learning_preferences").insert(preference_data).execute()

    return get_profile(user)
