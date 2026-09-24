from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import random

from app.db.session import get_db
from app.db.models import User, Test, QuizAttempt
from app.core.security import get_current_user
from app.schemas import QuizGenerateRequest, QuizGenerateResponse, QuizQuestion, QuizSubmitRequest, QuizSubmitResponse
from app.catalog.lookup import CatalogLookup

router = APIRouter(prefix="/api/learn", tags=["learn"])

# In-memory store of generated questions (question_id -> correct_index, explanation)
_QUIZ_CACHE: dict = {}
_QUIZ_SEQ: int = 0


@router.post("/quiz", response_model=QuizGenerateResponse)
def generate_quiz(request: QuizGenerateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    global _QUIZ_SEQ
    catalog = CatalogLookup(db)
    tests = db.query(Test).all()

    if request.topic and request.topic.lower() not in ("all", ""):
        equip = catalog.find_equipment(request.topic)
        if equip:
            tests = [t for t in tests if t.equipment_class_id == equip.id] or tests

    random.shuffle(tests)

    questions: list[QuizQuestion] = []
    for test in tests:
        if len(questions) >= min(request.count, 10):
            break
        details = catalog.get_test_with_details(test.id)
        if not details or not details["limits"]:
            continue

        limit = random.choice(details["limits"])
        q_type = random.choice(["limit", "purpose", "equipment", "safety"])

        generic_distractors = {
            "purpose": ["To measure supply voltage", "To check meter calibration", "To test the protection relay"],
            "equipment": ["Standard multimeter", "Clamp meter", "Oscilloscope"],
            "safety": ["Test first, isolate later", "Skip earthing for quick tests", "PPE is optional for experienced staff"],
        }

        if q_type == "limit" and limit.min_val is not None and limit.max_val is not None:
            lo, hi = float(limit.min_val), float(limit.max_val)
            correct = f"{limit.min_val}–{limit.max_val} {limit.unit}"
            distractors = [
                f"{lo * 0.5:g}–{hi * 0.5:g} {limit.unit}",
                f"{lo * 1.5:g}–{hi * 1.5:g} {limit.unit}",
                f"{lo * 2:g}–{hi * 2:g} {limit.unit}",
            ]
            question_text = f"What is the acceptable range for {limit.parameter} in {test.name}?"
        elif q_type == "purpose":
            correct = (test.purpose or "To verify equipment condition").strip().split("\n")[0]
            distractors = generic_distractors["purpose"]
            question_text = f"What is the purpose of {test.name}?"
        elif q_type == "equipment" and details["equipment"]:
            correct = details["equipment"][0].instrument_name
            distractors = generic_distractors["equipment"]
            question_text = f"Which instrument is primarily used for {test.name}?"
        else:
            correct = "Isolate → Earth → Verify dead → Permit-to-work → PPE"
            distractors = generic_distractors["safety"]
            question_text = f"What is the correct safety sequence before {test.name}?"

        options = [correct] + distractors[:3]
        random.shuffle(options)
        correct_index = options.index(correct)

        _QUIZ_SEQ += 1
        _QUIZ_CACHE[_QUIZ_SEQ] = {"correct_index": correct_index, "topic": request.topic}

        questions.append(QuizQuestion(
            id=_QUIZ_SEQ,
            question=question_text,
            options=options,
            correct_index=correct_index,
            explanation=f"Source: Test Catalog — {test.name} ({test.equipment_class.name})",
        ))

    return QuizGenerateResponse(questions=questions)


@router.post("/quiz/submit", response_model=QuizSubmitResponse)
def submit_quiz(request: QuizSubmitRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not request.question_ids or len(request.question_ids) != len(request.answers):
        raise HTTPException(400, "question_ids and answers must have the same non-zero length")

    score = 0
    results = []
    for qid, ans in zip(request.question_ids, request.answers):
        meta = _QUIZ_CACHE.get(qid)
        correct = meta["correct_index"] if meta else 0
        is_correct = ans == correct
        score += 1 if is_correct else 0
        results.append({
            "question_id": qid,
            "user_answer": ans,
            "correct_answer": correct,
            "correct": is_correct,
        })

    attempt = QuizAttempt(
        user_id=current_user.id,
        topic=request.topic or "general",
        score=score,
        total=len(request.answers),
    )
    db.add(attempt)
    db.commit()

    return QuizSubmitResponse(score=score, total=len(request.answers), results=results)
