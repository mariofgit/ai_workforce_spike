from __future__ import annotations

from pathlib import Path
import os
import uuid
import httpx
from fastapi import FastAPI

from runtime.memory_store import LeadMemoryStore
from runtime.models import LeadMessage, EscalationPayload, CrmWriteRequest
from runtime.nap_client import NapClient

app = FastAPI(title="Neuforce SDR Agent")
memory = LeadMemoryStore(Path(__file__).resolve().parents[2] / "agent-workspaces" / "sdr-agent" / "memory")
nap = NapClient()
CRM_MCP_URL = os.getenv("CRM_MCP_URL", "http://localhost:8011/mcp/write-contact")


def _needs_escalation(text: str) -> bool:
    t = text.lower()
    markers = ["complaint", "angry", "frustrated", "refund", "legal", "contract", "guarantee"]
    return any(marker in t for marker in markers)


@app.get("/health")
async def health():
    return {"ok": True, "agent": "sdr"}


@app.post("/lead-message")
async def lead_message(payload: LeadMessage):
    correlation_id = str(uuid.uuid4())
    text = payload.text.strip()
    memory.append(payload.lead_id, {"type": "inbound", "text": text})

    if _needs_escalation(text):
        escalation = EscalationPayload(
            clientKey=payload.client_key,
            sourceAgentType="sdr",
            summary=f"Lead {payload.lead_id} requires human review due to risk signal.",
            question="How should we respond while preserving trust and scope?",
            urgency="high",
            payload={"lead_id": payload.lead_id, "message": text},
        )
        await nap.post_inbox(escalation.model_dump())
        await nap.post_audit(
            {
                "clientKey": payload.client_key,
                "agentType": "sdr",
                "eventType": "escalation_created",
                "correlationId": correlation_id,
                "inputPayload": payload.model_dump(),
                "outputPayload": escalation.model_dump(),
                "tokenIn": len(text.split()),
                "tokenOut": 30,
            }
        )
        return {"handled": False, "status": "escalated", "correlation_id": correlation_id}

    mcp_request = CrmWriteRequest(
        client_key=payload.client_key,
        lead_id=payload.lead_id,
        full_name=f"Lead {payload.lead_id}",
        notes=text,
        correlation_id=correlation_id,
    )

    async with httpx.AsyncClient(timeout=20) as client:
        crm_response = await client.post(CRM_MCP_URL, json=mcp_request.model_dump())
        crm_json = crm_response.json()

    await nap.post_audit(
        {
            "clientKey": payload.client_key,
            "agentType": "sdr",
            "eventType": "lead_handled",
            "correlationId": correlation_id,
            "inputPayload": payload.model_dump(),
            "outputPayload": crm_json,
            "tokenIn": len(text.split()),
            "tokenOut": 45,
            "actionCount": 2,
        }
    )

    memory.append(payload.lead_id, {"type": "outbound", "status": "handled", "crm": crm_json})
    return {"handled": True, "status": "responded", "crm": crm_json, "correlation_id": correlation_id}
