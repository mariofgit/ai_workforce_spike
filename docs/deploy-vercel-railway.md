# Deploy: NAP (Vercel) + agents (Railway)

Monorepo layout: **`nap/`** = Next.js + Prisma; **`agents/`** = three FastAPI services (SDR, CRM Clerk, Finance Analyst). In production they talk over HTTPS.

## 1. Railway — three services from the same repo

Create **three** Railway services, all with:

- **Root Directory:** `agents`
- **Build Command:** `pip install -e .`
- **Start Command:** use the row for that service below (Railway sets `PORT`).

| Service name (suggested) | Start Command |
| ------------------------- | ------------- |
| `spike-sdr` | `uvicorn runtime.sdr_agent_app:app --host 0.0.0.0 --port $PORT` |
| `spike-crm-clerk` | `uvicorn runtime.crm_clerk_app:app --host 0.0.0.0 --port $PORT` |
| `spike-finance` | `uvicorn runtime.finance_analyst_app:app --host 0.0.0.0 --port $PORT` |

After deploy, open each service → **Settings → Networking → Generate Domain** and copy the public HTTPS URLs (e.g. `https://spike-sdr-production.up.railway.app`).

### Environment variables (Railway)

Copy from [`agents/.env.example`](../agents/.env.example). Tune **per service** for public URLs:

| Variable | Service | Value |
| -------- | ------- | ----- |
| `NAP_BASE_URL` | all three | `https://<vercel-host>/api/nap` (after Vercel deploy; then **redeploy** agents) |
| `NAP_SERVICE_TOKEN` | all three | Same secret as Vercel `NAP_SERVICE_TOKEN` |
| `CRM_MCP_URL` | **SDR only** | `https://<crm-clerk-railway-host>/mcp/write-contact` |
| `FINANCE_ANALYST_SANDBOX_URL` | **Finance only** | `https://<finance-railway-host>` (no path; used in NAP registry payload) |
| `SDR_SANDBOX_URL` | SDR (optional) | Public SDR URL if you add registry for SDR later |
| `CRM_CLERK_SANDBOX_URL` | CRM (optional) | Public CRM URL if used |
| `COMPUTER_USE_VM_VIEW_BASE_URL` | **Finance only** | Base URL of your mini-VM session gateway |
| `COMPUTER_USE_SESSION_TTL_SECONDS` | **Finance only** | Session hard timeout (e.g. `900`) |
| `COMPUTER_USE_VAULT_KEY` | **Finance only** | Random secret used for session vault encryption key derivation |

**Ports:** Railway injects `PORT`. Do not force `SDR_PORT` / `CRM_CLERK_PORT` / `FINANCE_ANALYST_PORT` for binding; start commands use `$PORT` above.

Add Zoho, `OPENAI_API_KEY`, `WSJ_SESSION_COOKIE`, etc. as needed.

## 2. Vercel — NAP (`nap/`)

In the Vercel project:

- **Root Directory:** `nap`
- **Framework Preset:** Next.js (auto)
- **Build Command:** default (`npm run build`); `prisma generate` runs on **`npm install`** via [`postinstall` in `nap/package.json`](../nap/package.json).

### Environment variables (Vercel)

From [`nap/.env.example`](../nap/.env.example):

- **`SUPABASE_DB_URL`** — pooler URL (e.g. `:6543` + `pgbouncer=true`) as in the example.
- **`SUPABASE_DB_DIRECT_URL`** — session pooler or direct Postgres (`:5432`), required for Prisma.
- **`NAP_SERVICE_TOKEN`** — same value as on Railway agents.
- **`SDR_BASE_URL`** — Railway public URL for SDR (HTTPS, no trailing slash).
- **`CRM_CLERK_BASE_URL`** — Railway public URL for CRM Clerk.
- **`FINANCE_ANALYST_BASE_URL`** — Railway public URL for Finance Analyst.
- **`NAP_PUBLIC_BASE_URL`** (optional) — canonical site URL if you use a custom domain; otherwise [`VERCEL_URL`](https://vercel.com/docs/projects/environment-variables/system-environment-variables) is used for internal NAP API calls.

### Database schema (first time)

This repo uses `prisma db push` in local dev; there is no `migrations/` folder yet. Before or after the first Vercel deploy, apply the schema to production Postgres (from your machine, with prod URLs in env):

```bash
cd nap
export SUPABASE_DB_URL="..."
export SUPABASE_DB_DIRECT_URL="..."
npx prisma db push
```

Alternatively, add a CI step or a one-off script; avoid repeating destructive flags on every build once you have real data.

## 3. Wire-up order

1. Deploy **Railway** three services → get three HTTPS URLs.
2. Deploy **Vercel** with agent base URLs + DB + `NAP_SERVICE_TOKEN`.
3. Set **`NAP_BASE_URL`** on all Railway services to `https://<vercel-host>/api/nap` and **redeploy** agents so heartbeats/registry hit production NAP.

## 4. Smoke checks

- `GET https://<railway-sdr>/health`
- `GET https://<vercel>/api/health` (if exposed)
- UI flows that hit `/api/ui/*` should proxy to the three Railway bases via server-side `fetch` (no browser CORS to agents).

## 5. WSJ computer-use flow (ephemeral VM)

1. `POST /api/ui/wsj-session/start` from NAP UI/backend.
2. Open `vm_view_url` and complete WSJ login manually.
3. `POST /api/ui/wsj-session/complete` with `session_ref` and session cookie captured from VM.
4. Run `POST /api/ui/wsj-morning-shot` with `session_ref` so finance-agent resolves auth from vault.
