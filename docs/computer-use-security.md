# Computer-use security guardrails (WSJ flow)

## Isolation model

- One **ephemeral VM session** per WSJ login flow.
- VM is disposable and must be destroyed on completion/timeout.
- No host desktop access is granted to the agent.

## Credential handling

- PoC uses `wsj_session_cookie` artifact only (no shared username/password persistence).
- Cookie artifacts are stored in a TTL vault and masked in logs/audit payloads.
- Session artifacts are scoped to `client_key` and `session_ref`.

## Runtime constraints

- Egress allowlist is projected from policy (`wsj.com` domains only by default).
- Clipboard and file transfer are disabled by policy defaults.
- Max session duration is capped by `COMPUTER_USE_SESSION_TTL_SECONDS`.

## Operational controls

- Kill-switch: invalidate `session_ref` in vault and stop VM session.
- Audit events emitted:
  - `wsj_session_started`
  - `wsj_session_completed`
  - `wsj_morning_shot`
- Expired sessions must return explicit re-login action (`login_required`).

## Migration path (OAuth)

Current artifact model already supports `oauth_access_token` type.
Future implementation should enforce delegated OAuth, token refresh, and scope validation.
