---
name: escalate
description: Escalate a conversation to NAP inbox with actionable context and a specific human decision request.
---

# Escalation Skill

## Required payload
- `summary`: what happened so far
- `question`: exact decision needed from human
- `urgency`: low, medium, high
- `context`: lead metadata and recent messages

## Quality checklist
- Human can act in under 60 seconds.
- No vague "please review" escalations.
