import json
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import ValidationError

from app.api.dependencies import _create_supabase_admin_client, _create_supabase_client, get_current_user
from app.core.config import get_settings
from app.models.schemas import (
    CEFR_LEVEL,
    GeneratedVocabularyWord,
    UserContext,
    VocabularyCollectionResponse,
    VocabularyExplainRequest,
    VocabularyExplainResponse,
    VocabularyGenerateRequest,
    VocabularyGenerateResponse,
    VocabularyItem,
    VocabularyItemCreate,
    VocabularyQuizAnswerRequest,
    VocabularyQuizAnswerResponse,
    VocabularyQuizCreateRequest,
    VocabularyQuizHistoryItem,
    VocabularyQuizQuestion,
    VocabularyQuizResponse,
    VocabularyReviewRequest,
    VocabularyReviewResponse,
    SavedGeneratedVocabularyWord,
    VocabularyScenarioResponse,
    VocabularyWordResponse,
)

router = APIRouter(prefix="/vocabulary", tags=["Vocabulary"])
settings = get_settings()
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"


def _raise_for_database_error(response: Any, detail: str) -> None:
    if getattr(response, "error", None):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


def _rows(response: Any, detail: str) -> list[dict[str, Any]]:
    _raise_for_database_error(response, detail)
    return response.data or []


def _one(response: Any, detail: str) -> dict[str, Any] | None:
    rows = _rows(response, detail)
    return rows[0] if rows else None


def _normalize_answer(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold().replace("’", "'")
    return re.sub(r"\s+", " ", normalized).strip().strip(".,!?;:'\" ")


def _map_legacy_item(item: dict[str, Any]) -> VocabularyItem:
    next_review = item.get("next_review_at") or datetime.now(timezone.utc).isoformat()
    return VocabularyItem(
        id=UUID(item["id"]),
        word=item["word"],
        translation=item["translation"],
        language="fr",
        phonetic="",
        part_of_speech="",
        example=item.get("context_sentence") or "",
        example_translation="",
        level="A1",
        collection="personal",
        srs_level=item.get("srs_level", 0),
        next_review=datetime.fromisoformat(next_review.replace("Z", "+00:00")),
        last_reviewed=None,
    )


def _map_catalog_item(
    item: dict[str, Any],
    progress: dict[str, dict[str, Any]] | None = None,
    favorite_slugs: set[str] | None = None,
) -> VocabularyWordResponse:
    state = (progress or {}).get(item["slug"], {})
    return VocabularyWordResponse(
        **item,
        mastery_level=state.get("mastery_level", 0),
        next_review_at=state.get("next_review_at"),
        is_favorite=item["slug"] in (favorite_slugs or set()),
    )


def _load_user_word_state(
    client: Any, user_id: UUID, slugs: list[str]
) -> tuple[dict[str, dict[str, Any]], set[str]]:
    if not slugs:
        return {}, set()
    progress_rows = _rows(
        client.postgrest.from_("vocabulary_user_progress")
        .select("vocabulary_item_slug, mastery_level, next_review_at, last_reviewed_at, repetitions, successes, failures")
        .eq("user_id", str(user_id))
        .in_("vocabulary_item_slug", slugs)
        .execute(),
        "Unable to load vocabulary progress",
    )
    favorite_rows = _rows(
        client.postgrest.from_("vocabulary_favorites")
        .select("vocabulary_item_slug")
        .eq("user_id", str(user_id))
        .in_("vocabulary_item_slug", slugs)
        .execute(),
        "Unable to load vocabulary favorites",
    )
    progress = {row["vocabulary_item_slug"]: row for row in progress_rows}
    favorites = {row["vocabulary_item_slug"] for row in favorite_rows}
    return progress, favorites


def _load_catalog_items(client: Any, slugs: list[str]) -> list[dict[str, Any]]:
    if not slugs:
        return []
    return _rows(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("*")
        .eq("is_published", True)
        .in_("slug", slugs)
        .execute(),
        "Unable to load vocabulary words",
    )


def _public_quiz_session(row: dict[str, Any]) -> VocabularyQuizResponse:
    stored_questions = row.get("questions") or []
    if isinstance(stored_questions, str):
        stored_questions = json.loads(stored_questions)
    questions = [
        VocabularyQuizQuestion(
            index=question["index"],
            type=question["type"],
            prompt=question["prompt"],
            options=question.get("options", []),
        )
        for question in stored_questions
    ]
    return VocabularyQuizResponse(
        id=UUID(row["id"]),
        questions=questions,
        answered_count=row.get("answered_count", 0),
        status=row["status"],
        score=row.get("score"),
        started_at=row.get("started_at") or row.get("created_at") or datetime.now(timezone.utc),
        time_limit_seconds=row.get("time_limit_seconds"),
    )


def _consume_ai_quota(client: Any, user_id: UUID) -> None:
    response = client.rpc("consume_vocabulary_ai_request", {"p_user_id": str(user_id)}).execute()
    if getattr(response, "error", None):
        if getattr(response.error, "code", None) == "P0001":
            raise HTTPException(status_code=429, detail="Daily vocabulary AI limit reached")
        raise HTTPException(status_code=500, detail="Unable to validate vocabulary AI quota")


async def _groq_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    if not settings.groq_api_key or not settings.groq_model.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vocabulary AI is not configured",
        )
    payload = {
        "model": settings.groq_model.strip(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": min(settings.groq_temperature, 0.7),
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json=payload,
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        result = json.loads(content)
        if not isinstance(result, dict):
            raise ValueError("Unexpected JSON response")
        return result
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vocabulary AI could not complete the request",
        ) from exc


@router.get("/collections", response_model=list[VocabularyCollectionResponse])
def get_collections(
    level: CEFR_LEVEL | None = None,
    q: str | None = Query(default=None, max_length=100),
    user: UserContext = Depends(get_current_user),
) -> list[VocabularyCollectionResponse]:
    client = _create_supabase_client(user.access_token)
    query = client.postgrest.from_("vocabulary_collections").select("*").eq("is_published", True)
    if level:
        query = query.eq("cefr_level", level)
    if q:
        query = query.ilike("title", f"%{q.strip()}%")
    collections = _rows(query.order("title").execute(), "Unable to load vocabulary collections")
    links = _rows(
        client.postgrest.from_("vocabulary_collection_items")
        .select("collection_slug, vocabulary_item_slug")
        .in_("collection_slug", [collection["slug"] for collection in collections])
        .execute(),
        "Unable to load vocabulary collection words",
    ) if collections else []
    progress_rows = _rows(
        client.postgrest.from_("vocabulary_user_progress")
        .select("vocabulary_item_slug, mastery_level")
        .eq("user_id", str(user.user_id))
        .gte("mastery_level", 4)
        .execute(),
        "Unable to load vocabulary progress",
    )
    mastered = {row["vocabulary_item_slug"] for row in progress_rows}
    links_by_collection: dict[str, list[str]] = {}
    for link in links:
        links_by_collection.setdefault(link["collection_slug"], []).append(link["vocabulary_item_slug"])
    return [
        VocabularyCollectionResponse(
            **collection,
            word_count=len(links_by_collection.get(collection["slug"], [])),
            mastered_count=sum(slug in mastered for slug in links_by_collection.get(collection["slug"], [])),
        )
        for collection in collections
    ]


@router.get("/collections/{collection_slug}", response_model=VocabularyCollectionResponse)
def get_collection(
    collection_slug: str, user: UserContext = Depends(get_current_user)
) -> VocabularyCollectionResponse:
    client = _create_supabase_client(user.access_token)
    collection = _one(
        client.postgrest.from_("vocabulary_collections")
        .select("*")
        .eq("slug", collection_slug)
        .eq("is_published", True)
        .execute(),
        "Unable to load vocabulary collection",
    )
    if collection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary collection not found")
    links = _rows(
        client.postgrest.from_("vocabulary_collection_items")
        .select("vocabulary_item_slug")
        .eq("collection_slug", collection_slug)
        .execute(),
        "Unable to load vocabulary collection words",
    )
    slugs = [link["vocabulary_item_slug"] for link in links]
    mastered = _rows(
        client.postgrest.from_("vocabulary_user_progress")
        .select("vocabulary_item_slug")
        .eq("user_id", str(user.user_id))
        .gte("mastery_level", 4)
        .in_("vocabulary_item_slug", slugs)
        .execute(),
        "Unable to load vocabulary progress",
    ) if slugs else []
    return VocabularyCollectionResponse(
        **collection, word_count=len(slugs), mastered_count=len(mastered)
    )


@router.get("/collections/{collection_slug}/words")
def get_collection_words(
    collection_slug: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    q: str | None = Query(default=None, max_length=100),
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    return get_words(
        q=q,
        collection_slug=collection_slug,
        page=page,
        page_size=page_size,
        user=user,
    )


@router.get("/words")
def get_words(
    q: str | None = Query(default=None, max_length=100),
    level: CEFR_LEVEL | None = None,
    collection_slug: str | None = Query(default=None, max_length=120),
    favorite_only: bool = False,
    due_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    client = _create_supabase_client(user.access_token)
    collection_slugs: list[str] | None = None
    if collection_slug:
        links = _rows(
            client.postgrest.from_("vocabulary_collection_items")
            .select("vocabulary_item_slug")
            .eq("collection_slug", collection_slug)
            .execute(),
            "Unable to load collection words",
        )
        collection_slugs = [link["vocabulary_item_slug"] for link in links]
        if not collection_slugs:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

    favorite_slugs: set[str] | None = None
    if favorite_only:
        favorite_rows = _rows(
            client.postgrest.from_("vocabulary_favorites")
            .select("vocabulary_item_slug")
            .eq("user_id", str(user.user_id))
            .execute(),
            "Unable to load vocabulary favorites",
        )
        favorite_slugs = {row["vocabulary_item_slug"] for row in favorite_rows}
        if not favorite_slugs:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

    if due_only:
        due_rows = _rows(
            client.postgrest.from_("vocabulary_user_progress")
            .select("vocabulary_item_slug")
            .eq("user_id", str(user.user_id))
            .lte("next_review_at", datetime.now(timezone.utc).isoformat())
            .execute(),
            "Unable to load due vocabulary reviews",
        )
        due_slugs = {row["vocabulary_item_slug"] for row in due_rows}
        if not due_slugs:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        favorite_slugs = due_slugs if favorite_slugs is None else favorite_slugs & due_slugs

    filters = [value for value in (collection_slugs, list(favorite_slugs) if favorite_slugs is not None else None) if value is not None]
    allowed_slugs: set[str] | None = set(filters[0]) if filters else None
    for values in filters[1:]:
        allowed_slugs = (allowed_slugs or set()) & set(values)
    if allowed_slugs is not None and not allowed_slugs:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    base = client.postgrest.from_("vocabulary_catalog_items").select("*", count="exact").eq("is_published", True)
    if level:
        base = base.eq("cefr_level", level)
    if allowed_slugs is not None:
        base = base.in_("slug", list(allowed_slugs))
    if q and q.strip():
        search = q.strip()
        english_rows = _rows(base.ilike("word", f"%{search}%").limit(500).execute(), "Unable to search vocabulary")
        french_query = client.postgrest.from_("vocabulary_catalog_items").select("*").eq("is_published", True)
        if level:
            french_query = french_query.eq("cefr_level", level)
        if allowed_slugs is not None:
            french_query = french_query.in_("slug", list(allowed_slugs))
        french_rows = _rows(french_query.ilike("translation_fr", f"%{search}%").limit(500).execute(), "Unable to search vocabulary")
        combined = {item["slug"]: item for item in [*english_rows, *french_rows]}
        all_items = sorted(combined.values(), key=lambda item: item["normalized_word"])
        total = len(all_items)
        start = (page - 1) * page_size
        items = all_items[start:start + page_size]
    else:
        response = base.order("normalized_word").range((page - 1) * page_size, page * page_size - 1).execute()
        _raise_for_database_error(response, "Unable to load vocabulary words")
        items = response.data or []
        total = response.count if response.count is not None else len(items)

    progress, favorites = _load_user_word_state(client, user.user_id, [item["slug"] for item in items])
    mapped = [_map_catalog_item(item, progress, favorites).model_dump(mode="json", by_alias=True) for item in items]
    return {"items": mapped, "total": total, "page": page, "page_size": page_size}


@router.get("/search")
def search_vocabulary(
    q: str = Query(min_length=1, max_length=100),
    level: CEFR_LEVEL | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    return get_words(q=q, level=level, page=page, page_size=page_size, user=user)


@router.get("/words/{word_slug}", response_model=VocabularyWordResponse)
def get_word(word_slug: str, user: UserContext = Depends(get_current_user)) -> VocabularyWordResponse:
    client = _create_supabase_client(user.access_token)
    item = _one(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("*")
        .eq("slug", word_slug)
        .eq("is_published", True)
        .execute(),
        "Unable to load vocabulary word",
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary word not found")
    progress, favorites = _load_user_word_state(client, user.user_id, [word_slug])
    return _map_catalog_item(item, progress, favorites)


@router.get("/words/{word_slug}/related", response_model=list[VocabularyWordResponse])
def get_related_words(word_slug: str, user: UserContext = Depends(get_current_user)) -> list[VocabularyWordResponse]:
    client = _create_supabase_client(user.access_token)
    item = _one(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("cefr_level, tags")
        .eq("slug", word_slug)
        .eq("is_published", True)
        .execute(),
        "Unable to load vocabulary word",
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary word not found")
    related = _rows(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("*")
        .eq("is_published", True)
        .eq("cefr_level", item["cefr_level"])
        .neq("slug", word_slug)
        .limit(8)
        .execute(),
        "Unable to load related words",
    )
    related.sort(key=lambda candidate: len(set(candidate.get("tags", [])) & set(item.get("tags", []))), reverse=True)
    progress, favorites = _load_user_word_state(client, user.user_id, [candidate["slug"] for candidate in related])
    return [_map_catalog_item(candidate, progress, favorites) for candidate in related]


@router.get("/review/due", response_model=list[VocabularyWordResponse])
def get_due_reviews(
    limit: int = Query(default=50, ge=1, le=100),
    user: UserContext = Depends(get_current_user),
) -> list[VocabularyWordResponse]:
    client = _create_supabase_client(user.access_token)
    rows = _rows(
        client.postgrest.from_("vocabulary_user_progress")
        .select("vocabulary_item_slug, mastery_level, next_review_at, last_reviewed_at, repetitions, successes, failures")
        .eq("user_id", str(user.user_id))
        .lte("next_review_at", datetime.now(timezone.utc).isoformat())
        .order("next_review_at")
        .limit(limit)
        .execute(),
        "Unable to load due vocabulary reviews",
    )
    progress = {row["vocabulary_item_slug"]: row for row in rows}
    items = _load_catalog_items(client, list(progress))
    return [_map_catalog_item(item, progress) for item in items]


@router.get("/progress")
def get_vocabulary_progress(user: UserContext = Depends(get_current_user)) -> dict[str, Any]:
    client = _create_supabase_client(user.access_token)
    rows = _rows(
        client.postgrest.from_("vocabulary_user_progress")
        .select("mastery_level, next_review_at, repetitions, successes, failures")
        .eq("user_id", str(user.user_id))
        .execute(),
        "Unable to load vocabulary progress",
    )
    favorites = _rows(
        client.postgrest.from_("vocabulary_favorites")
        .select("vocabulary_item_slug")
        .eq("user_id", str(user.user_id))
        .execute(),
        "Unable to load vocabulary favorites",
    )
    quiz_answers = _rows(
        client.postgrest.from_("vocabulary_quiz_answers")
        .select("is_correct")
        .eq("user_id", str(user.user_id))
        .execute(),
        "Unable to load vocabulary quiz results",
    )
    now = datetime.now(timezone.utc)
    return {
        "studied_count": len(rows),
        "mastered_count": sum(row["mastery_level"] >= 4 for row in rows),
        "due_count": sum(datetime.fromisoformat(row["next_review_at"].replace("Z", "+00:00")) <= now for row in rows),
        "favorite_count": len(favorites),
        "successes": sum(row["successes"] for row in rows) + sum(answer["is_correct"] for answer in quiz_answers),
        "failures": sum(row["failures"] for row in rows) + sum(not answer["is_correct"] for answer in quiz_answers),
    }


@router.post("/reviews", response_model=VocabularyReviewResponse)
def record_review(
    request: VocabularyReviewRequest,
    user: UserContext = Depends(get_current_user),
) -> VocabularyReviewResponse:
    client = _create_supabase_client(user.access_token)
    response = client.rpc(
        "record_vocabulary_review",
        {
            "p_user_id": str(user.user_id),
            "p_vocabulary_item_slug": request.item_slug,
            "p_rating": request.rating,
            "p_request_id": str(request.request_id),
        },
    ).execute()
    _raise_for_database_error(response, "Unable to record vocabulary review")
    data = response.data
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Unable to record vocabulary review")
    return VocabularyReviewResponse.model_validate(data)


@router.get("/reviews/history")
def get_review_history(
    limit: int = Query(default=50, ge=1, le=100),
    user: UserContext = Depends(get_current_user),
) -> list[dict[str, Any]]:
    client = _create_supabase_client(user.access_token)
    return _rows(
        client.postgrest.from_("vocabulary_reviews")
        .select("id, vocabulary_item_slug, rating, is_correct, reviewed_at, next_review_at")
        .eq("user_id", str(user.user_id))
        .order("reviewed_at", desc=True)
        .limit(limit)
        .execute(),
        "Unable to load vocabulary review history",
    )


@router.get("/review/mistakes", response_model=list[VocabularyWordResponse])
def get_vocabulary_mistakes(
    limit: int = Query(default=50, ge=1, le=100),
    user: UserContext = Depends(get_current_user),
) -> list[VocabularyWordResponse]:
    client = _create_supabase_client(user.access_token)
    answer_rows = _rows(
        client.postgrest.from_("vocabulary_quiz_answers")
        .select("vocabulary_item_slug, answered_at")
        .eq("user_id", str(user.user_id))
        .eq("is_correct", False)
        .order("answered_at", desc=True)
        .limit(limit)
        .execute(),
        "Unable to load vocabulary mistakes",
    )
    slugs = list(dict.fromkeys(row["vocabulary_item_slug"] for row in answer_rows))
    items = _load_catalog_items(client, slugs)
    progress, favorites = _load_user_word_state(client, user.user_id, slugs)
    by_slug = {item["slug"]: item for item in items}
    return [_map_catalog_item(by_slug[slug], progress, favorites) for slug in slugs if slug in by_slug]


@router.get("/favorites", response_model=list[VocabularyWordResponse])
def get_favorites(user: UserContext = Depends(get_current_user)) -> list[VocabularyWordResponse]:
    client = _create_supabase_client(user.access_token)
    rows = _rows(
        client.postgrest.from_("vocabulary_favorites")
        .select("vocabulary_item_slug")
        .eq("user_id", str(user.user_id))
        .order("created_at", desc=True)
        .execute(),
        "Unable to load vocabulary favorites",
    )
    slugs = [row["vocabulary_item_slug"] for row in rows]
    items = _load_catalog_items(client, slugs)
    progress, favorites = _load_user_word_state(client, user.user_id, slugs)
    by_slug = {item["slug"]: item for item in items}
    return [_map_catalog_item(by_slug[slug], progress, favorites) for slug in slugs if slug in by_slug]


@router.post("/favorites/{word_slug}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(word_slug: str, user: UserContext = Depends(get_current_user)) -> Response:
    client = _create_supabase_client(user.access_token)
    item = _one(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("slug")
        .eq("slug", word_slug)
        .eq("is_published", True)
        .execute(),
        "Unable to load vocabulary word",
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Vocabulary word not found")
    response = client.postgrest.from_("vocabulary_favorites").upsert(
        {"user_id": str(user.user_id), "vocabulary_item_slug": word_slug},
        on_conflict="user_id,vocabulary_item_slug",
        ignore_duplicates=True,
    ).execute()
    _raise_for_database_error(response, "Unable to save vocabulary favorite")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/favorites/{word_slug}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(word_slug: str, user: UserContext = Depends(get_current_user)) -> Response:
    client = _create_supabase_client(user.access_token)
    response = client.postgrest.from_("vocabulary_favorites").delete().eq(
        "user_id", str(user.user_id)
    ).eq("vocabulary_item_slug", word_slug).execute()
    _raise_for_database_error(response, "Unable to remove vocabulary favorite")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/quizzes", response_model=VocabularyQuizResponse, status_code=status.HTTP_201_CREATED)
def create_quiz(
    request: VocabularyQuizCreateRequest,
    user: UserContext = Depends(get_current_user),
) -> VocabularyQuizResponse:
    client = _create_supabase_client(user.access_token)
    query = client.postgrest.from_("vocabulary_catalog_items").select("*").eq("is_published", True)
    if request.level:
        query = query.eq("cefr_level", request.level)
    if request.collection_slug:
        links = _rows(
            client.postgrest.from_("vocabulary_collection_items")
            .select("vocabulary_item_slug")
            .eq("collection_slug", request.collection_slug)
            .execute(),
            "Unable to load quiz collection",
        )
        slugs = [link["vocabulary_item_slug"] for link in links]
        if not slugs:
            raise HTTPException(status_code=422, detail="The selected collection has no words")
        query = query.in_("slug", slugs)
    candidates = _rows(query.limit(500).execute(), "Unable to prepare vocabulary quiz")
    if len(candidates) < 3:
        raise HTTPException(status_code=422, detail="At least three vocabulary words are required")

    import random

    randomizer = random.SystemRandom()
    selected = candidates[:]
    randomizer.shuffle(selected)
    selected = selected[:min(request.count, len(selected))]
    questions: list[dict[str, Any]] = []
    for index, item in enumerate(selected):
        question_type = request.question_types[index % len(request.question_types)]
        correct_answer = item["word"]
        options: list[str] = []
        if question_type in {"multiple_choice", "translation_match"}:
            prompt = f"Quelle est la traduction de « {item['word']} » ?"
            distractors = list(dict.fromkeys(
                candidate["translation_fr"]
                for candidate in candidates
                if candidate["slug"] != item["slug"]
                and _normalize_answer(candidate["translation_fr"]) != _normalize_answer(item["translation_fr"])
            ))
            randomizer.shuffle(distractors)
            options = [item["translation_fr"], *distractors[:3]]
            randomizer.shuffle(options)
            correct_answer = item["translation_fr"]
            question_type = "translation_match" if question_type == "translation_match" else "multiple_choice"
        elif question_type == "synonym":
            synonyms = item.get("synonyms") or []
            if not synonyms:
                question_type = "write_word"
                prompt = f"Écrivez le mot anglais correspondant à : « {item['translation_fr']} »"
            else:
                correct_answer = synonyms[0]
                prompt = f"Choisissez un synonyme de « {item['word']} »"
                distractors = list(dict.fromkeys(
                    synonym
                    for candidate in candidates
                    if candidate["slug"] != item["slug"]
                    for synonym in candidate.get("synonyms", [])
                    if _normalize_answer(synonym) != _normalize_answer(correct_answer)
                ))
                randomizer.shuffle(distractors)
                options = [correct_answer, *distractors[:3]]
                randomizer.shuffle(options)
        elif question_type == "scramble":
            letters = [character for character in item["word"].replace(" ", "") if character.isalpha()]
            if " " in item["word"] or len(letters) < 3 or len(set(letters)) < 2:
                question_type = "write_word"
                prompt = f"Écrivez le mot anglais correspondant à : « {item['translation_fr']} »"
            else:
                randomizer.shuffle(letters)
                prompt = f"Remettez ces lettres dans l’ordre : {' '.join(letters)}"
        elif question_type == "odd_one_out":
            tags = item.get("tags") or []
            group = [candidate for candidate in candidates if candidate["slug"] != item["slug"] and set(candidate.get("tags", [])) & set(tags)]
            outsiders = [candidate for candidate in candidates if candidate["slug"] != item["slug"] and not (set(candidate.get("tags", [])) & set(tags))]
            if tags and len(group) >= 2 and outsiders:
                randomizer.shuffle(group)
                odd = randomizer.choice(outsiders)
                options = [item["word"], group[0]["word"], group[1]["word"], odd["word"]]
                randomizer.shuffle(options)
                correct_answer = odd["word"]
                prompt = f"Trouvez l’intrus parmi ces mots liés au thème « {tags[0]} » :"
            else:
                question_type = "write_word"
                prompt = f"Écrivez le mot anglais correspondant à : « {item['translation_fr']} »"
        elif question_type == "fill_blank":
            sentence = item["example_en"]
            pattern = re.compile(re.escape(item["word"]), flags=re.IGNORECASE)
            if not pattern.search(sentence):
                question_type = "write_word"
                prompt = f"Écrivez le mot anglais correspondant à : « {item['translation_fr']} »"
            else:
                prompt = f"Complétez la phrase : {pattern.sub('_____', sentence, count=1)}"
        else:
            question_type = "write_word"
            prompt = f"Écrivez le mot anglais correspondant à : « {item['translation_fr']} »"
        questions.append({
            "index": index,
            "type": question_type,
            "prompt": prompt,
            "options": options,
            "answer": correct_answer,
            "accepted_answers": [correct_answer],
            "explanation": f"{item['word']} signifie « {item['translation_fr']} ». {item.get('usage_note_fr') or ''}".strip(),
            "item_slug": item["slug"],
        })

    admin_client = _create_supabase_admin_client()
    response = admin_client.rpc("create_vocabulary_quiz", {
        "p_user_id": str(user.user_id),
        "p_vocabulary_item_slugs": [item["slug"] for item in selected],
        "p_questions": questions,
        "p_time_limit_seconds": request.time_limit_seconds,
    }).execute()
    _raise_for_database_error(response, "Unable to create vocabulary quiz")
    row = response.data
    if isinstance(row, list) and row:
        row = row[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=500, detail="Unable to create vocabulary quiz")
    return _public_quiz_session(row)


@router.get("/quizzes/history", response_model=list[VocabularyQuizHistoryItem])
def get_vocabulary_quiz_history(
    limit: int = Query(default=20, ge=1, le=100),
    user: UserContext = Depends(get_current_user),
) -> list[VocabularyQuizHistoryItem]:
    client = _create_supabase_client(user.access_token)
    rows = _rows(
        client.postgrest.from_("vocabulary_quiz_sessions")
        .select("id, questions, answered_count, status, score, created_at, finished_at, time_limit_seconds")
        .eq("user_id", str(user.user_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute(),
        "Unable to load vocabulary quiz history",
    )
    return [VocabularyQuizHistoryItem(
        id=row["id"],
        status=row["status"],
        score=row.get("score"),
        answered_count=row.get("answered_count", 0),
        question_count=len(row.get("questions") or []),
        started_at=row["created_at"],
        finished_at=row.get("finished_at"),
        time_limit_seconds=row.get("time_limit_seconds"),
    ) for row in rows]


@router.get("/quizzes/{quiz_id}", response_model=VocabularyQuizResponse)
def get_quiz(quiz_id: UUID, user: UserContext = Depends(get_current_user)) -> VocabularyQuizResponse:
    client = _create_supabase_client(user.access_token)
    row = _one(
        client.postgrest.from_("vocabulary_quiz_sessions")
        .select("id, questions, answered_count, status, score, created_at, time_limit_seconds")
        .eq("id", str(quiz_id))
        .eq("user_id", str(user.user_id))
        .execute(),
        "Unable to load vocabulary quiz",
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Vocabulary quiz not found")
    return _public_quiz_session(row)


@router.post("/quizzes/{quiz_id}/answer", response_model=VocabularyQuizAnswerResponse)
def answer_quiz(
    quiz_id: UUID,
    request: VocabularyQuizAnswerRequest,
    user: UserContext = Depends(get_current_user),
) -> VocabularyQuizAnswerResponse:
    client = _create_supabase_client(user.access_token)
    response = client.rpc("answer_vocabulary_quiz", {
        "p_user_id": str(user.user_id),
        "p_quiz_id": str(quiz_id),
        "p_question_index": request.question_index,
        "p_answer": request.answer,
    }).execute()
    if getattr(response, "error", None):
        error_code = getattr(response.error, "code", None)
        if error_code == "P0002":
            raise HTTPException(status_code=404, detail="Vocabulary quiz or question not found")
        if error_code in {"22023", "23505", "55000"}:
            raise HTTPException(status_code=409, detail="Vocabulary quiz answer is invalid or already submitted")
        if error_code == "42501":
            raise HTTPException(status_code=403, detail="Not authorized")
        raise HTTPException(status_code=500, detail="Unable to check vocabulary quiz answer")
    data = response.data
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Unable to check vocabulary quiz answer")
    return VocabularyQuizAnswerResponse.model_validate(data)


@router.post("/quizzes/{quiz_id}/finish", response_model=VocabularyQuizResponse)
def finish_quiz(quiz_id: UUID, user: UserContext = Depends(get_current_user)) -> VocabularyQuizResponse:
    client = _create_supabase_client(user.access_token)
    response = client.rpc("finish_vocabulary_quiz", {
        "p_user_id": str(user.user_id),
        "p_quiz_id": str(quiz_id),
    }).execute()
    if getattr(response, "error", None):
        if getattr(response.error, "code", None) == "P0002":
            raise HTTPException(status_code=404, detail="Vocabulary quiz not found")
        if getattr(response.error, "code", None) == "55000":
            raise HTTPException(status_code=409, detail="Answer all quiz questions before finishing")
        if getattr(response.error, "code", None) == "42501":
            raise HTTPException(status_code=403, detail="Not authorized")
        raise HTTPException(status_code=500, detail="Unable to finish vocabulary quiz")
    row = response.data
    if isinstance(row, list) and row:
        row = row[0]
    if not isinstance(row, dict):
        raise HTTPException(status_code=500, detail="Unable to finish vocabulary quiz")
    return _public_quiz_session(row)


@router.get("/scenarios", response_model=list[VocabularyScenarioResponse])
def get_scenarios(
    level: CEFR_LEVEL | None = None,
    user: UserContext = Depends(get_current_user),
) -> list[VocabularyScenarioResponse]:
    client = _create_supabase_client(user.access_token)
    query = client.postgrest.from_("vocabulary_scenarios").select("*").eq("is_published", True)
    if level:
        query = query.eq("cefr_level", level)
    scenarios = _rows(query.order("title").execute(), "Unable to load vocabulary scenarios")
    links = _rows(
        client.postgrest.from_("vocabulary_scenario_items")
        .select("scenario_slug, vocabulary_item_slug")
        .in_("scenario_slug", [scenario["slug"] for scenario in scenarios])
        .execute(),
        "Unable to load scenario vocabulary",
    ) if scenarios else []
    slugs_by_scenario: dict[str, list[str]] = {}
    for link in links:
        slugs_by_scenario.setdefault(link["scenario_slug"], []).append(link["vocabulary_item_slug"])
    all_slugs = [slug for slugs in slugs_by_scenario.values() for slug in slugs]
    items = _load_catalog_items(client, list(set(all_slugs)))
    items_by_slug = {item["slug"]: item for item in items}
    progress, favorites = _load_user_word_state(client, user.user_id, list(items_by_slug))
    return [
        VocabularyScenarioResponse(
            **scenario,
            words=[
                _map_catalog_item(items_by_slug[slug], progress, favorites)
                for slug in slugs_by_scenario.get(scenario["slug"], [])
                if slug in items_by_slug
            ],
        )
        for scenario in scenarios
    ]


@router.get("/scenarios/{scenario_slug}", response_model=VocabularyScenarioResponse)
def get_scenario(scenario_slug: str, user: UserContext = Depends(get_current_user)) -> VocabularyScenarioResponse:
    scenarios = get_scenarios(user=user)
    scenario = next((item for item in scenarios if item.slug == scenario_slug), None)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Vocabulary scenario not found")
    return scenario


def _catalog_vocabulary_fallback(
    request: VocabularyGenerateRequest,
    user: UserContext,
) -> VocabularyGenerateResponse:
    client = _create_supabase_client(user.access_token)
    candidates = _rows(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("word, translation_fr, part_of_speech, cefr_level, ipa, example_en, example_fr, usage_note_fr, synonyms, tags")
        .eq("is_published", True)
        .eq("cefr_level", request.level)
        .limit(500)
        .execute(),
        "Unable to load vocabulary fallback",
    )
    topic_terms = set(re.findall(r"[a-zA-ZÀ-ÿ]+", request.topic.casefold()))
    candidates.sort(
        key=lambda item: sum(
            term in " ".join([item["word"], item["translation_fr"], *item.get("tags", [])]).casefold()
            for term in topic_terms
        ),
        reverse=True,
    )
    items = [GeneratedVocabularyWord.model_validate(item) for item in candidates[:request.count]]
    if not items:
        raise HTTPException(status_code=503, detail="Vocabulary catalog fallback is unavailable")
    return VocabularyGenerateResponse(items=items, source_type="catalog_fallback")


@router.post("/ai/generate", response_model=VocabularyGenerateResponse)
async def generate_vocabulary(
    request: VocabularyGenerateRequest,
    user: UserContext = Depends(get_current_user),
) -> VocabularyGenerateResponse:
    if not settings.groq_api_key or not settings.groq_model.strip():
        return _catalog_vocabulary_fallback(request, user)
    quota_client = _create_supabase_client(user.access_token)
    try:
        _consume_ai_quota(quota_client, user.user_id)
    except HTTPException as exc:
        if exc.status_code in {429, 502, 503}:
            return _catalog_vocabulary_fallback(request, user)
        raise
    system_prompt = (
        "Tu es un lexicographe pédagogique pour des francophones apprenant l'anglais. "
        "Retourne uniquement un objet JSON {items: [...]} conforme au schéma demandé. "
        "Choisis du vocabulaire naturel, différencié et adapté au niveau CECR demandé. "
        "Les traductions et exemples doivent être exacts. L'IPA est facultatif et doit rester vide si incertain."
    )
    user_prompt = (
        f"Thème : {request.topic}. Niveau CECR : {request.level}. Nombre exact : {request.count}. "
        f"Objectif : {request.goal or 'communication quotidienne'}. Explications en français. "
        "Chaque élément doit contenir word, translation_fr, part_of_speech, cefr_level, ipa, example_en, "
        "example_fr, usage_note_fr, synonyms et tags. Pas de doublons."
    )
    try:
        generated = await _groq_json(system_prompt, user_prompt)
        result = VocabularyGenerateResponse.model_validate(generated)
        if len(result.items) != request.count:
            raise ValueError("Unexpected number of items")
        normalized_words = [_normalize_answer(item.word) for item in result.items]
        if len(set(normalized_words)) != len(normalized_words):
            raise ValueError("Duplicate vocabulary items")
        if any(item.cefr_level != request.level for item in result.items):
            raise ValueError("Generated level does not match request")
    except (ValidationError, ValueError) as exc:
        return _catalog_vocabulary_fallback(request, user)
    except HTTPException as exc:
        if exc.status_code not in {502, 503}:
            raise
        return _catalog_vocabulary_fallback(request, user)
    return result


@router.post("/ai/explain", response_model=VocabularyExplainResponse)
async def explain_vocabulary(
    request: VocabularyExplainRequest,
    user: UserContext = Depends(get_current_user),
) -> VocabularyExplainResponse:
    if not settings.groq_api_key or not settings.groq_model.strip():
        return _catalog_explanation_fallback(request, user)
    quota_client = _create_supabase_client(user.access_token)
    try:
        _consume_ai_quota(quota_client, user.user_id)
    except HTTPException as exc:
        if exc.status_code in {429, 502, 503}:
            return _catalog_explanation_fallback(request, user)
        raise
    system_prompt = (
        "Tu es un professeur d'anglais pour francophones. Réponds uniquement par un JSON avec "
        "explanation_fr, examples (1 à 4 phrases anglaises avec leur traduction française), et common_mistake_fr. "
        "Si un comparison_word est fourni, explique clairement la différence d'usage."
    )
    user_prompt = json.dumps(request.model_dump(), ensure_ascii=False)
    generated = await _groq_json(system_prompt, user_prompt)
    try:
        return VocabularyExplainResponse.model_validate(generated)
    except ValidationError as exc:
        return _catalog_explanation_fallback(request, user)
    except HTTPException as exc:
        if exc.status_code not in {502, 503}:
            raise
        return _catalog_explanation_fallback(request, user)


def _catalog_explanation_fallback(
    request: VocabularyExplainRequest,
    user: UserContext,
) -> VocabularyExplainResponse:
    client = _create_supabase_client(user.access_token)
    item = _one(
        client.postgrest.from_("vocabulary_catalog_items")
        .select("word, translation_fr, example_en, example_fr, usage_note_fr")
        .eq("is_published", True)
        .eq("normalized_word", _normalize_answer(request.word))
        .execute(),
        "Unable to load vocabulary explanation fallback",
    )
    if item is None:
        raise HTTPException(status_code=503, detail="Vocabulary explanation fallback is unavailable")
    explanation = f"{item['word']} signifie « {item['translation_fr']} ». {item.get('usage_note_fr') or ''}".strip()
    return VocabularyExplainResponse(
        explanation_fr=explanation,
        examples=[f"{item['example_en']} — {item['example_fr']}"],
        common_mistake_fr="Vérifiez la construction et le contexte décrits dans la fiche avant de réutiliser ce mot.",
        source_type="catalog_fallback",
    )


@router.get("/ai/saved", response_model=list[SavedGeneratedVocabularyWord])
def get_saved_generated_words(user: UserContext = Depends(get_current_user)) -> list[SavedGeneratedVocabularyWord]:
    client = _create_supabase_client(user.access_token)
    rows = _rows(
        client.postgrest.from_("vocabulary_generated_words")
        .select("id, word, translation_fr, part_of_speech, cefr_level, ipa, example_en, example_fr, usage_note_fr, synonyms, tags, source_type, created_at")
        .eq("user_id", str(user.user_id))
        .order("created_at", desc=True)
        .execute(),
        "Unable to load saved generated vocabulary",
    )
    return [SavedGeneratedVocabularyWord.model_validate(row) for row in rows]


@router.post("/ai/saved", response_model=SavedGeneratedVocabularyWord, status_code=status.HTTP_201_CREATED)
def save_generated_word(
    request: GeneratedVocabularyWord,
    user: UserContext = Depends(get_current_user),
) -> SavedGeneratedVocabularyWord:
    client = _create_supabase_client(user.access_token)
    normalized_word = _normalize_answer(request.word)
    existing = _one(
        client.postgrest.from_("vocabulary_generated_words")
        .select("id, word, translation_fr, part_of_speech, cefr_level, ipa, example_en, example_fr, usage_note_fr, synonyms, tags, source_type, created_at")
        .eq("user_id", str(user.user_id))
        .eq("normalized_word", normalized_word)
        .execute(),
        "Unable to check saved generated vocabulary",
    )
    if existing is not None:
        return SavedGeneratedVocabularyWord.model_validate(existing)
    response = client.postgrest.from_("vocabulary_generated_words").insert({
        **request.model_dump(),
        "user_id": str(user.user_id),
        "normalized_word": normalized_word,
        "source_type": "ai_generated",
    }).select("id, word, translation_fr, part_of_speech, cefr_level, ipa, example_en, example_fr, usage_note_fr, synonyms, tags, source_type, created_at").execute()
    row = _one(response, "Unable to save generated vocabulary")
    if row is None:
        raise HTTPException(status_code=500, detail="Unable to save generated vocabulary")
    return SavedGeneratedVocabularyWord.model_validate(row)


@router.delete("/ai/saved/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_generated_word(word_id: UUID, user: UserContext = Depends(get_current_user)) -> Response:
    client = _create_supabase_client(user.access_token)
    response = client.postgrest.from_("vocabulary_generated_words").delete().eq(
        "id", str(word_id)
    ).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(response, "Unable to delete saved generated vocabulary")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Legacy user-owned vocabulary endpoints remain available for existing clients.
@router.get("/items", response_model=list[VocabularyItem])
def get_vocabulary_items(user: UserContext = Depends(get_current_user)) -> list[VocabularyItem]:
    client = _create_supabase_client(user.access_token)
    rows = _rows(
        client.postgrest.from_("vocabulary_items")
        .select("id, word, translation, context_sentence, next_review_at, srs_level")
        .eq("user_id", str(user.user_id))
        .order("next_review_at")
        .execute(),
        "Unable to load vocabulary items",
    )
    return [_map_legacy_item(item) for item in rows]


@router.post("/items", response_model=VocabularyItem)
def create_vocabulary_item(
    payload: VocabularyItemCreate,
    user: UserContext = Depends(get_current_user),
) -> VocabularyItem:
    client = _create_supabase_client(user.access_token)
    response = client.postgrest.from_("vocabulary_items").insert({
        "user_id": str(user.user_id),
        "word": payload.word,
        "translation": payload.translation,
        "context_sentence": payload.context_sentence,
    }).select("id, word, translation, context_sentence, next_review_at, srs_level").execute()
    row = _one(response, "Unable to save vocabulary item")
    if row is None:
        raise HTTPException(status_code=500, detail="Unable to save vocabulary item")
    return _map_legacy_item(row)


@router.patch("/items/{item_id}/review")
def review_legacy_vocabulary_item(
    item_id: UUID,
    rating: str = Query(pattern="^(again|hard|good|easy)$"),
    user: UserContext = Depends(get_current_user),
) -> dict[str, Any]:
    client = _create_supabase_client(user.access_token)
    item = _one(
        client.postgrest.from_("vocabulary_items")
        .select("id, srs_level, interval_days")
        .eq("id", str(item_id))
        .eq("user_id", str(user.user_id))
        .execute(),
        "Unable to load vocabulary item",
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Vocabulary item not found")
    now = datetime.now(timezone.utc)
    intervals = {"again": 1, "hard": max(1, item["interval_days"]), "good": max(1, item["interval_days"] * 2), "easy": max(2, item["interval_days"] * 3)}
    interval_days = intervals[rating]
    level = 0 if rating == "again" else min(5, item["srs_level"] + (2 if rating == "easy" else 1))
    next_review = now.replace(microsecond=0) + __import__("datetime").timedelta(days=interval_days)
    update = client.postgrest.from_("vocabulary_items").update({
        "srs_level": level,
        "interval_days": interval_days,
        "next_review_at": next_review.isoformat(),
        "updated_at": now.isoformat(),
    }).eq("id", str(item_id)).eq("user_id", str(user.user_id)).execute()
    _raise_for_database_error(update, "Unable to update vocabulary schedule")
    event = client.postgrest.from_("review_events").insert({
        "user_id": str(user.user_id),
        "vocabulary_item_id": str(item_id),
        "rating": rating,
        "reviewed_at": now.isoformat(),
    }).execute()
    _raise_for_database_error(event, "Unable to save vocabulary review")
    return {"item_id": str(item_id), "rating": rating, "next_review": next_review.isoformat(), "srs_level": level}