from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import _create_supabase_client, get_current_user
from app.models.schemas import ProgressOverview, UserContext

router = APIRouter(prefix="/progress", tags=["Progress"])


def _progress_overview(user: UserContext) -> ProgressOverview:
    client = _create_supabase_client(user.access_token)
    skill_response = (
        client.postgrest.from_("skill_progress")
        .select("skill_name, level_estimate, updated_at")
        .eq("user_id", str(user.user_id))
        .execute()
    )
    session_response = (
        client.postgrest.from_("learning_sessions")
        .select("id, module_type, score, duration_seconds, started_at")
        .eq("user_id", str(user.user_id))
        .order("started_at", desc=False)
        .execute()
    )
    if skill_response.error or session_response.error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load progress",
        )

    skill_scores = []
    for skill in skill_response.data:
        skill_scores.append(
            {
                "skill": skill["skill_name"],
                "score": 0,
                "level": skill["level_estimate"],
                "progress": 0,
                "trend": "stable",
            }
        )

    sessions = session_response.data
    recent_activities = []
    for session in sessions:
        recent_activities.append(
            {
                "id": str(session["id"]),
                "type": session["module_type"],
                "title": session["module_type"],
                "duration": session["duration_seconds"] or 0,
                "date": datetime.fromisoformat(
                    session["started_at"].replace("Z", "+00:00")
                ).date().isoformat(),
                "score": session.get("score"),
            }
        )

    return ProgressOverview(
        total_minutes=sum(
            (session["duration_seconds"] or 0) // 60 for session in sessions
        ),
        total_lessons=len(sessions),
        current_streak=0,
        longest_streak=0,
        weekly_minutes=0,
        weekly_goal=140,
        skill_scores=skill_scores,
        cefr_progression=[],
        recent_activities=recent_activities,
        recommendations=[],
    )


@router.get("/overview", response_model=ProgressOverview)
def get_progress_overview(user: UserContext = Depends(get_current_user)) -> ProgressOverview:
    return _progress_overview(user)
