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

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.db.session import engine, Base, SessionLocal  # noqa: E402
from app.catalog.loader import load_catalog_to_db, register_sample_documents  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.db.models import User, UserRole  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.add(User(name="Test User", email="u@test.dev",
                    password_hash=get_password_hash("pass1234"), role=UserRole.USER))
        db.add(User(name="Test Admin", email="a@test.dev",
                    password_hash=get_password_hash("pass1234"), role=UserRole.ADMIN))
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
    r = client.post("/api/auth/register", json={"name": "X", "email": "x@test.dev", "password": "pass1234"})
    assert r.status_code == 200
    r = client.post("/api/auth/login", json={"email": "x@test.dev", "password": "pass1234"})
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
    r = client.get("/api/catalog/tests", params={"equipment": "Circuit Breaker"}, headers=user_headers)
    assert r.status_code == 200 and len(r.json()) >= 3


def test_test_detail(client, user_headers):
    tests = client.get("/api/catalog/tests", params={"equipment": "Power Transformer"},
                       headers=user_headers).json()
    test_id = next(t["id"] for t in tests if "Insulation Resistance" in t["name"])
    d = client.get(f"/api/catalog/tests/{test_id}", headers=user_headers).json()
    assert d["steps"] and d["limits"] and d["standards"] and d["safety"]


def test_chat_procedure(client, user_headers):
    r = client.post("/api/chat", headers=user_headers,
                    json={"message": "How do I perform an insulation resistance test on a power transformer?"})
    assert r.status_code == 200
    d = r.json()
    assert d["intent"] == "procedure"
    assert d["equipment"] == "Power Transformer"
    assert "Safety" in d["answer"]
    assert d["citations"]


def test_chat_limits(client, user_headers):
    r = client.post("/api/chat", headers=user_headers,
                    json={"message": "What is the acceptable contact resistance for a circuit breaker?"})
    d = r.json()
    assert d["intent"] == "limits"
    assert "100" in d["answer"]  # catalog limit value present


def test_chat_out_of_scope(client, user_headers):
    d = client.post("/api/chat", headers=user_headers, json={"message": "Who won the football match?"}).json()
    assert d["source_type"] == "out_of_scope"


def test_chat_bypass_refused(client, user_headers):
    d = client.post("/api/chat", headers=user_headers,
                    json={"message": "How can I bypass the interlock on the breaker?"}).json()
    assert d["source_type"] == "guardrail"
    assert "can't help" in d["answer"].lower()


def test_diagnosis(client, user_headers):
    r = client.post("/api/diagnosis", headers=user_headers,
                    json={"equipment_class_id": 1, "symptoms": "moisture high dew point"})
    assert r.status_code == 200 and r.json()["causes"]


def test_check_result_borderline_and_outside(client, user_headers):
    tests = client.get("/api/catalog/tests", params={"equipment": "Circuit Breaker"},
                       headers=user_headers).json()
    test_id = next(t["id"] for t in tests if "Contact Resistance" in t["name"])
    r = client.post("/api/check-result", headers=user_headers,
                    json={"test_id": test_id, "parameter": "Contact resistance per pole",
                          "measured_value": 250.0, "unit": "µΩ"})
    assert r.status_code == 200
    assert r.json()["status"] in ("outside limits", "borderline")


def test_procedure_run_lifecycle(client, user_headers):
    tests = client.get("/api/catalog/tests", params={"equipment": "Power Transformer"},
                       headers=user_headers).json()
    test_id = tests[0]["id"]
    run = client.post("/api/procedures/start", headers=user_headers, json={"test_id": test_id}).json()
    assert run["steps_state"]

    # Sequential completion required
    keys = sorted(run["steps_state"].keys(), key=int)
    for k in keys:
        r = client.put(f"/api/procedures/{run['id']}/step", headers=user_headers,
                       json={"step_no": int(k), "done": True})
        assert r.status_code == 200

    r = client.post(f"/api/procedures/{run['id']}/complete", headers=user_headers, json={"notes": "ok"})
    assert r.status_code == 200 and r.json()["completed_at"]

    # PDF export
    r = client.get(f"/api/procedures/{run['id']}/export", headers=user_headers)
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_quiz_flow(client, user_headers):
    q = client.post("/api/learn/quiz", headers=user_headers,
                    json={"topic": "all", "count": 3}).json()["questions"]
    assert len(q) >= 1
    r = client.post("/api/learn/quiz/submit", headers=user_headers,
                    json={"topic": "all", "question_ids": [x["id"] for x in q],
                          "answers": [x["correct_index"] for x in q]})
    assert r.json()["score"] == r.json()["total"]


def test_admin_documents_and_analytics(client, admin_headers):
    r = client.get("/api/admin/documents", headers=admin_headers)
    assert r.status_code == 200 and any(d["filename"].endswith(".txt") for d in r.json())
    r = client.get("/api/admin/analytics", headers=admin_headers)
    assert r.status_code == 200 and "total_queries" in r.json()


def test_conversation_history(client, user_headers):
    created = client.post("/api/chat", headers=user_headers,
                          json={"message": "SFRA test on transformer"}).json()
    cid = created["conversation_id"]
    lst = client.get("/api/chat/conversations", headers=user_headers).json()
    assert any(c["id"] == cid for c in lst)
    detail = client.get(f"/api/chat/conversations/{cid}", headers=user_headers).json()
    assert len(detail["messages"]) == 2
    assert client.delete(f"/api/chat/conversations/{cid}", headers=user_headers).status_code == 200
