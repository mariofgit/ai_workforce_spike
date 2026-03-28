from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from pathlib import Path
import os
import time
import httpx
from fastapi import FastAPI

from runtime.models import CrmWriteRequest, CrmWriteResult

app = FastAPI(title="Neuforce CRM Clerk Agent")
EVIDENCE_DIR = Path(__file__).resolve().parents[2] / "tests" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
ACTIVITY_LOG = deque(maxlen=50)
ZOHO_TOKEN_CACHE: dict[str, str | float] = {"access_token": "", "api_domain": "", "expires_at": 0.0}


@app.get("/health")
async def health():
    return {"ok": True, "agent": "crm-clerk"}


@app.get("/activity")
async def activity():
    return {"ok": True, "events": list(ACTIVITY_LOG)}


def _zoho_required_env() -> dict[str, str]:
    keys = [
        "ZOHO_CLIENT_ID",
        "ZOHO_CLIENT_SECRET",
        "ZOHO_REFRESH_TOKEN",
        "ZOHO_ACCOUNTS_URL",
        "ZOHO_API_DOMAIN",
    ]
    return {k: os.getenv(k, "").strip() for k in keys}


def _zoho_enabled() -> bool:
    values = _zoho_required_env()
    return all(values.values())


def _split_name(full_name: str) -> tuple[str, str]:
    parts = [p for p in full_name.strip().split(" ") if p]
    if not parts:
        return "", "Unknown"
    if len(parts) == 1:
        return "", parts[0]
    return " ".join(parts[:-1]), parts[-1]


def _zoho_field(name: str, default: str) -> str:
    return os.getenv(name, default).strip() or default


def _build_zoho_record(request: CrmWriteRequest) -> dict:
    first_name, last_name = _split_name(request.full_name)
    f_first = _zoho_field("ZOHO_FIELD_FIRST_NAME", "First_Name")
    f_last = _zoho_field("ZOHO_FIELD_LAST_NAME", "Last_Name")
    f_email = _zoho_field("ZOHO_FIELD_EMAIL", "Email")
    f_phone = _zoho_field("ZOHO_FIELD_PHONE", "Phone")
    f_notes = _zoho_field("ZOHO_FIELD_NOTES", "Description")
    f_lead_id = os.getenv("ZOHO_FIELD_LEAD_ID", "").strip()

    record: dict[str, str] = {f_last: last_name, f_notes: request.notes}
    if first_name:
        record[f_first] = first_name
    if request.email:
        record[f_email] = request.email
    if request.phone:
        record[f_phone] = request.phone
    # Optional custom field; include only when explicitly configured in env.
    if f_lead_id and request.lead_id:
        record[f_lead_id] = request.lead_id
    return record


async def _zoho_get_access_token(client: httpx.AsyncClient) -> tuple[str, str]:
    now = time.time()
    cached = ZOHO_TOKEN_CACHE.get("access_token", "")
    expires_at = float(ZOHO_TOKEN_CACHE.get("expires_at", 0.0))
    api_domain_cached = str(ZOHO_TOKEN_CACHE.get("api_domain", ""))
    if isinstance(cached, str) and cached and now < (expires_at - 60):
        return cached, api_domain_cached

    env = _zoho_required_env()
    token_url = f"{env['ZOHO_ACCOUNTS_URL'].rstrip('/')}/oauth/v2/token"
    response = await client.post(
        token_url,
        data={
            "grant_type": "refresh_token",
            "client_id": env["ZOHO_CLIENT_ID"],
            "client_secret": env["ZOHO_CLIENT_SECRET"],
            "refresh_token": env["ZOHO_REFRESH_TOKEN"],
        },
    )
    response.raise_for_status()
    data = response.json()
    access_token = str(data.get("access_token", "")).strip()
    if not access_token:
        raise RuntimeError(f"Zoho token response missing access_token: {data}")
    expires_in = int(data.get("expires_in", 3600))
    api_domain = str(data.get("api_domain") or env["ZOHO_API_DOMAIN"]).strip()
    ZOHO_TOKEN_CACHE["access_token"] = access_token
    ZOHO_TOKEN_CACHE["api_domain"] = api_domain
    ZOHO_TOKEN_CACHE["expires_at"] = now + max(expires_in, 60)
    return access_token, api_domain


async def _write_contact_to_zoho(request: CrmWriteRequest) -> tuple[CrmWriteResult, dict]:
    module = os.getenv("ZOHO_CRM_CONTACTS_MODULE", "Contacts").strip() or "Contacts"
    payload = {"data": [_build_zoho_record(request)]}

    async with httpx.AsyncClient(timeout=20) as client:
        access_token, api_domain = await _zoho_get_access_token(client)
        url = f"{api_domain.rstrip('/')}/crm/v8/{module}"
        headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
        response = await client.post(url, headers=headers, json=payload)

        # Retry once on token expiry/invalid token.
        if response.status_code in (400, 401):
            ZOHO_TOKEN_CACHE["access_token"] = ""
            access_token, api_domain = await _zoho_get_access_token(client)
            headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
            url = f"{api_domain.rstrip('/')}/crm/v8/{module}"
            response = await client.post(url, headers=headers, json=payload)

        if response.status_code >= 400:
            err_text = response.text.strip()
            raise RuntimeError(f"Zoho HTTP {response.status_code}: {err_text}")

        body = response.json()
        row = (body.get("data") or [{}])[0]
        status = str(row.get("status", "")).lower()
        details = row.get("details") or {}
        zoho_id = details.get("id")
        message = row.get("message") or "Zoho CRM create response"
        zoho_log = {
            "http_status": response.status_code,
            "status": row.get("status"),
            "code": row.get("code"),
            "message": message,
            "details": details,
        }

        if status != "success":
            return (
                CrmWriteResult(ok=False, status="escalated", detail=f"Zoho write failed: {message}"),
                zoho_log,
            )

        return (
            CrmWriteResult(
                ok=True,
                status="written",
                contact_id=str(zoho_id) if zoho_id else None,
                detail=f"Zoho CRM write completed: {message}",
            ),
            zoho_log,
        )


@app.post("/mcp/write-contact", response_model=CrmWriteResult)
async def write_contact(request: CrmWriteRequest):
    # Spike-mode browser execution simulation with deterministic evidence artifact.
    screenshot_path = EVIDENCE_DIR / f"crm-write-{request.lead_id}.png"
    if not screenshot_path.exists():
        screenshot_path.write_bytes(b"PNG_SPIKE_PLACEHOLDER")

    if not request.full_name.strip():
        result = CrmWriteResult(ok=False, status="escalated", detail="required field full_name missing")
        ACTIVITY_LOG.appendleft(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "lead_id": request.lead_id,
                "correlation_id": request.correlation_id,
                "request": request.model_dump(),
                "response": result.model_dump(),
            }
        )
        return result

    # If OAuth env vars are configured, write to Zoho API; otherwise keep deterministic spike mock.
    zoho_log: dict | None = None
    if _zoho_enabled():
        try:
            result, zoho_log = await _write_contact_to_zoho(request)
            result.screenshot_path = str(screenshot_path)
        except Exception as e:  # noqa: BLE001
            result = CrmWriteResult(
                ok=False,
                status="escalated",
                screenshot_path=str(screenshot_path),
                detail=f"Zoho CRM write error: {e}",
            )
            zoho_log = {"error": str(e)}
    else:
        result = CrmWriteResult(
            ok=True,
            status="written",
            contact_id=f"zoho-{request.lead_id}",
            screenshot_path=str(screenshot_path),
            detail="Contact upsert completed (spike mock; Zoho OAuth not configured)",
        )
        zoho_log = {"mode": "mock"}
    ACTIVITY_LOG.appendleft(
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "lead_id": request.lead_id,
            "correlation_id": request.correlation_id,
            "request": request.model_dump(),
            "response": result.model_dump(),
            "zoho_response": zoho_log,
        }
    )
    return result
