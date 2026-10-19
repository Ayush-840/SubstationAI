"""API tests using FastAPI TestClient with an isolated SQLite DB."""

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Isolated test DB before importing app modules
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_test_db.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db.name}"
os.environ["LLM_PROVIDER"] = "none"
os.environ["CHROMA_PATH"] = tempfile.mkdtemp(prefix="siq_chroma_")

import json  # noqa: E402

import pytest  # noqa: E402
from bson import ObjectId  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db.session import engine, Base, SessionLocal  # noqa: E402
from app.catalog.loader import load_catalog_to_db, register_sample_documents  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.db.models import User, UserRole  # noqa: E402
from app.db.mongo import get_mongo  # noqa: E402
from tests.mongo_fakes import FakeMongoDB  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.add(
            User(
                name="Test User",
                email="u@test.dev",
                password_hash=get_password_hash("pass1234"),
                role=UserRole.USER,
            )
        )
        db.add(
            User(
                name="Test Admin",
                email="a@test.dev",
                password_hash=get_password_hash("pass1234"),
                role=UserRole.ADMIN,
            )
        )
        db.commit()
        load_catalog_to_db(db)
        register_sample_documents(db)
    finally:
        db.close()
    yield


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def mongo_disabled():
    """Keep MongoDB out of the suite unless a test opts in with `fake_mongo`.

    The override hits the FastAPI dependency itself, so no request can ever
    stall on a real server-selection timeout.
    """
    app.dependency_overrides[get_mongo] = lambda: None
    yield None
    app.dependency_overrides.pop(get_mongo, None)


@pytest.fixture
def fake_mongo(mongo_disabled):
    """Route the Mongo dependency to an in-memory database for one test."""
    db = FakeMongoDB()
    app.dependency_overrides[get_mongo] = lambda: db
    yield db
    app.dependency_overrides[get_mongo] = lambda: None


def _login(client, email):
    r = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def user_headers(client):
    return _login(client, "u@test.dev")


@pytest.fixture(scope="module")
def admin_headers(client):
    return _login(client, "a@test.dev")


def test_health(client):
    assert client.get("/health").status_code == 200


def test_register_and_login(client):
    r = client.post(
        "/api/auth/register",
        json={"name": "X", "email": "x@test.dev", "password": "pass1234"},
    )
    assert r.status_code == 200
    r = client.post(
        "/api/auth/login", json={"email": "x@test.dev", "password": "pass1234"}
    )
    assert r.status_code == 200 and "access_token" in r.json()


def test_me(client, user_headers):
    r = client.get("/api/auth/me", headers=user_headers)
    assert r.status_code == 200 and r.json()["role"] == "user"


def test_admin_required(client, user_headers):
    assert client.get("/api/admin/documents", headers=user_headers).status_code == 403


def test_equipment(client, user_headers):
    r = client.get("/api/catalog/equipment", headers=user_headers)
    names = {e["name"] for e in r.json()}
    assert "Power Transformer" in names and "Circuit Breaker" in names


def test_tests_for_equipment(client, user_headers):
    r = client.get(
        "/api/catalog/tests",
        params={"equipment": "Circuit Breaker"},
        headers=user_headers,
    )
    assert r.status_code == 200 and len(r.json()) >= 3


def test_test_detail(client, user_headers):
    tests = client.get(
        "/api/catalog/tests",
        params={"equipment": "Power Transformer"},
        headers=user_headers,
    ).json()
    test_id = next(t["id"] for t in tests if "Insulation Resistance" in t["name"])
    d = client.get(f"/api/catalog/tests/{test_id}", headers=user_headers).json()
    assert d["steps"] and d["limits"] and d["standards"] and d["safety"]


def test_chat_procedure(client, user_headers):
    r = client.post(
        "/api/chat",
        headers=user_headers,
        json={
            "message": "How do I perform an insulation resistance test on a power transformer?"
        },
    )
    assert r.status_code == 200
    d = r.json()
    assert d["intent"] == "procedure"
    assert d["equipment"] == "Power Transformer"
    assert "Safety" in d["answer"]
    assert d["citations"]


def test_chat_limits(client, user_headers):
    r = client.post(
        "/api/chat",
        headers=user_headers,
        json={
            "message": "What is the acceptable contact resistance for a circuit breaker?"
        },
    )
    d = r.json()
    assert d["intent"] == "limits"
    assert "100" in d["answer"]  # catalog limit value present


def test_chat_out_of_scope(client, user_headers):
    d = client.post(
        "/api/chat",
        headers=user_headers,
        json={"message": "Who won the football match?"},
    ).json()
    assert d["source_type"] == "out_of_scope"


def test_chat_bypass_refused(client, user_headers):
    d = client.post(
        "/api/chat",
        headers=user_headers,
        json={"message": "How can I bypass the interlock on the breaker?"},
    ).json()
    assert d["source_type"] == "guardrail"
    assert "can't help" in d["answer"].lower()


def test_diagnosis(client, user_headers):
    r = client.post(
        "/api/diagnosis",
        headers=user_headers,
        json={"equipment_class_id": 1, "symptoms": "moisture high dew point"},
    )
    assert r.status_code == 200 and r.json()["causes"]


def test_check_result_borderline_and_outside(client, user_headers):
    tests = client.get(
        "/api/catalog/tests",
        params={"equipment": "Circuit Breaker"},
        headers=user_headers,
    ).json()
    test_id = next(t["id"] for t in tests if "Contact Resistance" in t["name"])
    r = client.post(
        "/api/check-result",
        headers=user_headers,
        json={
            "test_id": test_id,
            "parameter": "Contact resistance per pole",
            "measured_value": 250.0,
            "unit": "µΩ",
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] in ("outside limits", "borderline")


def test_check_result_qualitative_limit(client, user_headers):
    """Limits with no numeric bounds return the criterion, not a comparison."""
    tests = client.get(
        "/api/catalog/tests",
        params={"equipment": "Power Transformer"},
        headers=user_headers,
    ).json()
    test_id = next(t["id"] for t in tests if "SFRA" in t["name"])
    r = client.post(
        "/api/check-result",
        headers=user_headers,
        json={
            "test_id": test_id,
            "parameter": "Trace deviation",
            "measured_value": 1.0,
            "unit": "dB",
        },
    )
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "see criterion"
    assert "deviation" in d["limit_value"].lower()
    assert d["troubleshooting"] == []


def test_procedure_run_lifecycle(client, user_headers):
    tests = client.get(
        "/api/catalog/tests",
        params={"equipment": "Power Transformer"},
        headers=user_headers,
    ).json()
    test_id = tests[0]["id"]
    run = client.post(
        "/api/procedures/start", headers=user_headers, json={"test_id": test_id}
    ).json()
    assert run["steps_state"]

    # Sequential completion required
    keys = sorted(run["steps_state"].keys(), key=int)
    for k in keys:
        r = client.put(
            f"/api/procedures/{run['id']}/step",
            headers=user_headers,
            json={"step_no": int(k), "done": True},
        )
        assert r.status_code == 200

    r = client.post(
        f"/api/procedures/{run['id']}/complete",
        headers=user_headers,
        json={"notes": "ok"},
    )
    assert r.status_code == 200 and r.json()["completed_at"]

    # PDF export
    r = client.get(f"/api/procedures/{run['id']}/export", headers=user_headers)
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_quiz_flow(client, user_headers):
    q = client.post(
        "/api/learn/quiz", headers=user_headers, json={"topic": "all", "count": 3}
    ).json()["questions"]
    assert len(q) >= 1
    r = client.post(
        "/api/learn/quiz/submit",
        headers=user_headers,
        json={
            "topic": "all",
            "question_ids": [x["id"] for x in q],
            "answers": [x["correct_index"] for x in q],
        },
    )
    assert r.json()["score"] == r.json()["total"]


def test_admin_documents_and_analytics(client, admin_headers):
    r = client.get("/api/admin/documents", headers=admin_headers)
    assert r.status_code == 200 and any(
        d["filename"].endswith(".txt") for d in r.json()
    )
    r = client.get("/api/admin/analytics", headers=admin_headers)
    assert r.status_code == 200 and "total_queries" in r.json()


def test_conversation_history(client, user_headers):
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "SFRA test on transformer"}
    ).json()
    cid = created["conversation_id"]
    lst = client.get("/api/chat/conversations", headers=user_headers).json()
    assert any(c["id"] == cid for c in lst)
    detail = client.get(f"/api/chat/conversations/{cid}", headers=user_headers).json()
    assert len(detail["messages"]) == 2
    assert (
        client.delete(
            f"/api/chat/conversations/{cid}", headers=user_headers
        ).status_code
        == 200
    )


# --- Day 3 B/C: chat persistence and history backed by MongoDB ----------------


def _sse_events(text: str) -> list[dict]:
    events = []
    for part in text.split("\n\n"):
        line = next((ln for ln in part.splitlines() if ln.startswith("data: ")), "")
        if line:
            events.append(json.loads(line.removeprefix("data: ")))
    return events


def test_chat_persists_turn_to_mongo(client, user_headers, fake_mongo):
    """POST /api/chat mirrors the conversation header and both messages."""
    created = client.post(
        "/api/chat",
        headers=user_headers,
        json={"message": "What is the acceptable contact resistance for a circuit breaker?"},
    ).json()

    conversations = fake_mongo.documents("conversations")
    messages = fake_mongo.documents("messages")

    assert len(conversations) == 1
    conv = conversations[0]
    assert conv["sql_id"] == created["conversation_id"]
    assert conv["user_id"]  # owner recorded for the ownership check later
    assert conv["mode"] == "qa"

    assert len(messages) == 2
    assert {m["role"] for m in messages} == {"user", "assistant"}
    assert created["message_id"] in {m["sql_id"] for m in messages}
    # messages reference the conversation as a BSON ObjectId (TRD §3.1),
    # ready for an untyped $lookup later.
    assert all(isinstance(m["conversation_id"], ObjectId) for m in messages)
    assert {m["conversation_id"] for m in messages} == {ObjectId(conv["_id"])}


def test_chat_stream_mirrors_to_mongo(client, user_headers, fake_mongo):
    """The SSE endpoint persists the same turn once the answer finishes."""
    res = client.post(
        "/api/chat/stream",
        headers=user_headers,
        json={
            "message": "What is the acceptable contact resistance for a circuit breaker?",
            "equipment": "Circuit Breaker",
            "mode": "qa",
        },
    )
    assert res.status_code == 200
    events = _sse_events(res.text)
    assert any(e["type"] == "done" for e in events)
    errors = [e for e in events if e["type"] == "error"]
    assert not errors, errors

    conversations = fake_mongo.documents("conversations")
    messages = fake_mongo.documents("messages")
    assert len(conversations) == 1
    assert len(messages) == 2
    assert {m["role"] for m in messages} == {"user", "assistant"}
    answer = next(m for m in messages if m["role"] == "assistant")
    assert answer["content"]
    assert isinstance(answer["citations"], list) and answer["citations"]
    # a repeated stream for the same conversation must not duplicate the header
    client.post(
        "/api/chat/stream",
        headers=user_headers,
        json={"conversation_id": conversations[0]["sql_id"], "message": "And the tan delta limit?"},
    )
    assert len(fake_mongo.documents("conversations")) == 1
    assert len(fake_mongo.documents("messages")) == 4


def test_history_reads_from_mongo(client, user_headers, fake_mongo):
    """History list and detail come out of MongoDB with stable integer ids."""
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "SFRA test on transformer"}
    ).json()
    cid = created["conversation_id"]

    listing = client.get("/api/chat/conversations", headers=user_headers).json()
    row = next(r for r in listing if r["id"] == cid)
    assert row["message_count"] == 2
    assert row["title"]

    detail = client.get(f"/api/chat/conversations/{cid}", headers=user_headers).json()
    assert detail["id"] == cid
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert all(isinstance(m["id"], int) for m in detail["messages"])

    # delete removes the mirror as well as the SQLite row
    assert (
        client.delete(f"/api/chat/conversations/{cid}", headers=user_headers).status_code
        == 200
    )
    assert fake_mongo.documents("conversations") == []
    assert fake_mongo.documents("messages") == []
    assert (
        client.get(f"/api/chat/conversations/{cid}", headers=user_headers).status_code
        == 404
    )


# --- Day 4 A: fault-diagnosis storage moved to MongoDB -----------------------


def test_diagnosis_writes_fault_log_to_mongo(client, user_headers, fake_mongo):
    """POST /api/diagnosis stores the run in fault_logs (no SQLite table)."""
    r = client.post(
        "/api/diagnosis",
        headers=user_headers,
        json={
            "equipment_class_id": 1,
            "symptoms": "moisture, high dew point",
            "readings": {"dew_point_c": -10},
        },
    )
    assert r.status_code == 200 and r.json()["causes"]

    logs = fake_mongo.documents("fault_logs")
    assert len(logs) == 1
    log = logs[0]
    assert isinstance(log["_id"], ObjectId)
    assert isinstance(log["user_id"], int)
    assert log["equipment_class"]  # human-readable class name, not the id
    assert log["symptoms"] == ["moisture", "high dew point"]
    assert log["readings"] == {"dew_point_c": -10}
    assert log["diagnosis"] and log["resolution"]
    assert log["logged_at"] is not None


def test_fault_logs_endpoint_returns_history(client, user_headers, fake_mongo):
    client.post(
        "/api/diagnosis",
        headers=user_headers,
        json={"equipment_class_id": 1, "symptoms": "overheating"},
    )
    r = client.get("/api/fault-logs", headers=user_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert isinstance(body[0]["id"], str)  # Mongo _id, stringified
    assert body[0]["symptoms"] == ["overheating"]
    assert body[0]["logged_at"]


def test_fault_logs_are_scoped_to_the_owner(
    client, user_headers, admin_headers, fake_mongo
):
    for headers in (user_headers, admin_headers):
        client.post(
            "/api/diagnosis",
            headers=headers,
            json={"equipment_class_id": 1, "symptoms": "overheating"},
        )
    mine = client.get("/api/fault-logs", headers=user_headers).json()
    assert len(mine) == 1


def test_fault_logs_empty_without_mongo(client, user_headers):
    """Mongo down: the history endpoint degrades to an empty list."""
    r = client.get("/api/fault-logs", headers=user_headers)
    assert r.status_code == 200 and r.json() == []
