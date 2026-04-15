# AI-native agent architecture (PoC)

This spike separates **declared behavior** from **runtime execution** for the WSJ morning-shot flow.

## Declarative surface

- Primary Finance endpoint: `POST /wsj-morning-shot`.
- States returned to NAP:
  - **Success** — structured summary + facts pack.
  - **`REQUIRES_AUTH`** — Browserbase Live View URL + `browserbase_session_id` for human login at WSJ.
- Optional legacy: `WSJ_SESSION_COOKIE` for HTTP-only fetch when `BROWSERBASE_API_KEY` is unset.

## Runtime (Finance)

- **Browserbase SDK** creates sessions with `project_id` from env and `browser_settings.persistCookies` (project default persistent storage).
- **Playwright** (`connect_over_cdp`) loads WSJ routes; heuristics in `runtime/browserbase_wsj.py` detect login walls.
- **`sessions.debug`** exposes `debugger_fullscreen_url` for embedding in NAP.
- **`sessions.update(..., status="REQUEST_RELEASE")`** ends the session after a successful scrape; cookies remain in the Browserbase context for later runs.

## Why this split

- Credentials stay between the user and the publisher (WSJ), not NAP/Finance.
- Swapping browser vendors mostly touches `runtime/browserbase_wsj.py` and env vars.
- Yahoo quotes and OpenAI summarization stay decoupled from browser automation.
