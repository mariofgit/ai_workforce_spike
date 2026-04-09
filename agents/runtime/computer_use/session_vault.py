from __future__ import annotations

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from runtime.computer_use.models import AuthArtifact


def _xor_crypt(data: bytes, key: bytes) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < len(data):
        block = hashlib.blake2b(key + counter.to_bytes(8, "big"), digest_size=32).digest()
        out.extend(block)
        counter += 1
    return bytes(a ^ b for a, b in zip(data, out[: len(data)]))


@dataclass
class _VaultRow:
    session_ref: str
    client_key: str
    encrypted_payload: str
    created_at: datetime
    expires_at: datetime


class SessionVault:
    def __init__(self) -> None:
        self._rows: dict[str, _VaultRow] = {}
        raw_key = os.getenv("COMPUTER_USE_VAULT_KEY", "dev-insecure-session-vault-key")
        self._key = hashlib.sha256(raw_key.encode("utf-8")).digest()
        self._default_ttl_seconds = int(os.getenv("COMPUTER_USE_SESSION_TTL_SECONDS", "900"))

    def put(self, *, session_ref: str, client_key: str, artifact: AuthArtifact, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl_seconds
        created = datetime.now(timezone.utc)
        expires = created + timedelta(seconds=ttl)
        payload = artifact.model_dump(mode="json")
        plain = json.dumps(payload).encode("utf-8")
        crypt = _xor_crypt(plain, self._key)
        self._rows[session_ref] = _VaultRow(
            session_ref=session_ref,
            client_key=client_key,
            encrypted_payload=base64.b64encode(crypt).decode("ascii"),
            created_at=created,
            expires_at=expires,
        )

    def get(self, *, session_ref: str, client_key: str) -> AuthArtifact | None:
        row = self._rows.get(session_ref)
        if not row:
            return None
        if row.client_key != client_key:
            return None
        if datetime.now(timezone.utc) >= row.expires_at:
            self.invalidate(session_ref=session_ref)
            return None
        crypt = base64.b64decode(row.encrypted_payload.encode("ascii"))
        plain = _xor_crypt(crypt, self._key)
        data = json.loads(plain.decode("utf-8"))
        return AuthArtifact.model_validate(data)

    def invalidate(self, *, session_ref: str) -> None:
        self._rows.pop(session_ref, None)

    def status(self, *, session_ref: str, client_key: str) -> dict:
        row = self._rows.get(session_ref)
        if not row or row.client_key != client_key:
            return {"ok": False, "state": "missing"}
        now = datetime.now(timezone.utc)
        if now >= row.expires_at:
            self.invalidate(session_ref=session_ref)
            return {"ok": False, "state": "expired"}
        return {
            "ok": True,
            "state": "ready",
            "expires_at": row.expires_at.isoformat(),
            "created_at": row.created_at.isoformat(),
        }
