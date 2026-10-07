from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import _create_supabase_client
from app.core.config import get_settings
from app.models.schemas import AuthRequest, LoginResponse, RegisterRequest

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _ensure_profile(client, user) -> None:
    """Create the user profile on first sign-in using the authenticated user ID."""
    full_name = user.user_metadata.get("full_name") or user.email or "Utilisateur"
    client.postgrest.from_("profiles").upsert(
        {
            "id": user.id,
            "full_name": full_name,
            "native_language": "fr",
            "target_language": "en",
            "level": "A1",
        },
        on_conflict="id",
    ).execute()


def _auth_response(response) -> LoginResponse:
    user = response.user
    session = response.session
    if not user or not session or not session.access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase authentication failed",
        )

    return LoginResponse(
        user={
            "id": user.id,
            "name": user.user_metadata.get("full_name", user.email or ""),
            "email": user.email,
            "target_language": "en",
            "cefr_level": "A1",
        },
        is_authenticated=True,
        token=session.access_token,
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: AuthRequest) -> LoginResponse:
    if not settings.supabase_url or not (settings.supabase_anon_key or settings.supabase_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured",
        )

    try:
        response = _create_supabase_client().auth.sign_in_with_password(
            {
                "email": payload.email,
                "password": payload.password,
            }
        )
        if response.user and response.session:
            _ensure_profile(
                _create_supabase_client(response.session.access_token),
                response.user,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc
    return _auth_response(response)


@router.post("/register", response_model=LoginResponse)
async def register(payload: RegisterRequest) -> LoginResponse:
    if not settings.supabase_url or not (settings.supabase_anon_key or settings.supabase_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase authentication is not configured",
        )

    try:
        response = _create_supabase_client().auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {
                    "data": {"full_name": payload.name},
                },
            }
        )
        if response.user and response.session:
            _ensure_profile(
                _create_supabase_client(response.session.access_token),
                response.user,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create the account",
        ) from exc
    return _auth_response(response)
