from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Single source of truth for roles (Day 7): the ORM enum and the API schema
# used to declare separate USER/ADMIN enums that silently drifted apart.
from app.db.models import UserRole  # noqa: E402


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str


class RefreshRequest(BaseModel):
    """Body of POST /api/auth/refresh — the cookie flow needs no body."""

    refresh_token: str


class LogoutRequest(BaseModel):
    """Body of POST /api/auth/logout — omit to revoke every refresh token."""

    refresh_token: Optional[str] = None


# Small deny-list of passwords that satisfy the letter+digit rule but are
# guessed first by every credential-stuffing tool.
COMMON_PASSWORDS = frozenset(
    {
        "password1", "password12", "password123", "passw0rd1", "qwerty123",
        "qwerty1234", "abc12345", "abcd1234", "iloveyou1", "welcome1",
        "welcome123", "admin123", "admin1234", "letmein123", "12345678a",
        "a1234567", "1q2w3e4r", "test1234", "changeme1",
    }
)


def _norm_email(value: str) -> str:
    return value.strip().lower()


def check_password_policy(v: str) -> str:
    """Shared password rules for register, reset and change (AUTH_TRD §6).

    The 72-byte cap stays while any bcrypt row can still exist; it can be
    lifted once every stored hash is argon2id.
    """
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes long")
    if not v.strip():
        raise ValueError("Password must not be blank")
    if not (any(c.isalpha() for c in v) and any(c.isdigit() for c in v)):
        raise ValueError("Password must contain at least one letter and one digit")
    if v.lower() in COMMON_PASSWORDS:
        raise ValueError("That password is too common; choose another")
    return v


class UserCreate(BaseModel):
    """Registration input. Every rule here is also enforced by the tests."""

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    # bcrypt silently ignores everything after byte 72, so we cap in *bytes*
    # (the character cap alone would let 80 multi-byte characters through).
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Name must not be blank")
        return v

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return _norm_email(v)

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return check_password_policy(v)


class UserLogin(BaseModel):
    """Login input: normalised email, but no password policy (old accounts)."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return _norm_email(v)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    created_at: datetime
    # NULL until the verification link is clicked; lets the SPA show the
    # "check your e-mail" state and the account page show verification status.
    email_verified_at: Optional[datetime] = None
    # Set once TOTP is enabled; the account page shows the current state.
    totp_enabled: bool = False

    class Config:
        from_attributes = True


class VerifyEmailIn(BaseModel):
    """POST /api/auth/verify-email — token comes from the e-mail link."""

    token: str = Field(min_length=1, max_length=200)


class ResendVerificationIn(BaseModel):
    """POST /api/auth/resend-verification — always answered 202."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return _norm_email(v)


class ForgotPasswordIn(BaseModel):
    """POST /api/auth/password/forgot — always answered 202."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return _norm_email(v)


class PasswordResetIn(BaseModel):
    """POST /api/auth/password/reset — single-use token from the e-mail."""

    token: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _policy(cls, v: str) -> str:
        return check_password_policy(v)


class PasswordChangeIn(BaseModel):
    """POST /api/auth/password/change — re-authentication required.

    ``refresh_token`` is the caller's own current session token: it survives
    the revoke-others sweep so the session that changed the password keeps
    working (A-09). Omitted → every session is revoked.
    """

    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=8, max_length=128)
    refresh_token: Optional[str] = Field(default=None, max_length=300)

    @field_validator("new_password")
    @classmethod
    def _policy(cls, v: str) -> str:
        return check_password_policy(v)


class MfaEnableIn(BaseModel):
    """POST /api/auth/mfa/enable — first valid TOTP code confirms enrolment."""

    code: str = Field(min_length=6, max_length=32)


class MfaDisableIn(BaseModel):
    """POST /api/auth/mfa/disable — password re-auth + TOTP or recovery code."""

    password: str = Field(min_length=1, max_length=1024)
    code: str = Field(min_length=6, max_length=32)


class MfaVerifyIn(BaseModel):
    """POST /api/auth/mfa/verify — finish a login that stopped at the
    second factor: purpose-bound mfa_token + TOTP or recovery code."""

    mfa_token: str = Field(min_length=1, max_length=2000)
    code: str = Field(min_length=6, max_length=32)


class EquipmentClassResponse(BaseModel):
    id: int
    name: str
    aliases: List[str]
    description: Optional[str]

    class Config:
        from_attributes = True


class TestResponse(BaseModel):
    id: int
    name: str
    aliases: List[str]
    category: Optional[str]
    purpose: Optional[str]
    summary: Optional[str]

    class Config:
        from_attributes = True


class TestDetailResponse(TestResponse):
    steps: List[Dict[str, Any]] = []
    equipment: List[Dict[str, Any]] = []
    limits: List[Dict[str, Any]] = []
    standards: List[Dict[str, Any]] = []
    safety: List[Dict[str, Any]] = []
    troubleshooting: List[Dict[str, Any]] = []


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    equipment: Optional[str] = None
    mode: str = "qa"


class ChatResponse(BaseModel):
    intent: str
    equipment: Optional[str]
    test: Optional[str]
    answer: str
    sections: Dict[str, str]
    citations: List[Dict[str, Any]]
    confidence: float
    source_type: str
    conversation_id: int
    message_id: Optional[int] = None


class SSEEvent(BaseModel):
    type: str
    data: Dict[str, Any]


class DocumentUpload(BaseModel):
    title: str
    doc_type: Optional[str] = None
    equipment_class_id: Optional[int] = None
    standard_id: Optional[int] = None


class DocumentResponse(BaseModel):
    id: int
    title: str
    filename: str
    doc_type: Optional[str]
    equipment_class_id: Optional[int]
    status: DocumentStatus
    page_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProcedureStartRequest(BaseModel):
    test_id: int


class ProcedureStepUpdate(BaseModel):
    step_no: int
    done: bool
    flagged: bool = False
    note: Optional[str] = None


class ProcedureCompleteRequest(BaseModel):
    notes: Optional[str] = None


class ProcedureRunResponse(BaseModel):
    id: int
    test_id: int
    steps_state: Dict[str, Any]
    notes: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class CheckResultRequest(BaseModel):
    test_id: int
    parameter: str
    measured_value: float
    unit: str
    condition_note: Optional[str] = None


class CheckResultResponse(BaseModel):
    status: str
    limit_value: str
    source: str
    troubleshooting: List[Dict[str, Any]] = []


class DiagnosisRequest(BaseModel):
    equipment_class_id: int
    symptoms: str
    readings: Optional[Dict[str, Any]] = None


class DiagnosisCause(BaseModel):
    cause: str
    likelihood: float
    recommended_checks: List[str]
    sources: List[Dict[str, Any]]


class DiagnosisResponse(BaseModel):
    causes: List[DiagnosisCause]


class FeedbackRequest(BaseModel):
    message_id: int
    rating: int
    comment: Optional[str] = None


class FeedbackBody(BaseModel):
    """Body of POST /messages/{id}/feedback — the id travels in the path."""

    rating: int
    comment: Optional[str] = None


class QuizGenerateRequest(BaseModel):
    topic: str
    count: int = 5


class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_index: int
    explanation: str


class QuizGenerateResponse(BaseModel):
    questions: List[QuizQuestion]


class QuizSubmitRequest(BaseModel):
    topic: Optional[str] = None
    question_ids: List[int]
    answers: List[int]


class QuizSubmitResponse(BaseModel):
    score: int
    total: int
    results: List[Dict[str, Any]]


class AnalyticsResponse(BaseModel):
    total_queries: int
    avg_rating: float
    unanswered_rate: float
    top_questions: List[Dict[str, Any]]
    unanswered_queries: List[Dict[str, Any]]


from app.schemas.mongo import (  # noqa: E402,F401
    ConversationDoc,
    MessageDoc,
    FeedbackDoc,
    FaultLogDoc,
)
