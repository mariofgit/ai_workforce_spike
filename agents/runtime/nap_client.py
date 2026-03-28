from __future__ import annotations

import os
import httpx


class NapClient:
    def __init__(self, base_url: str | None = None, token: str | None = None):
        self.base_url = base_url or os.getenv("NAP_BASE_URL", "http://localhost:3000/api/nap")
        self.token = token or os.getenv("NAP_SERVICE_TOKEN", "dev-token")

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def post_inbox(self, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{self.base_url}/inbox", headers=self.headers, json=payload)
            return response.json()

    async def post_audit(self, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{self.base_url}/audit", headers=self.headers, json=payload)
            return response.json()
