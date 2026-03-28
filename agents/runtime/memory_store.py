from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone


class LeadMemoryStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, lead_id: str) -> Path:
        return self.root / f"{lead_id}.json"

    def load(self, lead_id: str) -> dict:
        path = self._path(lead_id)
        if not path.exists():
            return {"lead_id": lead_id, "facts": {}, "open_loops": [], "history": []}
        return json.loads(path.read_text(encoding="utf-8"))

    def append(self, lead_id: str, entry: dict) -> dict:
        data = self.load(lead_id)
        data["history"].append({
            "ts": datetime.now(timezone.utc).isoformat(),
            **entry,
        })
        self._path(lead_id).write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data
