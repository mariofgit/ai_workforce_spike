# WSJ flow with Browserbase (replaces Docker mini-VM)

The Finance Analyst agent loads WSJ pages in a **Browserbase** cloud browser (Playwright over CDP). New sessions use **`project_id` from env** and `browser_settings: { persistCookies: true }` so Browserbase applies the **project default persistent context** (no explicit `context.id`).

## Environment (Finance / `agents/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `BROWSERBASE_API_KEY` | Yes (for WSJ via cloud browser) | API key from [Browserbase settings](https://www.browserbase.com/settings). |
| `BROWSERBASE_PROJECT_ID` | **Yes** (for new sessions) | Project ID from Browserbase; every `sessions.create` passes this value. |
| `BROWSERBASE_SESSION_TIMEOUT_SECONDS` | No | Session lifetime in seconds (maps to Browserbase `api_timeout`; default `3600`). |
| `WSJ_SESSION_COOKIE` | No | Legacy: if `BROWSERBASE_API_KEY` is unset, Finance falls back to plain HTTP fetch with this cookie header. |

## Flow

1. `POST /wsj-morning-shot` creates a Browserbase session (unless `browserbase_session_id` is sent to resume).
2. Playwright navigates WSJ paths; if a login/paywall heuristic matches, Finance calls `sessions.debug(session_id)` and returns `state: REQUIRES_AUTH` with `interactive_live_view_url` (fullscreen debugger URL).
3. NAP embeds that URL in an iframe so the user signs in; credentials never pass through NAP or Finance.
4. User triggers the same endpoint again with `browserbase_session_id` to continue scraping.
5. After a successful run, Finance calls `sessions.update(id, status="REQUEST_RELEASE")` so the session ends; persistence follows your Browserbase project settings for `persistCookies`.

## NAP UI

The spike console shows the Live View iframe when the Finance response is `REQUIRES_AUTH` and provides **Continue after sign-in** to retry with the same session id.

## Operational notes

- **Playwright** is a Python dependency; connecting with `connect_over_cdp` does not require installing local Chromium browsers.
- Heuristic login detection may misfire on site changes; tune `runtime/browserbase_wsj.py` if needed.
- Respect WSJ terms of use and your organization’s policies for automated access.
