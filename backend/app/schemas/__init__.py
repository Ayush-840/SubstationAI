from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


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