from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Protocol

from runtime.computer_use.models import SessionPolicy, WsjSessionHandle
from runtime.computer_use.policy import policy_projection


class ComputerUseSessionProvider(Protocol):
    def start(self, *, client_key: str, session_ref: str, policy: SessionPolicy) -> WsjSessionHandle: ...
    def heartbeat(self, *, session_ref: str) -> dict: ...
    def stop(self, *, session_ref: str) -> None: ...


class EphemeralVmProvider:
    """PoC provider contract for mini-VM ephemeral sessions."""

    def __init__(self) -> None:
        self._state: dict[str, WsjSessionHandle] = {}
        self._base = os.getenv("COMPUTER_USE_VM_VIEW_BASE_URL", "https://vm-gateway.invalid/session")

    def start(self, *, client_key: str, session_ref: str, policy: SessionPolicy) -> WsjSessionHandle:
        vm_id = f"vm-{uuid.uuid4()}"
        _ = policy_projection(policy)
        handle = WsjSessionHandle(
            session_ref=session_ref,
            client_key=client_key,
            vm_session_id=vm_id,
            vm_view_url=f"{self._base.rstrip('/')}/{vm_id}",
            state="waiting_user_login",
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=policy.max_duration_seconds),
        )
        self._state[session_ref] = handle
        return handle

    def heartbeat(self, *, session_ref: str) -> dict:
        h = self._state.get(session_ref)
        if not h:
            return {"ok": False, "state": "missing"}
        if datetime.now(timezone.utc) >= h.expires_at:
            h.state = "expired"
            return {"ok": False, "state": "expired", "expires_at": h.expires_at.isoformat()}
        return {"ok": True, "state": h.state, "expires_at": h.expires_at.isoformat(), "vm_view_url": h.vm_view_url}

    def stop(self, *, session_ref: str) -> None:
        h = self._state.get(session_ref)
        if h:
            h.state = "closed"
