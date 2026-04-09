# AI-Native agent architecture (PoC)

This spike separates **Cognitive Blueprint** and **Runtime Engine** for the WSJ computer-use flow.

## Cognitive Blueprint (declarative)

- Capability contract: `wsj_session_start`, `wsj_session_complete`, `wsj_morning_shot`.
- Auth artifacts: `wsj_session_cookie` (PoC) and `oauth_access_token` (future path).
- Safety constraints projected to runtime:
  - egress allowlist
  - clipboard disabled
  - file transfer disabled
  - strict max session duration

## Runtime Engine (execution)

- `EphemeralVmProvider`: starts/stops ephemeral VM sessions and exposes user view URL.
- `SessionVault`: stores encrypted (PoC in-memory) auth artifact with TTL.
- Finance Analyst resolves `session_ref` and runs WSJ extraction with controlled session material.

## Why this split

- Keeps policy/safety explicit and versionable.
- Avoids coupling core analysis logic to a specific VM vendor.
- Supports migration from cookie-based PoC to delegated OAuth without changing endpoint semantics.
