import asyncio
import json

import httpx

from app.api import conversation


def test_generate_tutor_reply_uses_groq_model(monkeypatch):
    captured_request = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured_request.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "Je recommande de commencer par une formule simple."
                        }
                    }
                ]
            },
        )

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            self._client = httpx.Client(transport=httpx.MockTransport(handler))

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            self._client.close()

        async def post(self, *args, **kwargs):
            return await asyncio.to_thread(self._client.post, *args, **kwargs)

    monkeypatch.setattr(conversation.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(conversation.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(conversation.settings, "groq_model", "llama-3.3-70b-versatile")

    reply = asyncio.run(
        conversation.generate_tutor_reply(
            messages=[{"role": "user", "content": "Je veux commander un repas."}],
            user_message="Je veux commander un repas.",
        )
    )

    assert reply == "Je recommande de commencer par une formule simple."
    assert captured_request["model"] == "llama-3.3-70b-versatile"
    assert captured_request["messages"][-1]["role"] == "user"
