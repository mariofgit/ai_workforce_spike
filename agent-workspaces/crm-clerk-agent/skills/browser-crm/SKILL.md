---
name: browser-crm
description: Execute CRM contact writes via Playwright with deterministic checks, proof screenshot, and structured status output.
---

# Browser CRM Skill

## Steps
1. Login with injected credentials.
2. Search contact by email/phone.
3. Create or update with mapped fields.
4. Validate required fields.
5. Capture confirmation screenshot.
6. Return status payload.

## Failure handling
- Escalate when selectors fail, login fails, or required fields are missing.
