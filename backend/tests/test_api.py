from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_conversation_session_route_is_registered_at_api_prefix():
    assert "/api/v1/conversation/sessions" in app.openapi()["paths"]


def test_grammar_roadmaps_cover_all_cefr_levels():
    levels = client.get("/api/v1/grammar/levels")
    assert levels.status_code == 200
    assert [item["level"] for item in levels.json()] == ["A1", "A2", "B1", "B2", "C1", "C2"]

    expected_topic_counts = {"A1": 48, "A2": 18, "B1": 17, "B2": 16, "C1": 13, "C2": 10}
    level_counts = {item["level"]: item["topic_count"] for item in levels.json()}
    assert level_counts == expected_topic_counts

    for level in ("A1", "A2", "B1", "B2", "C1", "C2"):
        roadmap = client.get(f"/api/v1/grammar/roadmap/{level}")
        assert roadmap.status_code == 200
        assert roadmap.json()["categories"]
        assert all(category["topics"] for category in roadmap.json()["categories"])
        assert sum(len(category["topics"]) for category in roadmap.json()["categories"]) == level_counts[level]
        for category in roadmap.json()["categories"]:
            for topic in category["topics"]:
                assert topic["formula"]
                assert topic["explanation"]
                assert {exercise["type"] for exercise in topic["exercises"]} == {
                    "multiple_choice", "fill_blank", "rephrase"
                }
                for exercise in topic["exercises"]:
                    assert exercise["prompt"]
                    assert "answer" not in exercise
                    assert "explanation" not in exercise


def test_grammar_topic_detail_and_missing_topic():
    topic = client.get("/api/v1/grammar/topics/a1-be")
    assert topic.status_code == 200
    assert topic.json()["level"] == "A1"
    assert topic.json()["examples"]
    assert topic.json()["exceptions"]
    assert all("answer" not in exercise for exercise in topic.json()["exercises"])

    missing = client.get("/api/v1/grammar/topics/not-a-topic")
    assert missing.status_code == 404


def test_a1_catalog_has_dedicated_wh_and_preposition_lessons():
    roadmap = client.get("/api/v1/grammar/roadmap/A1").json()
    topic_ids = {
        topic["id"]
        for category in roadmap["categories"]
        for topic in category["topics"]
    }
    assert {
        "a1-wh-who",
        "a1-wh-whom",
        "a1-wh-whose",
        "a1-wh-what",
        "a1-wh-which",
        "a1-wh-where",
        "a1-wh-when",
        "a1-wh-why",
        "a1-wh-how",
        "a1-wh-how-much",
        "a1-wh-how-many",
        "a1-wh-how-long",
        "a1-wh-how-often",
        "a1-wh-how-far",
    } <= topic_ids
    assert {
        "a1-prep-in-on-at-place",
        "a1-prep-under-below",
        "a1-prep-over-above",
        "a1-prep-between-among",
        "a1-prep-near-beside-by",
        "a1-prep-front-behind-opposite",
        "a1-prep-inside-outside",
        "a1-prep-in-on-at-time",
        "a1-prep-since-for-during",
        "a1-prep-by-until",
        "a1-prep-to-into-onto",
        "a1-prep-out-of-off-from",
        "a1-prep-through-across",
        "a1-prep-along-past-towards",
        "a1-prep-by",
        "a1-prep-for",
        "a1-prep-with",
    } <= topic_ids


def test_grammar_exercises_are_checked_by_the_backend():
    answers = {
        "a1-be-choice": "i am a student",
        "a1-be-fill-blank": "TEACHER",
        "a1-be-rephrase": "they aren't at home",
    }
    for exercise_id, answer in answers.items():
        correct = client.post(
            f"/api/v1/grammar/topics/a1-be/exercises/{exercise_id}/check",
            json={"answer": answer},
        )
        assert correct.status_code == 200
        assert correct.json()["correct"] is True
        assert correct.json()["answer"]
        assert correct.json()["explanation"]

    incorrect = client.post(
        "/api/v1/grammar/topics/a1-be/exercises/a1-be-choice/check",
        json={"answer": "She are a student."},
    )
    assert incorrect.status_code == 200
    assert incorrect.json()["correct"] is False


def test_grammar_enrichment_is_optional_without_groq(monkeypatch):
    from app.api import grammar

    monkeypatch.setattr(grammar.settings, "groq_api_key", "")
    response = client.post("/api/v1/grammar/topics/a1-be/enrich", json={"focus": "questions"})
    assert response.status_code == 503


def test_grammar_checker_returns_validated_ai_feedback(monkeypatch):
    from uuid import uuid4

    from app.api import learning
    from app.api.dependencies import get_user_id

    monkeypatch.setitem(app.dependency_overrides, get_user_id, lambda: uuid4())
    monkeypatch.setattr(learning.settings, "groq_api_key", "test-key")

    analysis = {
        "mistakes": [
            {
                "original_text": "She go",
                "corrected_text": "She goes",
                "explanation": "À la troisième personne du singulier, le verbe prend -s.",
                "category": "grammar",
            },
            {
                "original_text": "not present",
                "corrected_text": "untrusted",
                "explanation": "This span is not in the source.",
                "category": "syntax",
            },
        ],
        "category_scores": {
            "spelling": 100,
            "grammar": 70,
            "punctuation": 100,
            "word_choice": 90,
            "syntax": 100,
        },
        "improved_version": "She goes to school.",
        "explanation": "Concentrez-vous sur l'accord à la troisième personne.",
    }

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            import json

            return {"choices": [{"message": {"content": json.dumps(analysis)}}]}

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(learning.httpx, "AsyncClient", lambda **_kwargs: FakeAsyncClient())
    response = client.post(
        "/api/v1/learning/grammar",
        json={"text": "She go to school.", "level": "A1"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["overall_score"] == 92
    assert result["improved_version"] == "She goes to school."
    assert len(result["mistakes"]) == 1
    assert result["mistakes"][0]["start_index"] == 0
    assert result["mistakes"][0]["end_index"] == 6


def test_reading_routes_are_removed():
    paths = app.openapi()["paths"]
    assert not any(path.startswith("/api/v1/reading") for path in paths)
    assert "/api/v1/learning/reading" not in paths
    assert "/api/v1/learning/reading/progress" not in paths


def test_authentication_requires_supabase_configuration():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "camille@example.com", "password": "testpass"},
    )
    # Accepte 503 (non configuré) ou 401 (configuré mais identifiants de test invalides)
    assert response.status_code in (503, 401)


def test_missing_or_invalid_tokens_are_rejected():
    response = client.get("/api/v1/profile/me")
    assert response.status_code == 401

    response = client.get(
        "/api/v1/profile/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_authenticated_routes_require_real_user_context():
    endpoints = [
        "/api/v1/learning/modules",
        "/api/v1/vocabulary/items",
        "/api/v1/progress/overview",
    ]
    for path in endpoints:
        response = client.get(path)
        assert response.status_code == 401
        assert response.json()["detail"] == "Missing bearer access token"


def test_conversation_and_speech_contracts_protect_user_context():
    response = client.post(
        "/api/v1/conversation/sessions",
        json={},
    )
    assert response.status_code == 401

    response = client.post(
        "/api/v1/speech/transcribe",
        json={"transcript": "Bonjour", "duration": 1, "pronunciation_score": 90},
    )
    assert response.status_code == 401
