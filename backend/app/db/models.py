from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Float,
    JSON,
    Enum as SQLEnum,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.db.session import Base


class UserRole(str, enum.Enum):
    TRAINEE = "trainee"
    ENGINEER = "engineer"
    ADMIN = "admin"


class DocumentStatus(str, enum.Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ConversationMode(str, enum.Enum):
    QA = "qa"
    PROCEDURE = "procedure"
    DIAGNOSIS = "diagnosis"
    LEARN = "learn"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.TRAINEE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # AUTH_TRD §4 / Day 4: NULL until the e-mail link is clicked. The login
    # gate (REQUIRE_EMAIL_VERIFICATION) rejects NULL at login/refresh/me.
    email_verified_at = Column(DateTime, nullable=True)
    # AUTH_TRD §4 / Day 5: stamped on reset/change; NULL for rows that have
    # never changed their password since the column existed.
    password_changed_at = Column(DateTime, nullable=True)
    # AUTH_TRD §4 / Day 7: TOTP two-factor. The shared secret is stored
    # Fernet-encrypted (TOTP_ENCRYPTION_KEY); ``totp_enabled`` only flips
    # after the first code is confirmed. ``totp_last_timestep`` makes each
    # code single-use (A-06 replay rejection).
    totp_secret_enc = Column(Text, nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=True)
    totp_last_timestep = Column(Integer, nullable=True)

    conversations = relationship("Conversation", back_populates="user")
    feedback = relationship("Feedback", back_populates="user")
    procedure_runs = relationship("ProcedureRun", back_populates="user")
    quiz_attempts = relationship("QuizAttempt", back_populates="user")


class EquipmentClass(Base):
    __tablename__ = "equipment_classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    aliases = Column(JSON, default=list)
    description = Column(Text)

    tests = relationship("Test", back_populates="equipment_class")
    safety_precautions = relationship(
        "SafetyPrecaution", back_populates="equipment_class"
    )


class Test(Base):
    __tablename__ = "tests"
    id = Column(Integer, primary_key=True, index=True)
    equipment_class_id = Column(
        Integer, ForeignKey("equipment_classes.id"), nullable=False
    )
    name = Column(String(200), nullable=False)
    aliases = Column(JSON, default=list)
    category = Column(String(50))  # routine, diagnostic, commissioning
    purpose = Column(Text)
    frequency_note = Column(Text)
    summary = Column(Text)

    equipment_class = relationship("EquipmentClass", back_populates="tests")
    steps = relationship("TestStep", back_populates="test", order_by="TestStep.step_no")
    equipment = relationship("TestEquipment", back_populates="test")
    limits = relationship("TestLimit", back_populates="test")
    standards = relationship("TestStandard", back_populates="test")
    safety_precautions = relationship("SafetyPrecaution", back_populates="test")
    troubleshooting = relationship("Troubleshooting", back_populates="test")


class TestStep(Base):
    __tablename__ = "test_steps"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    step_no = Column(Integer, nullable=False)
    step_type = Column(String(20))  # safety, prep, action, record
    text = Column(Text, nullable=False)
    source_id = Column(Integer, ForeignKey("sources.id"))

    test = relationship("Test", back_populates="steps")
    source = relationship("Source")


class TestEquipment(Base):
    __tablename__ = "test_equipment"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    instrument_name = Column(String(200), nullable=False)
    spec_note = Column(Text)
    source_id = Column(Integer, ForeignKey("sources.id"))

    test = relationship("Test", back_populates="equipment")
    source = relationship("Source")


class TestLimit(Base):
    __tablename__ = "test_limits"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    parameter = Column(String(100), nullable=False)
    value_text = Column(Text, nullable=False)
    min_val = Column(Float)
    max_val = Column(Float)
    unit = Column(String(50))
    condition_note = Column(Text)
    standard_id = Column(Integer, ForeignKey("standards.id"))
    source_id = Column(Integer, ForeignKey("sources.id"))
    verified_by = Column(String(100))
    verified_on = Column(DateTime)

    test = relationship("Test", back_populates="limits")
    standard = relationship("Standard")
    source = relationship("Source")


class Standard(Base):
    __tablename__ = "standards"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    title = Column(String(300), nullable=False)
    body = Column(
        SQLEnum("IEC", "IEEE", "IS", "CBIP", "CEA", "OEM", name="standard_body")
    )
    scope_note = Column(Text)

    test_links = relationship("TestStandard", back_populates="standard")


class TestStandard(Base):
    __tablename__ = "test_standards"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)
    clause_note = Column(Text)

    test = relationship("Test", back_populates="standards")
    standard = relationship("Standard", back_populates="test_links")


class SafetyPrecaution(Base):
    __tablename__ = "safety_precautions"
    id = Column(Integer, primary_key=True, index=True)
    scope = Column(
        SQLEnum("general", "equipment", "test", name="safety_scope")
    )
    equipment_class_id = Column(
        Integer, ForeignKey("equipment_classes.id"), nullable=True
    )
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True)
    text = Column(Text, nullable=False)
    mandatory = Column(Boolean, default=True)
    source_id = Column(Integer, ForeignKey("sources.id"))

    equipment_class = relationship(
        "EquipmentClass", back_populates="safety_precautions"
    )
    test = relationship("Test", back_populates="safety_precautions")
    source = relationship("Source")


class Troubleshooting(Base):
    __tablename__ = "troubleshooting"
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    symptom = Column(Text, nullable=False)
    probable_cause = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    source_id = Column(Integer, ForeignKey("sources.id"))

    test = relationship("Test", back_populates="troubleshooting")
    source = relationship("Source")


class Source(Base):
    __tablename__ = "sources"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    page = Column(Integer)
    section = Column(String(200))
    url_or_ref = Column(Text)

    document_ref = relationship("Document", back_populates="sources")


class Synonym(Base):
    __tablename__ = "synonyms"
    id = Column(Integer, primary_key=True, index=True)
    canonical = Column(String(200), nullable=False, index=True)
    variant = Column(String(200), nullable=False, index=True)
    kind = Column(
        SQLEnum(
            "test", "equipment", "parameter", "abbreviation", name="synonym_kind"
        )
    )

    __table_args__ = (
        UniqueConstraint("canonical", "variant", "kind", name="uq_synonym"),
    )


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    filename = Column(String(300), nullable=False)
    doc_type = Column(String(50))
    equipment_class_id = Column(Integer, ForeignKey("equipment_classes.id"))
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=True)
    version = Column(String(50))
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.PROCESSING)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    page_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    equipment_class = relationship("EquipmentClass")
    standard = relationship("Standard")
    uploader = relationship("User")
    chunks = relationship(
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )
    sources = relationship(
        "Source", back_populates="document_ref", cascade="all, delete-orphan"
    )


class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    page_start = Column(Integer)
    page_end = Column(Integer)
    section_title = Column(String(300))
    text = Column(Text, nullable=False)
    equipment_class_id = Column(Integer, ForeignKey("equipment_classes.id"))
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=True)
    chunk_index = Column(Integer)
    token_count = Column(Integer)

    document = relationship("Document", back_populates="chunks")
    equipment_class = relationship("EquipmentClass")
    test = relationship("Test")


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(300))
    mode = Column(SQLEnum(ConversationMode), default=ConversationMode.QA)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at",
        cascade="all, delete-orphan",
    )


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20))  # user, assistant
    content = Column(Text, nullable=False)
    intent = Column(String(50))
    entities_json = Column(JSON)
    citations_json = Column(JSON)
    confidence = Column(Float)
    latency_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    feedback = relationship(
        "Feedback", back_populates="message", cascade="all, delete-orphan"
    )


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer)  # 1 or -1
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="feedback")
    user = relationship("User", back_populates="feedback")


class ProcedureRun(Base):
    __tablename__ = "procedure_runs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    steps_state_json = Column(JSON, nullable=False)
    notes = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="procedure_runs")
    test = relationship("Test")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(200))
    score = Column(Integer)
    total = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_attempts")


class UnansweredQuery(Base):
    __tablename__ = "unanswered_queries"
    id = Column(Integer, primary_key=True, index=True)
    query = Column(Text, nullable=False)
    intent = Column(String(50))
    top_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class RefreshToken(Base):
    """Server-side refresh-token store (Day 6 A).

    Only the SHA-256 of the opaque token is kept, so a leaked row cannot be
    replayed; rotation is recorded through ``used_at`` and logout through
    ``revoked_at``. All rotations of one login share a ``family_id`` (one
    browser device), which powers the sessions list and per-device revoke
    (AUTH_TRD Day 6).
    """

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    family_id = Column(String(32), index=True, nullable=True)  # 32 hex chars
    user_agent = Column(String(200), nullable=True)
    ip = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User")


class AuthEvent(Base):
    """Append-only security audit log (AUTH_TRD §4, threat T14).

    Every security-relevant event gets exactly one row. The code base never
    UPDATEs or DELETEs this table; retention is handled by ops (export +
    truncate), not by application code.
    """

    __tablename__ = "auth_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    event = Column(String(40), nullable=False, index=True)
    ip = Column(String(45))
    user_agent = Column(String(200))
    detail = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class OneTimeToken(Base):
    """Single-use token for e-mail verification and password reset
    (AUTH_TRD §4). Only the SHA-256 of the raw token is stored, so a leaked
    row cannot be replayed; ``used_at`` is set in the same transaction that
    applies the change the token authorises (§6).
    """

    __tablename__ = "one_time_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    purpose = Column(String(32), nullable=False)  # verify_email | reset_password
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class RecoveryCode(Base):
    """One-time MFA fallback codes (AUTH_TRD §4 / Day 7).

    Ten codes per MFA enablement; only the SHA-256 of the normalised code is
    stored, and ``used_at`` makes each code single-use (A-07).
    """

    __tablename__ = "recovery_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    code_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    user = relationship("User")


Index("ix_chunks_embedding_id", "chunks.id")  # placeholder for vector index reference
