from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from supabase import Client, ClientOptions, create_client

from app.core.config import get_settings
from app.models.schemas import UserContext


settings = get_settings()


def _create_supabase_client(access_token: str | None = None) -> Client:
    """Create a client using only public Supabase credentials."""
    public_key = settings.supabase_anon_key or settings.supabase_key
    if not settings.supabase_url or not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured",
        )

    options = None
    if access_token:
        options = ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return create_client(settings.supabase_url, public_key, options=options)


def get_current_user(
    authorization: str | None = Header(default=None),
) -> UserContext:
    """Validate a bearer access token with Supabase Auth and return its user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer access token",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer access token",
        )

    try:
        supabase_user = _create_supabase_client(token).auth.get_user(jwt=token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer access token",
        ) from exc

    if not supabase_user or not supabase_user.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer access token",
        )

    try:
        user_id = UUID(supabase_user.user.id)
        email = supabase_user.user.email or ""
        user_metadata = getattr(supabase_user.user, "user_metadata", {}) or {}
        full_name = user_metadata.get("full_name") or user_metadata.get("name") or ""
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer access token",
        ) from exc

    return UserContext(
        user_id=user_id,
        access_token=token,
        email=email,
        full_name=full_name,
    )


def get_user_id(user: UserContext = Depends(get_current_user)) -> UUID:
    return user.user_id
