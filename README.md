# Neuforce AI Workforce Spike

Root workspace for the March 2026 Neuforce agent-native spike.

**Repositorio remoto (GitHub):** `ai_workforce_spike`.

## Scope
- Agent identity stacks (SDR, CRM Clerk, Finance Analyst)
- NAP platform (registry, secrets, inbox, audit, usage)
- Integration assets for H1, H2, and H3 validation

## Deploy (Vercel + Railway)

See [docs/deploy-vercel-railway.md](docs/deploy-vercel-railway.md).

## Suggested structure
- `agent-workspaces/`: versioned identity files and skills
- `nap/`: API, schema, and platform modules
- `agents/`: runtime adapters and agent services
- `tests/`: hypothesis test harnesses (H1/H2/H3)
- `docs/`: evidence, runbooks, and findings
