from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_authentication_requires_supabase_configuration():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "camille@example.com", "password": "testpass"},
    )
    assert response.status_code == 503
    assert "Supabase authentication is not configured" in response.json()["detail"]


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
        "/api/v1/reading/contents",
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
        json={"scenario": "restaurant"},
    )
    assert response.status_code == 401

    response = client.post(
        "/api/v1/speech/transcribe",
        json={"transcript": "Bonjour", "duration": 1, "pronunciation_score": 90},
    )
    assert response.status_code == 401
