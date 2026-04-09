from __future__ import annotations

from runtime.computer_use.models import SessionPolicy


def default_session_policy() -> SessionPolicy:
    return SessionPolicy()


def policy_projection(policy: SessionPolicy) -> dict:
    """Constraint projection used by runtime providers."""
    return {
        "egress_allowlist": policy.egress_allowlist,
        "clipboard_enabled": policy.clipboard_enabled,
        "file_transfer_enabled": policy.file_transfer_enabled,
        "max_duration_seconds": policy.max_duration_seconds,
    }
