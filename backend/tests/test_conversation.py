import asyncio
import json
from uuid import uuid4

import httpx

from app.api import conversation
from app.models.schemas import ConversationMessageRequest, ConversationSessionCreate, UserContext


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
            messages=[
                {"role": "assistant", "content": "What do you enjoy doing while traveling?"},
                {"role": "user", "content": "I enjoy visiting museums."},
                {"role": "assistant", "content": "Which museum did you enjoy most?"},
            ],
            user_message="I visited the British Museum last year.",
        )
    )

    assert reply == "Je recommande de commencer par une formule simple."
    assert captured_request["model"] == "llama-3.3-70b-versatile"
    messages = captured_request["messages"]
    assert "Tu es iTalk, un tuteur de langues bienveillant et expert en anglais." in messages[0]["content"]
    assert "conversation naturelle et stimulante" in messages[0]["content"]
    assert messages[1:4] == [
        {"role": "assistant", "content": "What do you enjoy doing while traveling?"},
        {"role": "user", "content": "I enjoy visiting museums."},
        {"role": "assistant", "content": "Which museum did you enjoy most?"},
    ]
    assert messages[-1] == {"role": "user", "content": "I visited the British Museum last year."}


def test_send_message_uses_and_persists_session_history(monkeypatch):
    session_id = uuid4()
    user = UserContext(user_id=uuid4(), access_token="user-token", email="learner@example.com")
    stored_messages = [
        {"id": str(uuid4()), "sender_role": "assistant", "content": "Welcome!", "translation": None, "timestamp": "2026-10-10T10:00:00Z"},
        {"id": str(uuid4()), "sender_role": "user", "content": "I like traveling.", "translation": None, "timestamp": "2026-10-10T10:01:00Z"},
        {"id": str(uuid4()), "sender_role": "assistant", "content": "Where did you go?", "translation": None, "timestamp": "2026-10-10T10:02:00Z"},
    ]
    captured = {}

    class Response:
        error = None
        count = None

        def __init__(self, data):
            self.data = data

    class Query:
        def __init__(self, table):
            self.table = table
            self.operation = "select"
            self.payload = None

        def select(self, *_args, **_kwargs):
            return self

        def insert(self, payload):
            self.operation = "insert"
            self.payload = payload
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def execute(self):
            if self.table == "learning_sessions":
                return Response([{"id": str(session_id), "scenario": "travel", "title": "Travel", "level": "B1"}])
            if self.operation == "insert":
                stored_messages.append({**self.payload, "timestamp": "2026-10-10T10:03:00Z", "translation": None})
                return Response([self.payload])
            return Response(stored_messages)

    class Postgrest:
        def from_(self, table):
            return Query(table)

    class Client:
        postgrest = Postgrest()

    monkeypatch.setattr(conversation, "_create_supabase_client", lambda _token: Client())

    async def fake_reply(messages, user_message):
        captured["messages"] = messages
        captured["user_message"] = user_message
        return "That sounds fascinating. Which exhibit did you see?"

    monkeypatch.setattr(conversation, "generate_tutor_reply", fake_reply)
    reply = asyncio.run(
        conversation.send_message(
            session_id,
            ConversationMessageRequest(content="I visited the British Museum."),
            user,
        )
    )

    assert reply.content == "That sounds fascinating. Which exhibit did you see?"
    assert captured["messages"][1:] == [
        {"role": "assistant", "content": "Welcome!"},
        {"role": "user", "content": "I like traveling."},
        {"role": "assistant", "content": "Where did you go?"},
    ]
    assert captured["user_message"] == "I visited the British Museum."
    assert stored_messages[-1]["sender_role"] == "assistant"
    assert stored_messages[-1]["content"] == reply.content


def test_start_session_persists_conversation_type_and_selected_scenario(monkeypatch):
    user = UserContext(user_id=uuid4(), access_token="user-token", email="learner@example.com")
    inserts = []

    class Response:
        error = None
        data = []

    class Query:
        def __init__(self, table):
            self.table = table
            self.payload = None

        def insert(self, payload):
            self.payload = payload
            return self

        def execute(self):
            inserts.append((self.table, self.payload))
            return Response()

    class Postgrest:
        def from_(self, table):
            return Query(table)

    class Client:
        postgrest = Postgrest()

    monkeypatch.setattr(conversation, "_create_supabase_client", lambda _token: Client())
    session = asyncio.run(
        conversation.start_session(ConversationSessionCreate(scenario="free_talk"), user)
    )

    session_insert = inserts[0][1]
    assert inserts[0][0] == "learning_sessions"
    assert session_insert["user_id"] == str(user.user_id)
    assert session_insert["module_type"] == "conversation"
    assert session_insert["scenario"] == "free_talk"
    assert str(session.id) == session_insert["id"]
    assert inserts[1][0] == "conversation_messages"
