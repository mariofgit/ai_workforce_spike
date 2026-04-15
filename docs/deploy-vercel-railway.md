# Deploy: NAP (Vercel) + agents (Railway)

**Repositorio GitHub:** `ai_workforce_spike` (mismo monorepo para Vercel y Railway).

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
| `BROWSERBASE_API_KEY` | **Finance** (WSJ cloud browser) | See [browserbase-wsj.md](browserbase-wsj.md). |
| `BROWSERBASE_PROJECT_ID` | **Finance** (required for WSJ cloud browser) | Browserbase project id (passed to every `sessions.create`). |

**Ports:** Railway injects `PORT`. Do not force `SDR_PORT` / `CRM_CLERK_PORT` / `FINANCE_ANALYST_PORT` for binding; start commands use `$PORT` above.

Add Zoho, `OPENAI_API_KEY`, `WSJ_SESSION_COOKIE` (legacy HTTP-only WSJ), etc. as needed.

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

## 5. WSJ flow (Browserbase)

WSJ HTML is loaded in a **Browserbase** cloud session (see [browserbase-wsj.md](browserbase-wsj.md)). No fourth Railway service is required. Configure `BROWSERBASE_API_KEY` (and optional context/project vars) on **spike-finance**.

## 6. WSJ UI flow (NAP)

1. `POST /api/ui/wsj-morning-shot` proxies to Finance.
2. If Finance returns `REQUIRES_AUTH`, the console shows the Browserbase **Live View** URL (iframe or new tab).
3. After the user signs in at the publisher, **Continue after sign-in** resends the request with `browserbase_session_id`.
4. Finance completes scraping and releases the Browserbase session; cookies can persist in the configured **context** for the next run.
