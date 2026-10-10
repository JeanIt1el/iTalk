from datetime import date, datetime, timedelta, timezone

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
        .select("id, module_type, score, duration_seconds, started_at, ended_at")
        .eq("user_id", str(user.user_id))
        .order("started_at", desc=False)
        .execute()
    )
    preferences_response = (
        client.postgrest.from_("learning_preferences")
        .select("daily_goal_minutes")
        .eq("user_id", str(user.user_id))
        .execute()
    )
    if (
        getattr(skill_response, "error", None)
        or getattr(session_response, "error", None)
        or getattr(preferences_response, "error", None)
    ):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load progress",
        )

    sessions = session_response.data
    scores_by_skill: dict[str, list[int]] = {}
    for session in sessions:
        if session.get("score") is not None:
            scores_by_skill.setdefault(session["module_type"], []).append(session["score"])

    skill_scores = []
    for skill in skill_response.data:
        scores = scores_by_skill.get(skill["skill_name"], [])
        score = round(sum(scores) / len(scores)) if scores else 0
        skill_scores.append(
            {
                "skill": skill["skill_name"],
                "score": score,
                "level": skill["level_estimate"],
                "progress": score,
                "trend": "stable",
            }
        )

    parsed_sessions = [
        (session, datetime.fromisoformat(session["started_at"].replace("Z", "+00:00")))
        for session in sessions
    ]
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    weekly_seconds = sum(
        session.get("duration_seconds") or 0
        for session, started_at in parsed_sessions
        if started_at.astimezone(timezone.utc).date() >= monday
    )
    activity_dates = sorted({started_at.astimezone(timezone.utc).date() for _, started_at in parsed_sessions})
    current_streak = 0
    streak_cursor = today if today in activity_dates else today - timedelta(days=1)
    while streak_cursor in activity_dates:
        current_streak += 1
        streak_cursor -= timedelta(days=1)
    longest_streak = 0
    running_streak = 0
    previous_day: date | None = None
    for activity_day in activity_dates:
        running_streak = running_streak + 1 if previous_day and activity_day == previous_day + timedelta(days=1) else 1
        longest_streak = max(longest_streak, running_streak)
        previous_day = activity_day

    recent_activities = []
    for session, started_at in reversed(parsed_sessions[-10:]):
        recent_activities.append(
            {
                "id": str(session["id"]),
                "type": session["module_type"],
                "title": session["module_type"],
                "duration": session["duration_seconds"] or 0,
                "date": started_at.astimezone(timezone.utc).date().isoformat(),
                "score": session.get("score"),
            }
        )

    return ProgressOverview(
        total_minutes=sum(
            (session["duration_seconds"] or 0) // 60 for session in sessions
        ),
        total_lessons=sum(session.get("ended_at") is not None for session in sessions),
        current_streak=current_streak,
        longest_streak=longest_streak,
        weekly_minutes=weekly_seconds // 60,
        weekly_goal=(preferences_response.data[0]["daily_goal_minutes"] if preferences_response.data else 20) * 7,
        skill_scores=skill_scores,
        cefr_progression=[],
        recent_activities=recent_activities,
        recommendations=[],
    )


@router.get("/overview", response_model=ProgressOverview)
def get_progress_overview(user: UserContext = Depends(get_current_user)) -> ProgressOverview:
    return _progress_overview(user)
