from __future__ import annotations

from datetime import datetime, timedelta, timezone

from runtime.computer_use.models import AuthArtifact, SessionPolicy
from runtime.computer_use.provider import EphemeralVmProvider
from runtime.computer_use.session_vault import SessionVault


def test_vm_provider_start_and_heartbeat() -> None:
    provider = EphemeralVmProvider()
    handle = provider.start(client_key="demo-client", session_ref="s-1", policy=SessionPolicy(max_duration_seconds=120))
    hb = provider.heartbeat(session_ref="s-1")
    assert handle.state == "waiting_user_login"
    assert hb["ok"] is True
    assert "vm_view_url" in hb


def test_vault_put_get_and_invalidate() -> None:
    vault = SessionVault()
    artifact = AuthArtifact(kind="wsj_session_cookie", value="wsj=test-cookie")
    vault.put(session_ref="s-2", client_key="demo-client", artifact=artifact, ttl_seconds=60)
    loaded = vault.get(session_ref="s-2", client_key="demo-client")
    assert loaded is not None
    assert loaded.kind == "wsj_session_cookie"
    vault.invalidate(session_ref="s-2")
    assert vault.get(session_ref="s-2", client_key="demo-client") is None


def test_vault_expiration() -> None:
    vault = SessionVault()
    artifact = AuthArtifact(kind="wsj_session_cookie", value="wsj=expired")
    vault.put(session_ref="s-3", client_key="demo-client", artifact=artifact, ttl_seconds=1)
    # simulate expiration by forcing row expiry in-memory for deterministic test
    row = vault._rows["s-3"]  # type: ignore[attr-defined]
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert vault.get(session_ref="s-3", client_key="demo-client") is None
