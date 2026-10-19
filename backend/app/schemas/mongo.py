"""Pydantic models for the MongoDB documents (Days 3-4).

The repositories return raw Motor dictionaries; these models are the validated
view the API layer serializes. ``id`` is exposed under its normal field name
while still accepting MongoDB's ``_id`` alias, and BSON ``ObjectId`` values are
normalised to strings so the documents can be returned as JSON directly.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MongoDoc(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str = Field(alias="_id")

    @field_validator(
        "id", "conversation_id", "message_id", mode="before", check_fields=False
    )
    @classmethod
    def _object_id_to_str(cls, value: Any) -> Any:
        return str(value) if value is not None else value


class ConversationDoc(MongoDoc):
    """``conversations`` collection — header only, messages live separately."""

    sql_id: Optional[int] = None
    user_id: int
    title: Optional[str] = None
    mode: str = "qa"
    equipment: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @property
    def public_id(self) -> int | str:
        """The id the API keeps returning: the SQLite id when mirrored."""
        return self.sql_id if self.sql_id is not None else self.id


class MessageDoc(MongoDoc):
    """``messages`` collection — citations embedded with the message."""

    conversation_id: str
    sql_id: Optional[int] = None
    role: str
    content: str
    intent: Optional[str] = None
    entities: Optional[dict[str, Any]] = None
    citations: list[dict[str, Any]] = Field(default_factory=list)
    confidence: Optional[float] = None
    created_at: Optional[datetime] = None

    @property
    def public_id(self) -> int | str:
        return self.sql_id if self.sql_id is not None else self.id


class FeedbackDoc(MongoDoc):
    """``feedback`` collection — one vote per (message, user)."""

    message_id: str
    user_id: int
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None


class FaultLogDoc(MongoDoc):
    """``fault_logs`` collection — diagnosis history, no SQLite counterpart."""

    user_id: int
    equipment_class: str
    symptoms: list[str] = Field(default_factory=list)
    readings: dict[str, Any] = Field(default_factory=dict)
    diagnosis: Optional[str] = None
    resolution: Optional[str] = None
    logged_at: Optional[datetime] = None
