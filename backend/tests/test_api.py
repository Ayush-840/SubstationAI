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
os.environ["TESTING"] = "1"

import json  # noqa: E402
from datetime import datetime, timedelta  # noqa: E402

import pytest  # noqa: E402
from bson import ObjectId  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db.session import engine, Base, SessionLocal  # noqa: E402
from app.catalog.loader import load_catalog_to_db, register_sample_documents  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.db.models import User, UserRole, Feedback, RefreshToken  # noqa: E402
from app.core.refresh import hash_token  # noqa: E402
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
                role=UserRole.TRAINEE,
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
        db.add(
            User(
                name="Test Engineer",
                email="e@test.dev",
                password_hash=get_password_hash("pass1234"),
                role=UserRole.ENGINEER,
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


@pytest.fixture(scope="module")
def engineer_headers(client):
    return _login(client, "e@test.dev")


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
    assert r.status_code == 200 and r.json()["role"] == "trainee"


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


def test_diagnosis(client, engineer_headers):
    r = client.post(
        "/api/diagnosis",
        headers=engineer_headers,
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


def test_diagnosis_writes_fault_log_to_mongo(client, engineer_headers, fake_mongo):
    """POST /api/diagnosis stores the run in fault_logs (no SQLite table)."""
    r = client.post(
        "/api/diagnosis",
        headers=engineer_headers,
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


def test_fault_logs_endpoint_returns_history(client, engineer_headers, fake_mongo):
    client.post(
        "/api/diagnosis",
        headers=engineer_headers,
        json={"equipment_class_id": 1, "symptoms": "overheating"},
    )
    r = client.get("/api/fault-logs", headers=engineer_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert isinstance(body[0]["id"], str)  # Mongo _id, stringified
    assert body[0]["symptoms"] == ["overheating"]
    assert body[0]["logged_at"]


def test_fault_logs_are_scoped_to_the_owner(
    client, engineer_headers, admin_headers, fake_mongo
):
    for headers in (engineer_headers, admin_headers):
        client.post(
            "/api/diagnosis",
            headers=headers,
            json={"equipment_class_id": 1, "symptoms": "overheating"},
        )
    mine = client.get("/api/fault-logs", headers=engineer_headers).json()
    assert len(mine) == 1


def test_fault_logs_empty_without_mongo(client, user_headers):
    """Mongo down: the history endpoint degrades to an empty list."""
    r = client.get("/api/fault-logs", headers=user_headers)
    assert r.status_code == 200 and r.json() == []


# --- Day 4 B: POST /messages/{id}/feedback backed by MongoDB -----------------


def _feedback_row(message_id: int, user_id: int):
    """(rating, comment) of one vote in the SQLite mirror, or None."""
    db = SessionLocal()
    try:
        row = (
            db.query(Feedback)
            .filter(
                Feedback.message_id == message_id,
                Feedback.user_id == user_id,
            )
            .first()
        )
        return None if row is None else (row.rating, row.comment)
    finally:
        db.close()


def test_feedback_upserts_to_mongo_and_mirrors_sql(
    client, user_headers, fake_mongo
):
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "Contact resistance limits?"}
    ).json()
    mid = created["message_id"]
    message_oid = next(
        m["_id"] for m in fake_mongo.documents("messages") if m["sql_id"] == mid
    )

    r = client.post(
        f"/api/messages/{mid}/feedback",
        headers=user_headers,
        json={"rating": 1, "comment": "clear"},
    )
    assert r.status_code == 200 and r.json()["ok"] is True

    votes = fake_mongo.documents("feedback")
    assert len(votes) == 1
    # message_id is the message's ObjectId, so a $lookup on messages._id matches
    assert votes[0]["message_id"] == message_oid
    assert votes[0]["rating"] == 1 and votes[0]["comment"] == "clear"
    uid = votes[0]["user_id"]
    assert _feedback_row(mid, uid) == (1, "clear")

    # a second vote replaces the first in both stores
    r = client.post(
        f"/api/messages/{mid}/feedback",
        headers=user_headers,
        json={"rating": -1, "comment": "wrong"},
    )
    assert r.status_code == 200
    votes = fake_mongo.documents("feedback")
    assert len(votes) == 1 and votes[0]["rating"] == -1
    assert _feedback_row(mid, uid) == (-1, "wrong")


def test_feedback_without_mongo_falls_back_to_sql(client, user_headers):
    """Mongo down: the vote still lands in SQLite and stays idempotent."""
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "SFRA limits"}
    ).json()
    mid = created["message_id"]
    uid = client.get("/api/auth/me", headers=user_headers).json()["id"]

    r = client.post(
        f"/api/messages/{mid}/feedback", headers=user_headers, json={"rating": -1}
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True, "message_id": mid}
    assert _feedback_row(mid, uid) == (-1, None)

    client.post(
        f"/api/messages/{mid}/feedback",
        headers=user_headers,
        json={"rating": 1, "comment": "ok"},
    )
    assert _feedback_row(mid, uid) == (1, "ok")


def test_feedback_legacy_body_shape(client, user_headers, fake_mongo):
    """POST /api/feedback keeps its body-in-message_id contract."""
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "Buchholz relay"}
    ).json()
    r = client.post(
        "/api/feedback",
        headers=user_headers,
        json={"message_id": created["message_id"], "rating": 1, "comment": "nice"},
    )
    assert r.status_code == 200 and r.json()["ok"] is True
    assert len(fake_mongo.documents("feedback")) == 1


def test_feedback_rejects_unknown_and_invalid_message_ids(
    client, user_headers, fake_mongo
):
    # a well-formed ObjectId with no mirrored message is a 404, never a
    # dangling vote document
    r = client.post(
        f"/api/messages/{ObjectId()}/feedback",
        headers=user_headers,
        json={"rating": 1},
    )
    assert r.status_code == 404
    # garbage ids are rejected instead of being stored as plain strings
    r = client.post(
        "/api/messages/not-an-id/feedback",
        headers=user_headers,
        json={"rating": 1},
    )
    assert r.status_code == 400
    assert fake_mongo.documents("feedback") == []


# --- Day 6 A: refresh-token rotation -----------------------------------------


def _login_refresh(client, email="u@test.dev") -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert r.status_code == 200
    return r.json()["refresh_token"]


def test_login_returns_refresh_token_and_stores_hash_only(client):
    r = client.post(
        "/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"}
    )
    d = r.json()
    assert d["access_token"] and d["refresh_token"]
    # browser flow rides along as cookies
    cookies = r.headers.get_list("set-cookie")
    assert any(c.startswith("refresh_token=") for c in cookies)
    assert any(c.startswith("csrf_token=") for c in cookies)

    db = SessionLocal()
    try:
        by_hash = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_token(d["refresh_token"]))
            .all()
        )
        assert len(by_hash) == 1
        row = by_hash[0]
        assert row.used_at is None and row.revoked_at is None
        assert row.expires_at > datetime.utcnow()
        # the raw token is never what gets persisted
        assert db.query(RefreshToken).filter(
            RefreshToken.token_hash == d["refresh_token"]
        ).all() == []
    finally:
        db.close()


def test_refresh_rotates_pair_and_rejects_replay(client):
    old_refresh = _login_refresh(client)

    r = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 200
    d = r.json()
    assert d["refresh_token"] and d["refresh_token"] != old_refresh
    assert d["access_token"]

    # rotation: the presented token is consumed...
    replay = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert replay.status_code == 401
    assert "used" in replay.json()["detail"].lower()

    # ...and the successor works, exactly once
    assert (
        client.post(
            "/api/auth/refresh", json={"refresh_token": d["refresh_token"]}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/auth/refresh", json={"refresh_token": d["refresh_token"]}
        ).status_code
        == 401
    )

    # unknown/garbage tokens are 401, never a crash
    assert (
        client.post("/api/auth/refresh", json={"refresh_token": "not-a-token"}).status_code
        == 401
    )


def test_refresh_rejects_expired_token(client):
    raw = _login_refresh(client)
    db = SessionLocal()
    try:
        row = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_token(raw))
            .first()
        )
        assert row is not None
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()

    r = client.post("/api/auth/refresh", json={"refresh_token": raw})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_cookie_refresh_flow_requires_csrf(client):
    """Cookie presented → double-submit header mandatory; body flow exempt."""
    raw = _login_refresh(client)
    try:
        # seed the jar the way a browser would have stored it (the test
        # transport does not replay Secure cookies over http://testserver)
        client.cookies.delete("refresh_token")
        client.cookies.delete("csrf_token")
        client.cookies.set("refresh_token", raw)
        client.cookies.set("csrf_token", "double-submit-value")

        denied = client.post("/api/auth/refresh")
        assert denied.status_code == 403
        assert "CSRF" in denied.json()["detail"]

        ok = client.post(
            "/api/auth/refresh", headers={"X-CSRF-Token": "double-submit-value"}
        )
        assert ok.status_code == 200
        assert ok.json()["refresh_token"] != raw  # still rotates
    finally:
        client.cookies.delete("refresh_token")
        client.cookies.delete("csrf_token")


# --- Day 6 B: logout revocation ------------------------------------------------


def _login_pair(client) -> tuple[str, str]:
    r = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"})
    assert r.status_code == 200
    d = r.json()
    return d["access_token"], d["refresh_token"]


def test_logout_revokes_refresh_and_denylists_access_jti(client):
    access, refresh_tok = _login_pair(client)
    auth = {"Authorization": f"Bearer {access}"}

    # the access token is live before logout
    assert client.get("/api/auth/me", headers=auth).status_code == 200

    r = client.post(
        "/api/auth/logout", headers=auth, json={"refresh_token": refresh_tok}
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True and r.json()["revoked_refresh_tokens"] == 1

    # the access token dies at once: signature and expiry are fine, the jti
    # is deny-listed
    me = client.get("/api/auth/me", headers=auth)
    assert me.status_code == 401
    assert "revoked" in me.json()["detail"].lower()

    # the refresh token is revoked in SQLite
    ref = client.post("/api/auth/refresh", json={"refresh_token": refresh_tok})
    assert ref.status_code == 401
    assert "revoked" in ref.json()["detail"].lower()

    # idempotent: a second logout with the already-denied token still succeeds
    again = client.post(
        "/api/auth/logout", headers=auth, json={"refresh_token": refresh_tok}
    )
    assert again.status_code == 200
    assert again.json()["revoked_refresh_tokens"] == 0


def test_logout_without_token_revokes_every_session(client):
    access1, refresh1 = _login_pair(client)
    _, refresh2 = _login_pair(client)  # second device/session, same user

    r = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access1}"},
        json={},
    )
    assert r.status_code == 200
    assert r.json()["revoked_refresh_tokens"] >= 2

    for raw in (refresh1, refresh2):
        ref = client.post("/api/auth/refresh", json={"refresh_token": raw})
        assert ref.status_code == 401
        assert "revoked" in ref.json()["detail"].lower()


def test_logout_cookie_flow_requires_csrf(client):
    access, refresh_tok = _login_pair(client)
    auth = {"Authorization": f"Bearer {access}"}
    try:
        client.cookies.delete("refresh_token")
        client.cookies.delete("csrf_token")
        client.cookies.set("refresh_token", refresh_tok)
        client.cookies.set("csrf_token", "logout-csrf")

        # cookie without the double-submit header is rejected...
        denied = client.post("/api/auth/logout", headers=auth)
        assert denied.status_code == 403

        # ...with the header the session is killed
        ok = client.post("/api/auth/logout", headers={**auth, "X-CSRF-Token": "logout-csrf"})
        assert ok.status_code == 200
        assert ok.json()["revoked_refresh_tokens"] == 1
        assert client.get("/api/auth/me", headers=auth).status_code == 401
    finally:
        client.cookies.delete("refresh_token")
        client.cookies.delete("csrf_token")


# --- Day 7 A: three-role model ------------------------------------------------


def test_register_defaults_to_trainee_role(client):
    r = client.post(
        "/api/auth/register",
        json={"name": "New Trainee", "email": "t7@test.dev", "password": "pass1234"},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "trainee"


def test_engineer_demo_user_created_by_seed_and_idempotent(client):
    from app.scripts.seed import ensure_demo_users

    db = SessionLocal()
    try:
        ensure_demo_users(db)
        ensure_demo_users(db)  # re-running must not duplicate or fail
        eng = (
            db.query(User)
            .filter(User.email == "engineer@substationiq.dev")
            .first()
        )
        assert eng is not None
        assert eng.role == UserRole.ENGINEER
        # pre-existing test users are untouched by the seed helper
        assert db.query(User).filter(User.email == "u@test.dev").count() == 1
        assert db.query(User).filter(User.email == "engineer@substationiq.dev").count() == 1
    finally:
        db.close()


# --- Day 7 B: role gating + ownership checks ---------------------------------


def test_diagnosis_requires_engineer_or_admin(
    client, user_headers, engineer_headers, admin_headers
):
    payload = {"equipment_class_id": 1, "symptoms": "moisture high dew point"}

    assert (
        client.post("/api/diagnosis", headers=user_headers, json=payload).status_code
        == 403
    )
    assert (
        client.post(
            "/api/diagnosis", headers=engineer_headers, json=payload
        ).status_code
        == 200
    )
    assert (
        client.post("/api/diagnosis", headers=admin_headers, json=payload).status_code
        == 200
    )
    # the sprint's /api/v1 tree mounts the same router and is gated too
    assert (
        client.post(
            "/api/v1/api/diagnosis", headers=user_headers, json=payload
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/api/diagnosis", headers=engineer_headers, json=payload
        ).status_code
        == 200
    )


def _register_and_login(client, email: str) -> dict:
    r = client.post(
        "/api/auth/register",
        json={"name": "Intruder", "email": email, "password": "pass1234"},
    )
    assert r.status_code == 200
    return _login(client, email)


def test_conversation_ownership_blocks_other_users(client, user_headers):
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "SFRA test on transformer"}
    ).json()
    cid = created["conversation_id"]
    other = _register_and_login(client, "other7@test.dev")

    assert (
        client.get(f"/api/chat/conversations/{cid}", headers=other).status_code
        == 404
    )
    assert (
        client.delete(f"/api/chat/conversations/{cid}", headers=other).status_code
        == 404
    )
    lst = client.get("/api/chat/conversations", headers=other).json()
    assert all(c["id"] != cid for c in lst)


def test_feedback_on_foreign_message_is_404(client, user_headers):
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "Tan delta limits?"}
    ).json()
    detail = client.get(
        f"/api/chat/conversations/{created['conversation_id']}", headers=user_headers
    ).json()
    own_msg = next(m["id"] for m in detail["messages"] if m["role"] == "user")
    other = _register_and_login(client, "otherfb@test.dev")

    # SQL store: someone else's message is indistinguishable from a missing one
    r = client.post(
        f"/api/messages/{own_msg}/feedback", headers=other, json={"rating": 1}
    )
    assert r.status_code == 404
    r = client.post(
        "/api/feedback", headers=other, json={"message_id": own_msg, "rating": 1}
    )
    assert r.status_code == 404

    # the owner's vote still lands
    r = client.post(
        f"/api/messages/{own_msg}/feedback", headers=user_headers, json={"rating": 1}
    )
    assert r.status_code == 200


def test_feedback_on_foreign_message_is_404_with_mongo(
    client, user_headers, fake_mongo
):
    created = client.post(
        "/api/chat", headers=user_headers, json={"message": "DGA gas ratios?"}
    ).json()
    detail = client.get(
        f"/api/chat/conversations/{created['conversation_id']}", headers=user_headers
    ).json()
    own_msg = next(m["id"] for m in detail["messages"] if m["role"] == "user")
    other = _register_and_login(client, "otherfb2@test.dev")

    r = client.post(
        f"/api/messages/{own_msg}/feedback", headers=other, json={"rating": 1}
    )
    assert r.status_code == 404
    assert fake_mongo.documents("feedback") == []  # nothing written for the intruder

    r = client.post(
        f"/api/messages/{own_msg}/feedback", headers=user_headers, json={"rating": 1}
    )
    assert r.status_code == 200
    assert len(fake_mongo.documents("feedback")) == 1


def test_procedure_run_ownership_blocks_other_users(client, user_headers):
    tests = client.get(
        "/api/catalog/tests",
        params={"equipment": "Power Transformer"},
        headers=user_headers,
    ).json()
    run = client.post(
        "/api/procedures/start",
        headers=user_headers,
        json={"test_id": tests[0]["id"]},
    ).json()
    other = _register_and_login(client, "otherproc@test.dev")

    r = client.put(
        f"/api/procedures/{run['id']}/step",
        headers=other,
        json={"step_no": 1, "done": True},
    )
    assert r.status_code == 404
    assert (
        client.get(f"/api/procedures/{run['id']}/export", headers=other).status_code
        == 404
    )
    # the owner still controls the run
    r = client.put(
        f"/api/procedures/{run['id']}/step",
        headers=user_headers,
        json={"step_no": 1, "done": True},
    )
    assert r.status_code == 200
