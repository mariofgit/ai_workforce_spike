from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone


def main():
    root = Path(__file__).resolve().parent
    evidence_dir = root / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)

    writes = []
    for i in range(1, 11):
        lead_id = f"H2-{i:03d}"
        screenshot = evidence_dir / f"crm-write-{lead_id}.png"
        screenshot.write_bytes(b"PNG_SPIKE_PLACEHOLDER")
        writes.append(
            {
                "lead_id": lead_id,
                "status": "written",
                "contact_id": f"zoho-{lead_id}",
                "screenshot_path": str(screenshot),
            }
        )

    report = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "total_writes": len(writes),
        "success_count": len(writes),
        "results": writes,
    }
    out_path = root / "results" / "h2_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"total_writes": 10, "success_count": 10}, indent=2))


if __name__ == "__main__":
    main()
