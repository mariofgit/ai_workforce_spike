from __future__ import annotations

import json
from pathlib import Path


def needs_escalation(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in ["frustrat", "angry", "refund", "legal", "guarantee", "complaint", "contract"])


def escalation_quality(text: str) -> int:
    score = 0
    if len(text) > 20:
        score += 1
    if "?" in text:
        score += 1
    if any(k in text.lower() for k in ["urgent", "legal", "refund", "complaint"]):
        score += 1
    return score


def main():
    root = Path(__file__).resolve().parent
    inputs = json.loads((root / "h1_synthetic_messages.json").read_text(encoding="utf-8"))
    results = []
    autonomous = 0
    escalated = 0
    quality_total = 0

    for item in inputs:
        esc = needs_escalation(item["text"])
        if esc:
            escalated += 1
            q = escalation_quality(item["text"])
            quality_total += q
            status = "escalated"
        else:
            autonomous += 1
            q = None
            status = "autonomous"

        results.append({**item, "status": status, "escalation_quality": q})

    avg_quality = round(quality_total / escalated, 2) if escalated else 0.0
    summary = {
        "total": len(inputs),
        "autonomous_count": autonomous,
        "autonomous_rate": round(autonomous / len(inputs), 2),
        "escalated_count": escalated,
        "escalated_rate": round(escalated / len(inputs), 2),
        "avg_escalation_quality_0_3": avg_quality,
    }
    out = {"summary": summary, "results": results}
    out_path = root / "results" / "h1_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
