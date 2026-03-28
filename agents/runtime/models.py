from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal, Optional


class LeadMessage(BaseModel):
    lead_id: str
    text: str
    channel: Literal["whatsapp"] = "whatsapp"
    client_key: str = "demo-client"


class EscalationPayload(BaseModel):
    clientKey: str
    sourceAgentType: str
    category: str = "escalation"
    summary: str
    question: str
    urgency: Literal["low", "medium", "high"] = "medium"
    payload: dict = Field(default_factory=dict)


class CrmWriteRequest(BaseModel):
    client_key: str
    lead_id: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: str = ""
    correlation_id: Optional[str] = None


class CrmWriteResult(BaseModel):
    ok: bool
    status: str
    contact_id: Optional[str] = None
    screenshot_path: Optional[str] = None
    detail: Optional[str] = None
