# WSJ + Browserbase (human-in-the-loop)

## Model

- WSJ pages run in a **Browserbase** managed browser (not on the Finance host).
- **Playwright** connects over CDP; sessions end with `sessions.update(..., status="REQUEST_RELEASE")` after a successful scrape.
- **Cookie persistence** uses Browserbase `persistCookies` on the session plus your **project** configuration (`BROWSERBASE_PROJECT_ID`).

## Credentials

- The Finance agent **never** receives usernames or passwords.
- When a login wall is detected, the API returns `REQUIRES_AUTH` and an **interactive Live View** URL for the user to sign in at WSJ.
- Optional legacy path: `WSJ_SESSION_COOKIE` for direct HTTP fetch without Browserbase (no Live View).

## Auditing

- `wsj_morning_shot` events are still posted to NAP when configured.
- Session cookie values are not returned to the client on success paths (HTML is processed server-side).

## Operations

- Rotate `BROWSERBASE_API_KEY` and review Browserbase project access controls.
- Session timeout is controlled by `BROWSERBASE_SESSION_TIMEOUT_SECONDS` (Browserbase `api_timeout`).
- Respect WSJ terms of use and applicable compliance rules.
