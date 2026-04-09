from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field

AuthArtifactKind = Literal["wsj_session_cookie", "oauth_access_token"]
ComputerUseSessionState = Literal["created", "waiting_user_login", "ready", "expired", "closed"]


class SessionPolicy(BaseModel):
    egress_allowlist: list[str] = Field(default_factory=lambda: ["www.wsj.com", "wsj.com", "accounts.wsj.com"])
    clipboard_enabled: bool = False
    file_transfer_enabled: bool = False
    max_duration_seconds: int = 900


class AuthArtifact(BaseModel):
    kind: AuthArtifactKind
    value: str
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime | None = None
    scope: str = "wsj:morning-shot"


class WsjSessionHandle(BaseModel):
    session_ref: str
    client_key: str
    vm_session_id: str
    vm_view_url: str
    state: ComputerUseSessionState = "created"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(minutes=15))
    auth_kind: AuthArtifactKind = "wsj_session_cookie"
