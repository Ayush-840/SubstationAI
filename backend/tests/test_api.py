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
os.environ.setdefault("RATE_LIMIT_LOGIN", "100000/minute")
os.environ.setdefault("RATE_LIMIT_REGISTER", "100000/minute")
os.environ.setdefault("LOGIN_MAX_FAILURES", "1000")

import json  # noqa: E402
from datetime import datetime, timedelta  # noqa: E402

import pytest  # noqa: E402
from bson import ObjectId  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db.session import engine, Base, SessionLocal  # noqa: E402
from app.catalog.loader import load_catalog_to_db, register_sample_documents  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.db.models import User, UserRole, Feedback, RefreshToken, AuthEvent, RecoveryCode  # noqa: E402
from app.core.refresh import hash_token  # noqa: E402
from app.db.mongo import get_mongo  # noqa: E402
from tests.mongo_fakes import FakeMongoDB  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seeded accounts are pre-verified (§10: demo/dev accounts bypass
        # e-mail verification); A-02 uses a freshly registered account.
        verified = datetime.utcnow()
        db.add(
            User(
                name="Test User",
                email="u@test.dev",
                password_hash=get_password_hash("pass1234"),
                role=UserRole.TRAINEE,
                email_verified_at=verified,
            )
        )
        db.add(
            User(
                name="Test Admin",
                email="a@test.dev",
                password_hash=get_password_hash("pass1234"),
                role=UserRole.ADMIN,
                email_verified_at=verified,
            )
        )
        db.add(
            User(
                name="Test Engineer",
                email="e@test.dev",
                password_hash=get_password_hash("pass1234"),
                role=UserRole.ENGINEER,
                email_verified_at=verified,
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
    assert r.status_code == 201
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
    assert r.status_code == 201
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
    assert r.status_code == 201
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


# --- Oct-24 audit: register/login hardening ------------------------------------
# One test per defect found in the audit; each failed before its fix.

from app.core import login_throttle  # noqa: E402
from app.core.config import Settings, get_settings  # noqa: E402
from app.core.security import create_access_token, decode_token  # noqa: E402
from app.core.security_middleware import parse_cors  # noqa: E402


def _register(client, email, password="pass1234", name="Tester"):
    return client.post(
        "/api/auth/register", json={"name": name, "email": email, "password": password}
    )


@pytest.mark.parametrize(
    "password",
    ["short1", "onlyletters", "12345678", "        ", "password123", "a1" + "x" * 80],
)
def test_register_rejects_weak_passwords(client, password):
    r = _register(client, "weak@test.dev", password)
    assert r.status_code == 422, password


def test_register_rejects_blank_name_and_multibyte_overflow(client):
    assert _register(client, "n1@test.dev", name="   ").status_code == 422
    assert _register(client, "n2@test.dev", name="").status_code == 422
    # 74 bytes: short in characters, over bcrypt's 72-byte limit in bytes
    assert _register(client, "n3@test.dev", password="a1" + "\U0001F600" * 18).status_code == 422


def test_email_is_case_insensitive_everywhere(client):
    assert _register(client, "Mixed.Case@Test.dev").status_code == 201
    assert _register(client, "mixed.case@test.dev").status_code == 409
    assert _register(client, "  MIXED.CASE@TEST.DEV ").status_code == 409
    r = client.post(
        "/api/auth/login", json={"email": "MIXED.case@test.DEV", "password": "pass1234"}
    )
    assert r.status_code == 200
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}
    )
    assert me.json()["email"] == "mixed.case@test.dev"


def test_login_does_not_reveal_whether_the_email_exists(client):
    unknown = client.post("/api/auth/login", json={"email": "ghost@test.dev", "password": "x1x1x1x1"})
    wrong = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "wrong-pass1"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_failed_login_throttle_locks_only_that_ip_email_pair(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "LOGIN_MAX_FAILURES", 3)
    login_throttle.reset()
    try:
        bad = {"email": "u@test.dev", "password": "wrong-pass1"}
        assert [client.post("/api/auth/login", json=bad).status_code for _ in range(3)] == [401] * 3
        locked = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"})
        assert locked.status_code == 429  # even the right password waits out the lockout
        assert int(locked.headers["Retry-After"]) > 0
        # another account from the same IP is unaffected
        other = client.post("/api/auth/login", json={"email": "a@test.dev", "password": "pass1234"})
        assert other.status_code == 200
    finally:
        login_throttle.reset()


def test_successful_login_clears_the_failure_counter(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "LOGIN_MAX_FAILURES", 3)
    login_throttle.reset()
    try:
        bad = {"email": "u@test.dev", "password": "wrong-pass1"}
        for _ in range(2):
            client.post("/api/auth/login", json=bad)
        assert client.post(
            "/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"}
        ).status_code == 200
        for _ in range(2):  # counter restarted, so two more failures do not lock
            assert client.post("/api/auth/login", json=bad).status_code == 401
    finally:
        login_throttle.reset()


def test_access_token_is_short_lived_and_typed(client):
    r = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"})
    claims = decode_token(r.json()["access_token"])
    assert claims["typ"] == "access"
    assert claims["exp"] - claims["iat"] == get_settings().JWT_EXPIRE_MINUTES * 60
    assert get_settings().JWT_EXPIRE_MINUTES <= 30


def test_refresh_token_cannot_be_used_as_an_access_token(client):
    r = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"})
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['refresh_token']}"})
    assert resp.status_code == 401


def test_logout_works_with_an_expired_access_token(client):
    login = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"}).json()
    me_id = decode_token(login["access_token"])["sub"]
    expired = create_access_token({"sub": me_id}, expires_delta=timedelta(minutes=-5))
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    r = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {expired}"},
        json={"refresh_token": login["refresh_token"]},
    )
    assert r.status_code == 200 and r.json()["revoked_refresh_tokens"] == 1
    assert client.post("/api/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401


def test_logout_without_any_credentials_is_rejected(client):
    assert client.post("/api/auth/logout").status_code == 401


def test_replayed_refresh_token_inside_grace_window_is_just_rejected(client):
    first = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"}).json()
    second = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]}).json()
    replay = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401 and "already used" in replay.json()["detail"]
    # a two-tab race must not log the user out: the successor still works
    assert client.post("/api/auth/refresh", json={"refresh_token": second["refresh_token"]}).status_code == 200


def test_replayed_refresh_token_after_grace_window_revokes_every_session(client, monkeypatch):
    first = client.post("/api/auth/login", json={"email": "u@test.dev", "password": "pass1234"}).json()
    second = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]}).json()
    monkeypatch.setattr(get_settings(), "REFRESH_REUSE_GRACE_SECONDS", -1)
    replay = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401 and "reuse" in replay.json()["detail"].lower()
    # the thief's copy and the victim's live successor are both dead now
    dead = client.post("/api/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert dead.status_code == 401 and "revoked" in dead.json()["detail"].lower()


def test_cors_allows_configured_origin_and_blocks_others(client):
    ok = client.options(
        "/api/auth/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options(
        "/api/auth/login",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_parse_cors_wildcards_match_one_label_only():
    import re

    exact, regex = parse_cors(
        "https://app.example.com, https://*.vercel.app", "https://front.example.com", production=True
    )
    assert exact == ["https://app.example.com", "https://front.example.com"]
    assert "http://localhost:5173" not in exact  # dev origins are off in production
    assert re.match(regex, "https://substationiq-git-main.vercel.app")
    for hostile in (
        "https://evil.com",
        "https://a.vercel.app.evil.com",
        "https://evil.com/.vercel.app",
        "https://x.y.vercel.app",
        "http://x.vercel.app",
    ):
        assert not re.match(regex, hostile), hostile


def test_frontend_url_is_always_an_allowed_origin():
    exact, _ = parse_cors("", "https://substationiq.vercel.app/", production=True)
    assert exact == ["https://substationiq.vercel.app"]


def test_unknown_keys_in_env_file_do_not_crash_startup(tmp_path):
    env = tmp_path / ".env"
    env.write_text("REDIS_URL=redis://x:6379/0\nSOMETHING_NEW=1\nCORS_ALLOW_ORIGINS=https://a.app\n")

    class FromFile(Settings):
        class Config:
            env_file = str(env)
            case_sensitive = True
            extra = "ignore"

    s = FromFile()
    assert s.CORS_ALLOW_ORIGINS == "https://a.app" and s.REDIS_URL == "redis://x:6379/0"


def test_production_refuses_unsafe_configuration():
    unsafe = Settings(APP_ENV="production", JWT_SECRET="change-me", CORS_ALLOW_ORIGINS="")
    with pytest.raises(RuntimeError) as err:
        unsafe.assert_production_ready()
    assert "JWT_SECRET" in str(err.value) and "CORS_ALLOW_ORIGINS" in str(err.value)
    Settings(
        APP_ENV="production",
        JWT_SECRET="x" * 40,
        CORS_ALLOW_ORIGINS="https://a.app",
        TOTP_ENCRYPTION_KEY="ZiFfQePsI6NwHLzy15aXCdukWeXbeF-EwvRY8jufxk0=",
    ).assert_production_ready()
    Settings(APP_ENV="development").assert_production_ready()  # dev stays permissive


def test_demo_passwords_can_be_overridden(monkeypatch):
    from app.scripts.seed import ensure_demo_users
    from app.core.security import verify_password

    monkeypatch.setenv("DEMO_PASSWORD_ADMIN", "a-private-admin-pass-9")
    db = SessionLocal()
    try:
        db.query(User).filter(User.email == "admin@substationiq.dev").delete()
        db.commit()
        ensure_demo_users(db)
        admin = db.query(User).filter(User.email == "admin@substationiq.dev").one()
        assert verify_password("a-private-admin-pass-9", admin.password_hash)
        assert not verify_password("admin1234", admin.password_hash)
    finally:
        db.close()


# ── Deploy regression: the exact Render/Vercel failure (CORS env vars were ignored) ──
def test_cors_env_vars_reach_settings_and_allow_the_vercel_origin(monkeypatch):
    """Render sets CORS_ALLOW_ORIGINS / CORS_ALLOW_ORIGIN_REGEX; both must be real
    Settings fields, otherwise getattr() silently returns '' and only localhost works."""
    import re
    from app.core.security_middleware import build_cors

    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://frontend-h8ikkpyfy-ayush-840s-projects.vercel.app")
    monkeypatch.setenv("CORS_ALLOW_ORIGIN_REGEX", r"https://frontend-[a-z0-9-]+ayush-840s-projects\.vercel\.app")
    monkeypatch.setenv("APP_ENV", "production")
    s = Settings()
    assert s.CORS_ALLOW_ORIGINS and s.CORS_ALLOW_ORIGIN_REGEX
    exact, regex = build_cors(s)
    assert "https://frontend-h8ikkpyfy-ayush-840s-projects.vercel.app" in exact
    assert re.fullmatch(regex, "https://frontend-abc123-ayush-840s-projects.vercel.app")
    assert not re.fullmatch(regex, "https://evil.vercel.app")


def test_invalid_cors_regex_fails_at_startup_not_at_first_request(monkeypatch):
    import re
    from app.core.security_middleware import build_cors

    monkeypatch.setenv("CORS_ALLOW_ORIGIN_REGEX", "https://(unclosed")
    with pytest.raises(re.error):
        build_cors(Settings())


# --- AUTH_TRD Day 1: append-only audit log (A-13, existing flows) ------------


def _events(event: str, user_id: int | None = None, email: str | None = None) -> list:
    db = SessionLocal()
    try:
        q = db.query(AuthEvent).filter(AuthEvent.event == event)
        if user_id is not None:
            q = q.filter(AuthEvent.user_id == user_id)
        rows = q.all()
        if email is not None:
            rows = [r for r in rows if (r.detail or {}).get("email") == email]
        return rows
    finally:
        db.close()


def _uid(email: str) -> int:
    db = SessionLocal()
    try:
        return int(db.query(User.id).filter(User.email == email).scalar())
    finally:
        db.close()


def _login_token(client, email: str, password: str = "pass1234") -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _register_uid(client, email: str) -> int:
    r = client.post(
        "/api/auth/register",
        json={"name": "Audit Tester", "email": email, "password": "pass1234"},
    )
    assert r.status_code == 201
    return int(r.json()["id"])


def test_register_writes_exactly_one_register_event(client):
    email = "aud-register@test.dev"
    uid = _register_uid(client, email)
    rows = _events("register", email=email)
    assert len(rows) == 1
    assert rows[0].user_id == uid
    assert "password" not in (rows[0].detail or {})  # never log secrets


def test_login_writes_ok_then_fail_events_with_generic_detail(client):
    email = "aud-login@test.dev"
    uid = _register_uid(client, email)
    ok = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert ok.status_code == 200
    assert len(_events("login_ok", user_id=uid)) == 1

    fail = client.post("/api/auth/login", json={"email": email, "password": "wrong-pass1"})
    assert fail.status_code == 401
    assert fail.json()["detail"] == "Invalid email or password"
    fails = _events("login_fail", user_id=uid)
    assert len(fails) == 1
    assert "password" not in (fails[0].detail or {})


def test_lockout_threshold_writes_one_lockout_event(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "LOGIN_MAX_FAILURES", 2)
    login_throttle.reset()
    email = "aud-lockout@test.dev"
    try:
        before = len(_events("lockout", email=email))
        bad = {"email": email, "password": "wrong-pass1"}  # unknown e-mail
        assert client.post("/api/auth/login", json=bad).status_code == 401
        assert len(_events("lockout", email=email)) == before  # 1 of 2
        assert client.post("/api/auth/login", json=bad).status_code == 401
        assert len(_events("lockout", email=email)) == before + 1  # threshold hit
        assert client.post("/api/auth/login", json=bad).status_code == 429
        assert len(_events("lockout", email=email)) == before + 1  # not re-logged
    finally:
        login_throttle.reset()


def test_refresh_and_logout_write_events(client):
    email = "aud-session@test.dev"
    uid = _register_uid(client, email)
    tokens = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()

    before = len(_events("refresh", user_id=uid))
    rr = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert rr.status_code == 200
    assert len(_events("refresh", user_id=uid)) == before + 1

    lg = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {rr.json()['access_token']}"},
        json={"refresh_token": rr.json()["refresh_token"]},
    )
    assert lg.status_code == 200
    assert len(_events("logout", user_id=uid)) == 1

    # second session, revoked wholesale → logout_all
    tokens2 = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()
    lg2 = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {tokens2['access_token']}"},
    )
    assert lg2.status_code == 200
    assert len(_events("logout_all", user_id=uid)) == 1


def test_refresh_replay_after_grace_writes_refresh_replay_event(client, monkeypatch):
    email = "aud-replay@test.dev"
    uid = _register_uid(client, email)
    first = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()
    second = client.post(
        "/api/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert second.status_code == 200
    monkeypatch.setattr(get_settings(), "REFRESH_REUSE_GRACE_SECONDS", -1)
    replay = client.post(
        "/api/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert replay.status_code == 401
    assert len(_events("refresh_replay", user_id=uid)) >= 1
    # theft response also kills the victim's successor (existing behaviour)
    dead = client.post(
        "/api/auth/refresh", json={"refresh_token": second.json()["refresh_token"]}
    )
    assert dead.status_code == 401


# --- AUTH_TRD Day 2: argon2id + transparent upgrade (A-10) -------------------


def test_new_accounts_are_hashed_with_argon2id(client):
    from app.core.security import verify_password

    email = "argon2-new@test.dev"
    _register_uid(client, email)
    db = SessionLocal()
    try:
        h = db.query(User.password_hash).filter(User.email == email).scalar()
    finally:
        db.close()
    assert h.startswith("$argon2id$")
    assert verify_password("pass1234", h)
    assert not verify_password("wrong-pass1", h)


def test_verify_password_returns_false_on_malformed_hashes():
    from app.core.security import verify_password

    assert not verify_password("whatever", "")
    assert not verify_password("whatever", "not-a-real-hash")
    assert not verify_password("whatever", "$2b$12$notenoughcharactersorvalidsaltvalue")


def test_legacy_bcrypt_hash_upgraded_to_argon2id_on_login(client):
    from passlib.context import CryptContext

    email = "argon2-upgrade@test.dev"
    legacy = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("pass1234")
    assert legacy.startswith("$2")  # genuinely a bcrypt row
    db = SessionLocal()
    try:
        u = User(
            name="Legacy User", email=email,
            password_hash=legacy, role=UserRole.TRAINEE,
        )
        db.add(u)
        db.commit()
        uid = int(u.id)
    finally:
        db.close()

    ok = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert ok.status_code == 200
    db = SessionLocal()
    try:
        h = db.query(User.password_hash).filter(User.id == uid).scalar()
    finally:
        db.close()
    assert h.startswith("$argon2id$")
    assert h != legacy

    # new hash works for both a good and a bad password
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).status_code == 200
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "wrong-pass1"}
    ).status_code == 401


# --- AUTH_TRD Day 3: one-time token store + mail interface -------------------


def test_one_time_token_stores_only_hash_and_is_single_use():
    from app.core.tokens import consume_one_time_token, create_one_time_token
    from app.db.models import OneTimeToken

    db = SessionLocal()
    try:
        uid = int(db.query(User.id).filter(User.email == "u@test.dev").scalar())

        raw = create_one_time_token(db, uid, "verify_email")
        db.commit()
        assert len(raw) >= 40  # 32 random bytes, URL-safe

        row = (
            db.query(OneTimeToken)
            .filter(OneTimeToken.user_id == uid, OneTimeToken.purpose == "verify_email")
            .order_by(OneTimeToken.id.desc())
            .first()
        )
        assert len(row.token_hash) == 64  # SHA-256 hex only
        assert raw not in row.token_hash  # raw value never persisted
        assert row.used_at is None

        # first consume wins and marks used_at in the caller's transaction
        got = consume_one_time_token(db, raw, "verify_email")
        assert got is not None and got.id == row.id
        db.commit()

        # second use of the same token is rejected
        assert consume_one_time_token(db, raw, "verify_email") is None

        # wrong purpose is rejected without consuming the fresh token
        raw2 = create_one_time_token(db, uid, "verify_email")
        db.commit()
        assert consume_one_time_token(db, raw2, "reset_password") is None

        # expired token is rejected
        raw3 = create_one_time_token(db, uid, "verify_email")
        db.commit()
        r3 = (
            db.query(OneTimeToken)
            .filter(OneTimeToken.user_id == uid)
            .order_by(OneTimeToken.id.desc())
            .first()
        )
        r3.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
        assert consume_one_time_token(db, raw3, "verify_email") is None

        # garbage / empty input is rejected
        assert consume_one_time_token(db, "no-such-token", "verify_email") is None
        assert consume_one_time_token(db, None, "verify_email") is None
    finally:
        db.close()


def test_create_one_time_token_rejects_unknown_purpose():
    from app.core.tokens import create_one_time_token

    db = SessionLocal()
    try:
        uid = int(db.query(User.id).filter(User.email == "u@test.dev").scalar())
        with pytest.raises(ValueError, match="purpose"):
            create_one_time_token(db, uid, "launch_missiles")
    finally:
        db.close()


def test_console_mail_backend_prints_the_message(capsys):
    from app.core.mail import send_mail

    send_mail("user@example.com", "Verify your e-mail", "Click: http://x/#token=abc")
    err = capsys.readouterr().err
    assert "user@example.com" in err
    assert "Verify your e-mail" in err
    assert "token=abc" in err


def test_unknown_mail_backend_raises(monkeypatch):
    from app.core.mail import send_mail

    monkeypatch.setattr(get_settings(), "MAIL_BACKEND", "carrier-pigeon")
    with pytest.raises(RuntimeError, match="Unknown MAIL_BACKEND"):
        send_mail("a@b.c", "subject", "body")


def test_resend_backend_without_api_key_raises(monkeypatch):
    from app.core.mail import send_mail

    monkeypatch.setattr(get_settings(), "MAIL_BACKEND", "resend")
    monkeypatch.setattr(get_settings(), "RESEND_API_KEY", "")
    with pytest.raises(RuntimeError, match="RESEND_API_KEY"):
        send_mail("a@b.c", "subject", "body")

# --- AUTH_TRD Day 4: e-mail verification (A-02, A-03) ------------------------


def _extract_verify_token(capsys) -> str:
    """Pull the raw token from the console-backend mail a register just sent."""
    import re

    mails = capsys.readouterr().err
    found = re.findall(r"#token=([A-Za-z0-9_-]+)", mails)
    assert found, f"no verification link in console mail: {mails!r}"
    return found[-1]  # the most recent register wins


def test_a02_unverified_login_rejected_until_email_verified(client, monkeypatch, capsys):
    monkeypatch.setattr(get_settings(), "REQUIRE_EMAIL_VERIFICATION", True)
    email = "a02-unverified@test.dev"
    _register_uid(client, email)
    token = _extract_verify_token(capsys)

    denied = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert denied.status_code == 403
    assert denied.json()["detail"] == "email_not_verified"
    # a wrong password still answers the generic 401 (no verification hint)
    wrong = client.post("/api/auth/login", json={"email": email, "password": "wrong-pass1"})
    assert wrong.status_code == 401

    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    allowed = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert allowed.status_code == 200
    # the successful verification is audited exactly once (A-13)
    assert len(_events("email_verified", user_id=_uid(email))) == 1


def test_a03_verify_token_is_single_use_and_expiry_is_uniform_400(client, monkeypatch, capsys):
    from app.core.tokens import create_one_time_token
    from app.db.models import OneTimeToken

    monkeypatch.setattr(get_settings(), "REQUIRE_EMAIL_VERIFICATION", True)
    email = "a03-verify@test.dev"
    uid = _register_uid(client, email)
    token = _extract_verify_token(capsys)

    first = client.post("/api/auth/verify-email", json={"token": token})
    assert first.status_code == 200
    # second use of the same token → 400, same body as any other failure
    second = client.post("/api/auth/verify-email", json={"token": token})
    assert second.status_code == 400
    assert second.json()["detail"] == "Invalid or expired token"

    # an expired token → identical uniform 400
    db = SessionLocal()
    try:
        raw = create_one_time_token(db, uid, "verify_email")
        db.commit()
        row = (
            db.query(OneTimeToken)
            .filter(OneTimeToken.user_id == uid)
            .order_by(OneTimeToken.id.desc())
            .first()
        )
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()
    expired = client.post("/api/auth/verify-email", json={"token": raw})
    assert expired.status_code == 400
    assert expired.json() == second.json()

    # garbage token → same body again (never reveals why)
    garbage = client.post("/api/auth/verify-email", json={"token": "not-a-token"})
    assert garbage.status_code == 400
    assert garbage.json() == second.json()


def test_resend_verification_is_identical_202_for_unknown_and_known(client):
    unknown = client.post(
        "/api/auth/resend-verification", json={"email": "ghost-a04@test.dev"}
    )
    known = client.post(
        "/api/auth/resend-verification", json={"email": "u@test.dev"}  # verified
    )
    assert unknown.status_code == known.status_code == 202
    assert unknown.json() == known.json()


def test_resend_verification_capped_at_three_mails_per_hour(client, capsys):
    from app.db.models import OneTimeToken

    email = "resend-cap@test.dev"
    uid = _register_uid(client, email)
    capsys.readouterr()  # drop the register mail

    def _mail_tokens() -> int:
        db = SessionLocal()
        try:
            return (
                db.query(OneTimeToken.id)
                .filter(
                    OneTimeToken.user_id == uid,
                    OneTimeToken.purpose == "verify_email",
                )
                .count()
            )
        finally:
            db.close()

    # register already sent 1; only 2 more fit inside the 3/hour window
    for _ in range(3):
        assert client.post(
            "/api/auth/resend-verification", json={"email": email}
        ).status_code == 202
    assert _mail_tokens() == 3  # register + 2 resends; 3rd resend silently dropped

    assert client.post(
        "/api/auth/resend-verification", json={"email": email}
    ).status_code == 202
    assert _mail_tokens() == 3  # still capped, still 202


def test_production_refuses_console_mail_when_verification_required():
    s = Settings(
        APP_ENV="production",
        JWT_SECRET="x" * 40,
        CORS_ALLOW_ORIGINS="https://example.vercel.app",
        REQUIRE_EMAIL_VERIFICATION=True,
        MAIL_BACKEND="console",
        TOTP_ENCRYPTION_KEY="ZiFfQePsI6NwHLzy15aXCdukWeXbeF-EwvRY8jufxk0=",
    )
    with pytest.raises(RuntimeError, match="MAIL_BACKEND"):
        s.assert_production_ready()
    # a real backend passes
    s.MAIL_BACKEND = "resend"
    s.assert_production_ready()

# --- AUTH_TRD Day 5: forgot / reset / change password (A-04..A-06, A-09) -----


def test_a04_forgot_password_identical_202_for_unknown_and_known(client):
    unknown = client.post(
        "/api/auth/password/forgot", json={"email": "ghost-a05@test.dev"}
    )
    known = client.post(
        "/api/auth/password/forgot", json={"email": "u@test.dev"}
    )
    assert unknown.status_code == known.status_code == 202
    assert unknown.json() == known.json()


def test_a04_forgot_password_capped_at_three_mails_per_hour(client, capsys):
    from app.db.models import OneTimeToken

    email = "forgot-cap@test.dev"
    uid = _register_uid(client, email)
    capsys.readouterr()  # drop the register mail

    def _reset_tokens() -> int:
        db = SessionLocal()
        try:
            return (
                db.query(OneTimeToken.id)
                .filter(
                    OneTimeToken.user_id == uid,
                    OneTimeToken.purpose == "reset_password",
                )
                .count()
            )
        finally:
            db.close()

    for _ in range(4):
        assert client.post(
            "/api/auth/password/forgot", json={"email": email}
        ).status_code == 202
    # 3 in the window (2nd/3rd/4th call), 5th silently dropped — always 202
    assert _reset_tokens() == 3


def test_a05_reset_revokes_all_sessions_and_token_is_single_use(client, capsys):
    email = "a05-reset@test.dev"
    uid = _register_uid(client, email)
    s1 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()
    s2 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()
    capsys.readouterr()  # drop register mail

    assert client.post(
        "/api/auth/password/forgot", json={"email": email}
    ).status_code == 202
    token = _extract_verify_token(capsys)  # last mail in the box = reset link

    # weak new password rejected by the shared policy, token NOT consumed
    weak = client.post(
        "/api/auth/password/reset", json={"token": token, "new_password": "short"}
    )
    assert weak.status_code == 422

    ok = client.post(
        "/api/auth/password/reset",
        json={"token": token, "new_password": "NewPass1234"},
    )
    assert ok.status_code == 200

    # reuse of the same token → uniform 400 (A-05)
    reuse = client.post(
        "/api/auth/password/reset",
        json={"token": token, "new_password": "NewPass5678"},
    )
    assert reuse.status_code == 400
    assert reuse.json()["detail"] == "Invalid or expired token"

    # every session died with the reset
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s1["refresh_token"]}
    ).status_code == 401
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s2["refresh_token"]}
    ).status_code == 401

    # old password out, new password in
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "NewPass1234"}
    ).status_code == 200

    # exactly one event per flow step (A-13)
    assert len(_events("password_reset_request", user_id=uid)) == 1
    assert len(_events("password_reset_done", user_id=uid)) == 1


def test_a09_change_password_keeps_current_session_revokes_others(client):
    email = "a09-change@test.dev"
    uid = _register_uid(client, email)
    s1 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()
    s2 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()

    wrong = client.post(
        "/api/auth/password/change",
        headers={"Authorization": f"Bearer {s1['access_token']}"},
        json={"current_password": "not-the-pass1", "new_password": "NewPass1234"},
    )
    assert wrong.status_code == 401

    ok = client.post(
        "/api/auth/password/change",
        headers={"Authorization": f"Bearer {s1['access_token']}"},
        json={
            "current_password": "pass1234",
            "new_password": "NewPass1234",
            "refresh_token": s1["refresh_token"],
        },
    )
    assert ok.status_code == 200

    # the other session is dead...
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s2["refresh_token"]}
    ).status_code == 401
    # ...the session that changed the password still refreshes
    kept = client.post(
        "/api/auth/refresh", json={"refresh_token": s1["refresh_token"]}
    )
    assert kept.status_code == 200

    # password actually swapped
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "NewPass1234"}
    ).status_code == 200
    assert len(_events("password_change", user_id=uid)) == 1

# --- AUTH_TRD Day 6: refresh families, sessions, logout-all (A-14) -----------


def _family_of(raw_refresh: str) -> str:
    from app.core.refresh import hash_token

    db = SessionLocal()
    try:
        return str(
            db.query(RefreshToken.family_id)
            .filter(RefreshToken.token_hash == hash_token(raw_refresh))
            .scalar()
        )
    finally:
        db.close()


def test_rotation_keeps_family_and_captures_device_info(client):
    from app.core.refresh import hash_token

    email = "family-rotation@test.dev"
    _register_uid(client, email)
    t = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()

    db = SessionLocal()
    try:
        row1 = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_token(t["refresh_token"]))
            .one()
        )
        family = row1.family_id
        assert family and len(family) == 32
        assert row1.user_agent  # captured from the login request
        assert row1.ip
        assert row1.last_used_at is None
    finally:
        db.close()

    rr = client.post("/api/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert rr.status_code == 200

    db = SessionLocal()
    try:
        row1 = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_token(t["refresh_token"]))
            .one()
        )
        row2 = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_token(rr.json()["refresh_token"]))
            .one()
        )
        assert row2.family_id == family  # rotation inherits the family
        assert row2.user_agent == row1.user_agent
        assert row2.ip == row1.ip
        assert row1.used_at is not None and row1.last_used_at is not None
    finally:
        db.close()


def test_sessions_list_marks_current_and_revoke_kills_one_device(client):
    email = "sessions-user@test.dev"
    _register_uid(client, email)
    s1 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()
    s2 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()
    auth1 = {"Authorization": f"Bearer {s1['access_token']}"}

    r = client.get("/api/auth/sessions", headers={
        **auth1, "X-Refresh-Token": s1["refresh_token"],
    })
    assert r.status_code == 200
    sessions = r.json()["sessions"]
    assert len(sessions) == 2
    assert all(s["user_agent"] for s in sessions)
    assert all(s["ip"] for s in sessions)
    currents = [s for s in sessions if s["current"]]
    assert len(currents) == 1

    # revoke the OTHER device by its family id
    other_fam = _family_of(s2["refresh_token"])
    assert other_fam != _family_of(s1["refresh_token"])
    d = client.delete(f"/api/auth/sessions/{other_fam}", headers=auth1)
    assert d.status_code == 200

    # that device is dead; the caller's session still refreshes
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s2["refresh_token"]}
    ).status_code == 401
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s1["refresh_token"]}
    ).status_code == 200

    # an unknown family id (or another user's) is a plain 404
    assert client.delete(
        f"/api/auth/sessions/{'f' * 32}", headers=auth1
    ).status_code == 404


def test_a14_concurrent_refresh_race_does_not_wipe_the_session(client):
    email = "a14-race@test.dev"
    _register_uid(client, email)
    t = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()

    first = client.post("/api/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert first.status_code == 200
    # second tab presents the same, just-rotated token inside the grace
    # window → the race answer, NOT a session wipe (A-14)
    second = client.post("/api/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert second.status_code == 401
    assert "already used" in second.json()["detail"]
    # the successor from the winning refresh still works
    third = client.post(
        "/api/auth/refresh", json={"refresh_token": first.json()["refresh_token"]}
    )
    assert third.status_code == 200


def test_logout_all_revokes_every_session(client):
    email = "logout-all@test.dev"
    uid = _register_uid(client, email)
    s1 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()
    s2 = client.post("/api/auth/login", json={"email": email, "password": "pass1234"}).json()

    r = client.post(
        "/api/auth/logout-all",
        headers={"Authorization": f"Bearer {s1['access_token']}"},
    )
    assert r.status_code == 200
    assert r.json()["revoked_refresh_tokens"] >= 2
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s1["refresh_token"]}
    ).status_code == 401
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": s2["refresh_token"]}
    ).status_code == 401
    # the access token used to call it is deny-listed as well
    assert client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {s1['access_token']}"}
    ).status_code == 401
    assert len(_events("logout_all", user_id=uid)) == 1

# --- AUTH_TRD Day 7: TOTP enrol/enable/disable + recovery codes (A-06, A-07) --

def test_a06_totp_window_and_replayed_code():
    from datetime import timezone

    import pyotp

    from app.core.mfa import generate_totp_secret, verify_totp_code

    secret = generate_totp_secret()
    totp = pyotp.TOTP(secret)
    step = 10_000_000  # fixed timestep: no clock flake
    now = step * 30 + 5  # five seconds into the step

    def code_at(s: int) -> str:
        return totp.at(datetime.fromtimestamp(s * 30, tz=timezone.utc))

    # valid now → accept, returns the timestep
    assert verify_totp_code(secret, code_at(step), None, now=now) == step
    # one step old → accept
    assert verify_totp_code(secret, code_at(step - 1), None, now=now) == step - 1
    # two steps old → reject
    assert verify_totp_code(secret, code_at(step - 2), None, now=now) is None
    # replay of an already-consumed step → reject (single-use, A-06)
    assert verify_totp_code(secret, code_at(step), step, now=now) is None
    # malformed input → reject
    assert verify_totp_code(secret, "12ab56", None, now=now) is None
    assert verify_totp_code(secret, "12345", None, now=now) is None


def test_a07_recovery_code_is_single_use():
    from app.core.mfa import (
        consume_recovery_code,
        generate_recovery_code,
        hash_recovery_code,
    )

    db = SessionLocal()
    try:
        uid = _uid("u@test.dev")
        code = generate_recovery_code()
        db.add(RecoveryCode(user_id=uid, code_hash=hash_recovery_code(code)))
        db.commit()

        assert consume_recovery_code(db, uid, code) is True
        db.commit()
        # second use of the same code → rejected (A-07)
        assert consume_recovery_code(db, uid, code) is False
        # an unknown code → rejected
        assert consume_recovery_code(db, uid, generate_recovery_code()) is False

        # normalisation: lowercase and dash-stripped still match
        code2 = generate_recovery_code()
        db.add(RecoveryCode(user_id=uid, code_hash=hash_recovery_code(code2)))
        db.commit()
        assert consume_recovery_code(db, uid, code2.lower().replace("-", "")) is True
        db.commit()
    finally:
        db.close()


def test_mfa_setup_enable_disable_flow(client):
    import pyotp

    email = "mfa-flow@test.dev"
    uid = _register_uid(client, email)
    auth = {"Authorization": f"Bearer {_login_token(client, email)}"}

    # setup requires authentication
    assert client.post("/api/auth/mfa/setup").status_code == 401

    # stage a secret: shown once, stored encrypted, NOT active yet
    setup = client.post("/api/auth/mfa/setup", headers=auth)
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_uri"].startswith("otpauth://totp/")
    db = SessionLocal()
    try:
        row = db.query(User).filter(User.id == uid).one()
        assert row.totp_secret_enc and secret not in row.totp_secret_enc
        assert not row.totp_enabled
    finally:
        db.close()

    # enable with a wrong code → 400, still not enabled
    bad = client.post("/api/auth/mfa/enable", headers=auth, json={"code": "000000"})
    assert bad.status_code == 400
    # enable with the real code → 10 recovery codes, shown once
    code = pyotp.TOTP(secret).now()
    ok = client.post("/api/auth/mfa/enable", headers=auth, json={"code": code})
    assert ok.status_code == 200
    codes = ok.json()["recovery_codes"]
    assert len(codes) == 10
    assert all(len(c) == 11 and c[5] == "-" for c in codes)

    db = SessionLocal()
    try:
        row = db.query(User).filter(User.id == uid).one()
        assert row.totp_enabled
        stored = (
            db.query(RecoveryCode).filter(RecoveryCode.user_id == uid).count()
        )
        assert stored == 10
    finally:
        db.close()
    assert len(_events("mfa_enabled", user_id=uid)) == 1

    # second setup / enable while enabled → 409
    assert client.post("/api/auth/mfa/setup", headers=auth).status_code == 409
    assert client.post(
        "/api/auth/mfa/enable", headers=auth, json={"code": code}
    ).status_code == 409

    # disable needs the password: wrong one → 401
    wrong = client.post(
        "/api/auth/mfa/disable",
        headers=auth,
        json={"password": "not-the-pass1", "code": code},
    )
    assert wrong.status_code == 401
    # valid password + a recovery code → off, secret and codes wiped.
    # (A fresh TOTP in the SAME step would be a replay of the code already
    # consumed at enable — correctly rejected by A-06 — so the natural
    # same-window fallback is a recovery code, which is what it is for.)
    off = client.post(
        "/api/auth/mfa/disable",
        headers=auth,
        json={"password": "pass1234", "code": codes[0]},
    )
    assert off.status_code == 200
    db = SessionLocal()
    try:
        row = db.query(User).filter(User.id == uid).one()
        assert not row.totp_enabled
        assert row.totp_secret_enc is None
        assert (
            db.query(RecoveryCode).filter(RecoveryCode.user_id == uid).count()
            == 0
        )
    finally:
        db.close()
    assert len(_events("mfa_disabled", user_id=uid)) == 1

    # disable again → 400 (nothing to disable)
    assert client.post(
        "/api/auth/mfa/disable",
        headers=auth,
        json={"password": "pass1234", "code": "123456"},
    ).status_code == 400


def test_mfa_endpoints_without_setup_or_auth(client):
    email = "mfa-edge@test.dev"
    _register_uid(client, email)
    auth = {"Authorization": f"Bearer {_login_token(client, email)}"}
    # enable before setup → 400
    assert client.post(
        "/api/auth/mfa/enable", headers=auth, json={"code": "123456"}
    ).status_code == 400
    # disable before enable → 400
    assert client.post(
        "/api/auth/mfa/disable",
        headers=auth,
        json={"password": "pass1234", "code": "123456"},
    ).status_code == 400
    # unauthenticated → 401
    assert client.post("/api/auth/mfa/enable", json={"code": "123456"}).status_code == 401
    assert client.post(
        "/api/auth/mfa/disable", json={"password": "x", "code": "123456"}
    ).status_code == 401


def test_production_refuses_missing_totp_encryption_key():
    with pytest.raises(RuntimeError, match="TOTP_ENCRYPTION_KEY"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="x" * 40,
            CORS_ALLOW_ORIGINS="https://a.app",
        ).assert_production_ready()

# --- AUTH_TRD Day 8: MFA challenge on login (A-08) ----------------------------


def _enable_mfa(client, email: str) -> tuple[dict, str, list]:
    """Enable MFA for an existing account; returns (headers, secret, codes)."""
    import pyotp

    auth = {"Authorization": f"Bearer {_login_token(client, email)}"}
    setup = client.post("/api/auth/mfa/setup", headers=auth)
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    enable = client.post(
        "/api/auth/mfa/enable", headers=auth, json={"code": pyotp.TOTP(secret).now()}
    )
    assert enable.status_code == 200
    return auth, secret, enable.json()["recovery_codes"]


def test_a08_mfa_token_is_purpose_bound(client, monkeypatch):
    import time as _time

    import app.core.mfa as mfa_mod
    import pyotp

    email = "a08-mfa@test.dev"
    uid = _register_uid(client, email)
    pre_auth, secret, _codes = _enable_mfa(client, email)
    pre_access = pre_auth["Authorization"].split(" ", 1)[1]

    # password login now stops at the second factor: challenge, no session
    r = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert r.status_code == 200
    body = r.json()
    assert body["mfa_required"] is True
    mfa_token = body["mfa_token"]
    assert "access_token" not in body and "refresh_token" not in body

    # A-08: the challenge is not an access token...
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {mfa_token}"}
        ).status_code
        == 401
    )
    # ...and an access token is not a challenge
    assert (
        client.post(
            "/api/auth/mfa/verify",
            json={"mfa_token": pre_access, "code": "123456"},
        ).status_code
        == 401
    )
    # a wrong code on the real challenge → 401
    assert (
        client.post(
            "/api/auth/mfa/verify",
            json={"mfa_token": mfa_token, "code": "123456"},
        ).status_code
        == 401
    )

    # garbage challenge → 401
    assert (
        client.post(
            "/api/auth/mfa/verify", json={"mfa_token": "not.a.jwt", "code": "123456"}
        ).status_code
        == 401
    )

    # valid code completes the login and yields a normal session.
    # Enable already consumed the current step (A-06 single-use), so shift
    # the challenge clock one step forward — a real user would just wait
    # for the next 30 s window.
    class _ShiftedClock:
        def time(self):
            return _time.time() + 31

    monkeypatch.setattr(mfa_mod, "time", _ShiftedClock())
    shifted_step = int((_time.time() + 31) // 30)
    fresh_code = pyotp.TOTP(secret).at(shifted_step * 30)
    ok = client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": mfa_token, "code": fresh_code},
    )
    assert ok.status_code == 200
    tokens = ok.json()
    assert tokens["access_token"] and tokens["refresh_token"]
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200 and me.json()["email"] == email

    # A-13: login_ok once for the password login, once with mfa:true here
    rows = _events("login_ok", user_id=uid)
    assert len(rows) == 2
    assert (rows[-1].detail or {}).get("mfa") is True
    assert "mfa" not in (rows[0].detail or {})


def test_mfa_verify_locks_after_five_wrong_codes(client):
    import pyotp

    email = "mfa-lock@test.dev"
    uid = _register_uid(client, email)
    _auth, secret, codes = _enable_mfa(client, email)

    def wrong_code() -> str:
        # guaranteed not to equal the current valid code
        valid = int(pyotp.TOTP(secret).now())
        return str((valid + 1) % 10**6).zfill(6)

    challenge = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()["mfa_token"]

    for _ in range(5):
        bad = client.post(
            "/api/auth/mfa/verify",
            json={"mfa_token": challenge, "code": wrong_code()},
        )
        assert bad.status_code == 401

    # sixth attempt → 429 + Retry-After (§6)
    locked = client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": challenge, "code": wrong_code()},
    )
    assert locked.status_code == 429
    assert "Retry-After" in locked.headers
    # even the right code is refused while this challenge is locked
    assert (
        client.post(
            "/api/auth/mfa/verify",
            json={"mfa_token": challenge, "code": pyotp.TOTP(secret).now()},
        ).status_code
        == 429
    )

    # a fresh login gets a fresh (unlocked) challenge — verified with an
    # unused recovery code (the enable step already consumed the current
    # TOTP step, A-06 single-use)
    fresh = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()["mfa_token"]
    ok = client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": fresh, "code": codes[0]},
    )
    assert ok.status_code == 200

    # exactly one mfa_fail event per refused code (A-13)
    assert len(_events("mfa_fail", user_id=uid)) == 5


def test_mfa_verify_accepts_recovery_code_once(client):
    email = "mfa-recovery@test.dev"
    uid = _register_uid(client, email)
    _auth, _secret, codes = _enable_mfa(client, email)

    challenge = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()["mfa_token"]
    ok = client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": challenge, "code": codes[0]},
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    # the same recovery code at the next login → rejected (A-07 end-to-end)
    challenge2 = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    ).json()["mfa_token"]
    bad = client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": challenge2, "code": codes[0]},
    )
    assert bad.status_code == 401
    # a different (unused) recovery code still works for that challenge
    ok2 = client.post(
        "/api/auth/mfa/verify",
        json={"mfa_token": challenge2, "code": codes[1]},
    )
    assert ok2.status_code == 200
    assert len(_events("mfa_fail", user_id=uid)) == 1


# ── Google Sign-In ────────────────────────────────────────────────────────────

_TEST_GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"


def _patch_google(monkeypatch, payload: dict | None = None, exc: Exception | None = None):
    """Point the endpoint at a fake ID-token verifier."""
    import app.api.auth as auth_mod

    monkeypatch.setattr(auth_mod.settings, "GOOGLE_CLIENT_ID", _TEST_GOOGLE_CLIENT_ID)

    def fake_verify(token, request, client_id):
        assert client_id == _TEST_GOOGLE_CLIENT_ID
        if exc is not None:
            raise exc
        return payload or {}

    monkeypatch.setattr(auth_mod.google_id_token, "verify_oauth2_token", fake_verify)


def test_google_disabled_returns_501(client, monkeypatch):
    import app.api.auth as auth_mod

    monkeypatch.setattr(auth_mod.settings, "GOOGLE_CLIENT_ID", "")
    r = client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 501


def test_google_invalid_token_is_uniform_401(client, monkeypatch):
    _patch_google(monkeypatch, exc=ValueError("bad token"))
    r = client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid Google token"


def test_google_unverified_address_is_rejected(client, monkeypatch):
    _patch_google(
        monkeypatch,
        payload={"email": "unverified@test.dev", "email_verified": False},
    )
    r = client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 401


def test_google_signup_creates_verified_trainee(client, monkeypatch):
    email = "goog-new@test.dev"
    _patch_google(
        monkeypatch,
        payload={"email": email, "email_verified": True, "name": "Goog New"},
    )
    r = client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == email
    assert body["name"] == "Goog New"
    assert body["role"] == "trainee"
    assert body["email_verified_at"] is not None  # Google already confirmed it
    assert body["totp_enabled"] is False

    # An audit trail exists and never contains the token.
    uid = _uid(email)
    assert len(_events("register", user_id=uid)) == 1
    assert (_events("register", user_id=uid)[0].detail or {}).get("provider") == "google"
    assert len(_events("login_ok", user_id=uid)) == 1

    # The account has no usable password: password login must fail.
    bad = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"}
    )
    assert bad.status_code == 401


def test_google_existing_password_user_signs_in(client, monkeypatch):
    email = "goog-existing@test.dev"
    uid = _register_uid(client, email)
    _patch_google(
        monkeypatch, payload={"email": email.upper(), "email_verified": True}
    )
    r = client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 200
    tokens = r.json()
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200 and me.json()["id"] == uid

    # No second account, and the original password still works.
    assert _events("register", user_id=uid) and len(_events("login_ok", user_id=uid)) == 1
    assert (
        client.post(
            "/api/auth/login", json={"email": email, "password": "pass1234"}
        ).status_code
        == 200
    )
    assert len(_events("login_ok", user_id=uid)) == 2  # google + password


def test_google_signin_still_requires_totp_when_enabled(client, monkeypatch):
    import time as _time

    import app.core.mfa as mfa_mod
    import pyotp

    email = "goog-mfa@test.dev"
    uid = _register_uid(client, email)
    _auth, secret, _codes = _enable_mfa(client, email)
    _patch_google(monkeypatch, payload={"email": email, "email_verified": True})

    r = client.post("/api/auth/google", json={"id_token": "x" * 40})
    assert r.status_code == 200
    body = r.json()
    assert body["mfa_required"] is True and "access_token" not in body

    class _ShiftedClock:
        def time(self):
            return _time.time() + 31

    monkeypatch.setattr(mfa_mod, "time", _ShiftedClock())
    step = int((_time.time() + 31) // 30)
    code = pyotp.TOTP(secret).at(step * 30)
    ok = client.post(
        "/api/auth/mfa/verify", json={"mfa_token": body["mfa_token"], "code": code}
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]
    assert (_events("login_ok", user_id=uid)[-1].detail or {}).get("mfa") is True


# --- AUTH_TRD Day 10: admin people management + audit viewer (A-11, A-12) ------


def _set_role(client, admin_headers, target_id: int, role: str):
    return client.patch(
        f"/api/admin/users/{target_id}", json={"role": role}, headers=admin_headers
    )


def test_admin_users_list_never_exposes_secrets(client, admin_headers):
    r = client.get("/api/admin/users", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert any(u["email"] == "a@test.dev" for u in body)
    for u in body:
        assert set(u) == {
            "id", "name", "email", "role", "is_active",
            "email_verified_at", "totp_enabled", "created_at",
        }


def test_admin_users_endpoints_require_admin(client, user_headers):
    assert client.get("/api/admin/users", headers=user_headers).status_code == 403
    assert client.get("/api/admin/auth-events", headers=user_headers).status_code == 403
    assert client.patch(
        "/api/admin/users/1", json={"role": "trainee"}, headers=user_headers
    ).status_code == 403


def test_a11_demoted_admin_loses_access_on_next_request(client):
    """A-11: the role lives in the database, not the token — demotion is immediate."""
    email = "a11-admin@test.dev"
    uid = _register_uid(client, email)
    admin_h = _login(client, "a@test.dev")
    assert _set_role(client, admin_h, uid, "admin").status_code == 200

    victim = {"Authorization": f"Bearer {_login_token(client, email)}"}
    assert client.get("/api/auth/me", headers=victim).status_code == 200

    demote = _set_role(client, admin_h, uid, "trainee")
    assert demote.status_code == 200
    assert demote.json()["role"] == "trainee"

    # the very next request with the still-unexpired token: the account is
    # fine, but the admin surface is closed (role comes from the DB, A-11)
    me = client.get("/api/auth/me", headers=victim)
    assert me.status_code == 200 and me.json()["role"] == "trainee"
    assert client.get("/api/admin/users", headers=victim).status_code == 403

    # …and the change is in the audit trail with actor + before/after
    # (two rows total: the promotion that made them an admin, then the demotion)
    rows = _events("role_change", user_id=uid)
    assert len(rows) == 2
    assert rows[-1].detail["from"] == "admin" and rows[-1].detail["to"] == "trainee"
    assert rows[-1].detail["actor"] == _uid("a@test.dev")


def test_a12_last_admin_cannot_be_demoted_or_disabled(client, admin_headers):
    """A-12: the only remaining admin is protected (409)."""
    last_id = _uid("a@test.dev")

    # Earlier tests seed a demo admin — park every other admin for the duration
    # of this test so "last admin" actually means last, then put them back.
    db = SessionLocal()
    try:
        parked = [
            (u.id, u.role)
            for u in db.query(User).filter(
                User.role == UserRole.ADMIN, User.id != last_id
            ).all()
        ]
        for pid, _ in parked:
            db.query(User).filter(User.id == pid).update({"role": UserRole.TRAINEE})
        db.commit()
    finally:
        db.close()

    try:
        assert _set_role(client, admin_headers, last_id, "trainee").status_code == 409
        assert client.patch(
            f"/api/admin/users/{last_id}", json={"is_active": False}, headers=admin_headers
        ).status_code == 409

        # with a second admin around, the first one can be demoted
        second = "a12-second@test.dev"
        sid = _register_uid(client, second)
        assert _set_role(client, admin_headers, sid, "admin").status_code == 200
        assert _set_role(client, admin_headers, last_id, "trainee").status_code == 200

        # but now *that* one is the last admin
        second_headers = {"Authorization": f"Bearer {_login_token(client, second)}"}
        assert _set_role(client, second_headers, sid, "trainee").status_code == 409

        # restore the seeded admin and the new one to plain trainee
        assert _set_role(client, second_headers, last_id, "admin").status_code == 200
        assert _set_role(client, admin_headers, sid, "trainee").status_code == 200
    finally:
        db = SessionLocal()
        try:
            db.query(User).filter(User.id == last_id).update({"role": UserRole.ADMIN})
            for pid, role in parked:
                db.query(User).filter(User.id == pid).update({"role": role})
            db.commit()
        finally:
            db.close()


def test_disabled_account_is_dead_everywhere(client):
    """Password login, existing tokens and refresh all stop working (Day 10)."""
    email = "disabled@test.dev"
    uid = _register_uid(client, email)
    admin_h = _login(client, "a@test.dev")

    # grab a refresh token BEFORE the account is disabled
    login = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert login.status_code == 200
    refresh = login.json()["refresh_token"]
    access = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=access).status_code == 200

    r = client.patch(
        f"/api/admin/users/{uid}", json={"is_active": False}, headers=admin_h
    )
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert _events("account_disabled", user_id=uid)

    # a still-valid token holds no session anymore (403, checked per request)
    assert client.get("/api/auth/me", headers=access).status_code == 403
    # the password is still correct — the account is disabled, so 403
    bad = client.post("/api/auth/login", json={"email": email, "password": "pass1234"})
    assert bad.status_code == 403 and bad.json()["detail"] == "Account disabled"
    # an old refresh token cannot mint a new session either
    ref = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert ref.status_code == 401

    # re-enable → everything works again, audited
    r = client.patch(
        f"/api/admin/users/{uid}", json={"is_active": True}, headers=admin_h
    )
    assert r.status_code == 200 and r.json()["is_active"] is True
    assert _events("account_enabled", user_id=uid)
    assert client.get("/api/auth/me", headers=access).status_code == 200


def test_admin_auth_events_viewer_filters(client, admin_headers):
    email = "audit-viewer@test.dev"
    uid = _register_uid(client, email)
    client.post("/api/auth/login", json={"email": email, "password": "wrong-pass"})

    r = client.get(
        f"/api/admin/auth-events?user_id={uid}&event=login_fail&limit=10",
        headers=admin_headers,
    )
    assert r.status_code == 200
    rows = r.json()
    assert rows and all(x["event"] == "login_fail" and x["user_id"] == uid for x in rows)
    # newest first
    assert rows[0]["id"] >= rows[-1]["id"]


def test_patch_validation_and_404(client, admin_headers):
    uid = _uid("u@test.dev")
    assert client.patch(
        f"/api/admin/users/{uid}", json={}, headers=admin_headers
    ).status_code == 400
    assert client.patch(
        "/api/admin/users/999999", json={"role": "engineer"}, headers=admin_headers
    ).status_code == 404


def test_make_admin_cli_recovers_lockout(client):
    """Offline recovery path: promote from the server shell, idempotently."""
    from app.scripts.make_admin import make_admin

    email = "cli-admin@test.dev"
    uid = _register_uid(client, email)
    admin_h = _login(client, "a@test.dev")
    client.patch(f"/api/admin/users/{uid}", json={"is_active": False}, headers=admin_h)

    assert make_admin(email) == 0
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.id == uid).first()
        assert u.role == UserRole.ADMIN and u.is_active is True
    finally:
        db.close()
    assert _events("role_change", user_id=uid)[-1].detail["actor"] == "make_admin_cli"

    # idempotent: running it again changes nothing and succeeds
    assert make_admin(email) == 0
    assert make_admin("nobody@test.dev") == 1

    # the recovered admin can actually sign in
    assert client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {_login_token(client, email)}"}
    ).status_code == 200


def test_api_sends_allow_nothing_csp(client):
    """Day 10 (T5): the API is JSON/SSE only — CSP allows no script at all."""
    r = client.get("/health")
    csp = r.headers.get("Content-Security-Policy", "")
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp
