#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAP_DIR="${ROOT_DIR}/nap"
AGENTS_DIR="${ROOT_DIR}/agents"
AGENTS_VENV_DIR="${AGENTS_DIR}/.venv"
AGENTS_PYTHON="${AGENTS_VENV_DIR}/bin/python"
PIP_EXTRA_INDEX_URL="${PIP_EXTRA_INDEX_URL:-}"

NAP_PORT="${NAP_PORT:-3000}"
SDR_PORT="${SDR_PORT:-8010}"
CRM_CLERK_PORT="${CRM_CLERK_PORT:-8011}"
FINANCE_ANALYST_PORT="${FINANCE_ANALYST_PORT:-8012}"
NAP_BOOT_TIMEOUT="${NAP_BOOT_TIMEOUT:-240}"
NPM_REGISTRY_URL="${NPM_REGISTRY_URL:-https://registry.npmjs.org}"
SKIP_SMOKE="${SKIP_SMOKE:-}"

NAP_PID=""
SDR_PID=""
CRM_PID=""
FINANCE_PID=""

log() { printf "\n[%s] %s\n" "$(date +%H:%M:%S)" "$1"; }

ensure_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path"
    exit 1
  fi
}

load_dotenv_file() {
  local file="$1"
  ensure_file "$file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    local key="${line%%=*}"
    local value="${line#*=}"
    export "$key=$value"
  done < "$file"
}

assert_port_free() {
  local port="$1"
  local retries="${2:-8}"
  local delay_s="${3:-1}"
  local i=1
  while (( i <= retries )); do
    if ! lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep "${delay_s}"
    ((i++))
  done
  echo "Port ${port} is already in use. Free it or run with a different port env."
  exit 1
}

force_free_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN || true)"
  if [[ -n "${pids}" ]]; then
    log "Auto-freeing port ${port}: ${pids}"
    kill ${pids} >/dev/null 2>&1 || true
    sleep 1
    local still
    still="$(lsof -tiTCP:"${port}" -sTCP:LISTEN || true)"
    if [[ -n "${still}" ]]; then
      log "Force killing remaining on ${port}: ${still}"
      kill -9 ${still} >/dev/null 2>&1 || true
    fi
  fi
}

cleanup() {
  log "Stopping services..."
  [[ -n "${FINANCE_PID}" ]] && kill "${FINANCE_PID}" >/dev/null 2>&1 || true
  [[ -n "${CRM_PID}" ]] && kill "${CRM_PID}" >/dev/null 2>&1 || true
  [[ -n "${SDR_PID}" ]] && kill "${SDR_PID}" >/dev/null 2>&1 || true
  [[ -n "${NAP_PID}" ]] && kill "${NAP_PID}" >/dev/null 2>&1 || true
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-30}"
  local sleep_s="${3:-1}"
  local i=1
  while (( i <= attempts )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_s"
    ((i++))
  done
  return 1
}

start_nap() {
  log "Starting NAP on :${NAP_PORT}"
  ensure_file "${NAP_DIR}/.env"
  ensure_file "${AGENTS_DIR}/.env"
  force_free_port "${NAP_PORT}"
  assert_port_free "${NAP_PORT}"
  local nap_token
  local finance_defaults_symbols
  nap_token="$(extract_env_value "${NAP_DIR}/.env" "NAP_SERVICE_TOKEN")"
  finance_defaults_symbols="$(extract_env_value "${AGENTS_DIR}/.env" "FINANCE_DEFAULT_SYMBOLS")"
  if [[ -z "${nap_token}" ]]; then
    echo "NAP_SERVICE_TOKEN missing in ${NAP_DIR}/.env"
    exit 1
  fi
  : >"${ROOT_DIR}/.nap.log"
  local nap_db_pool nap_db_direct
  nap_db_pool="$(extract_env_value "${NAP_DIR}/.env" "SUPABASE_DB_URL")"
  nap_db_direct="$(extract_env_value "${NAP_DIR}/.env" "SUPABASE_DB_DIRECT_URL")"
  if [[ -z "${nap_db_direct}" && "${nap_db_pool}" == *pooler.supabase.com* ]]; then
    log "NAP: set SUPABASE_DB_DIRECT_URL in nap/.env (db.*.supabase.co:5432) or prisma db push may hang on the pooler"
  fi
  if [[ -n "${nap_db_direct}" && "${nap_db_direct}" == *pooler.supabase.com* && "${nap_db_direct}" == *:6543* ]]; then
    log "NAP: SUPABASE_DB_DIRECT_URL should not use transaction pooler :6543 — use session pooler :5432 or db.*:5432 (see nap/.env.example)"
  fi
  log "NAP: install + prisma generate + db push (foreground)"
  if ! (
    cd "${NAP_DIR}"
    export NPM_CONFIG_USERCONFIG="${ROOT_DIR}/.npmrc"
    export NPM_CONFIG_REGISTRY="${NPM_REGISTRY_URL}"
    export NAP_SERVICE_TOKEN="${nap_token}"
    export SUPABASE_DB_URL="${nap_db_pool}"
    export SUPABASE_DB_DIRECT_URL="${nap_db_direct:-${nap_db_pool}}"
    if [[ ! -d node_modules ]]; then
      npm install --registry "${NPM_REGISTRY_URL}"
    fi
    npx prisma generate
    npx prisma db push --skip-generate --accept-data-loss
  ) >>"${ROOT_DIR}/.nap.log" 2>&1; then
    echo "NAP prepare failed (prisma/db). See ${ROOT_DIR}/.nap.log"
    exit 1
  fi

  log "NAP: starting Next.js on :${NAP_PORT}"
  (
    cd "${NAP_DIR}"
    export NPM_CONFIG_USERCONFIG="${ROOT_DIR}/.npmrc"
    export NPM_CONFIG_REGISTRY="${NPM_REGISTRY_URL}"
    export NAP_SERVICE_TOKEN="${nap_token}"
    export SUPABASE_DB_URL="${nap_db_pool}"
    export SUPABASE_DB_DIRECT_URL="${nap_db_direct:-${nap_db_pool}}"
    export SDR_BASE_URL="http://localhost:${SDR_PORT}"
    export CRM_CLERK_BASE_URL="http://localhost:${CRM_CLERK_PORT}"
    export FINANCE_ANALYST_BASE_URL="http://localhost:${FINANCE_ANALYST_PORT}"
    export FINANCE_DEFAULT_SYMBOLS="${finance_defaults_symbols:-NVDA,AMD,ARM}"
    npm run dev -- --port "${NAP_PORT}"
  ) >>"${ROOT_DIR}/.nap.log" 2>&1 &
  NAP_PID=$!
}

start_agents() {
  log "Starting CRM Clerk on :${CRM_CLERK_PORT}"
  load_dotenv_file "${AGENTS_DIR}/.env"
  export NAP_BASE_URL="http://localhost:${NAP_PORT}/api/nap"
  export FINANCE_ANALYST_SANDBOX_URL="http://localhost:${FINANCE_ANALYST_PORT}"
  force_free_port "${CRM_CLERK_PORT}"
  force_free_port "${SDR_PORT}"
  force_free_port "${FINANCE_ANALYST_PORT}"
  assert_port_free "${CRM_CLERK_PORT}"
  assert_port_free "${SDR_PORT}"
  assert_port_free "${FINANCE_ANALYST_PORT}"
  if [[ ! -x "${AGENTS_PYTHON}" ]]; then
    log "Creating agents virtualenv"
    python3 -m venv "${AGENTS_VENV_DIR}"
  fi
  log "Installing agents dependencies"
  "${AGENTS_PYTHON}" -m pip install --upgrade pip
  if [[ -n "${PIP_EXTRA_INDEX_URL}" ]]; then
    "${AGENTS_PYTHON}" -m pip install -e "${AGENTS_DIR}" --extra-index-url "${PIP_EXTRA_INDEX_URL}"
  else
    "${AGENTS_PYTHON}" -m pip install -e "${AGENTS_DIR}"
  fi

  (
    cd "${ROOT_DIR}"
    "${AGENTS_PYTHON}" -m uvicorn runtime.crm_clerk_app:app --app-dir agents --host 0.0.0.0 --port "${CRM_CLERK_PORT}"
  ) >"${ROOT_DIR}/.crm-clerk.log" 2>&1 &
  CRM_PID=$!

  log "Starting SDR Agent on :${SDR_PORT}"
  (
    cd "${ROOT_DIR}"
    "${AGENTS_PYTHON}" -m uvicorn runtime.sdr_agent_app:app --app-dir agents --host 0.0.0.0 --port "${SDR_PORT}"
  ) >"${ROOT_DIR}/.sdr.log" 2>&1 &
  SDR_PID=$!

  log "Starting Finance Analyst on :${FINANCE_ANALYST_PORT}"
  (
    cd "${ROOT_DIR}"
    "${AGENTS_PYTHON}" -m uvicorn runtime.finance_analyst_app:app --app-dir agents --host 0.0.0.0 --port "${FINANCE_ANALYST_PORT}"
  ) >"${ROOT_DIR}/.finance-analyst.log" 2>&1 &
  FINANCE_PID=$!
}

health_check() {
  log "Running health checks"
  curl -fsS "http://localhost:${NAP_PORT}/api/health" || {
    echo "NAP health check failed"
    return 1
  }
  echo
  curl -fsS "http://localhost:${SDR_PORT}/health" || {
    echo "SDR health check failed"
    return 1
  }
  echo
  curl -fsS "http://localhost:${CRM_CLERK_PORT}/health" || {
    echo "CRM Clerk health check failed"
    return 1
  }
  echo
  curl -fsS "http://localhost:${FINANCE_ANALYST_PORT}/health" || {
    echo "Finance Analyst health check failed"
    return 1
  }
  echo
  log "All health checks passed"
}

run_tests() {
  log "Running H1/H2/H3 scripts"
  cd "${ROOT_DIR}"
  python3 tests/run_h1.py
  python3 tests/run_h2.py
  python3 tests/run_h3.py
}

extract_env_value() {
  local file="$1"
  local key="$2"
  awk -F= -v k="$key" '$1 == k {print substr($0, index($0, "=") + 1)}' "$file" | tail -n 1
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  ensure_file "$file"
  local tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" '
    BEGIN { found=0 }
    $0 ~ "^[[:space:]]*"k"=" {
      print k"="v
      found=1
      next
    }
    { print }
    END {
      if (!found) print k"="v
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

mask_token() {
  local token="$1"
  local len="${#token}"
  if (( len <= 8 )); then
    echo "********"
    return
  fi
  local start="${token:0:4}"
  local end="${token:len-4:4}"
  echo "${start}...${end}"
}

token_check() {
  ensure_file "${NAP_DIR}/.env"
  ensure_file "${AGENTS_DIR}/.env"
  local nap_token
  local agents_token
  nap_token="$(extract_env_value "${NAP_DIR}/.env" "NAP_SERVICE_TOKEN")"
  agents_token="$(extract_env_value "${AGENTS_DIR}/.env" "NAP_SERVICE_TOKEN")"

  if [[ -z "${nap_token}" || -z "${agents_token}" ]]; then
    echo "Missing NAP_SERVICE_TOKEN in nap/.env or agents/.env"
    return 1
  fi

  echo "nap/.env token:    $(mask_token "${nap_token}")"
  echo "agents/.env token: $(mask_token "${agents_token}")"

  if [[ "${nap_token}" == "${agents_token}" ]]; then
    log "TOKEN CHECK PASS"
    return 0
  fi

  log "TOKEN CHECK FAIL"
  echo "Tokens do not match. Run: ./run_spike.sh token-sync"
  return 1
}

token_sync() {
  ensure_file "${NAP_DIR}/.env"
  ensure_file "${AGENTS_DIR}/.env"
  local nap_token
  nap_token="$(extract_env_value "${NAP_DIR}/.env" "NAP_SERVICE_TOKEN")"
  if [[ -z "${nap_token}" ]]; then
    echo "NAP_SERVICE_TOKEN missing in nap/.env"
    return 1
  fi
  set_env_value "${AGENTS_DIR}/.env" "NAP_SERVICE_TOKEN" "${nap_token}"
  log "Token synced from nap/.env -> agents/.env"
  echo "Now restart services: ./run_spike.sh down && ./run_spike.sh all"
}

run_smoke() {
  log "Running smoke test (SDR -> CRM + escalation -> NAP)"
  ensure_file "${NAP_DIR}/.env"
  local token="${NAP_SERVICE_TOKEN:-}"
  if [[ -z "${token}" ]]; then
    token="$(extract_env_value "${NAP_DIR}/.env" "NAP_SERVICE_TOKEN")"
  fi
  if [[ -z "${token}" ]]; then
    echo "NAP_SERVICE_TOKEN not found in nap/.env"
    return 1
  fi

  local normal_response
  normal_response="$(curl -fsS -X POST "http://localhost:${SDR_PORT}/lead-message" \
    -H "Content-Type: application/json" \
    -d '{"lead_id":"smoke-001","text":"Hi, we are evaluating options for 20 users","channel":"whatsapp","client_key":"demo-client"}')"
  echo "Normal flow response: ${normal_response}"

  local escalation_response
  escalation_response="$(curl -fsS -X POST "http://localhost:${SDR_PORT}/lead-message" \
    -H "Content-Type: application/json" \
    -d '{"lead_id":"smoke-002","text":"I am angry and want a refund now","channel":"whatsapp","client_key":"demo-client"}')"
  echo "Escalation flow response: ${escalation_response}"

  local audit_json
  audit_json="$(curl -sS -H "Authorization: Bearer ${token}" \
    "http://localhost:${NAP_PORT}/api/nap/audit?clientKey=demo-client")"
  local inbox_json
  inbox_json="$(curl -sS -H "Authorization: Bearer ${token}" \
    "http://localhost:${NAP_PORT}/api/nap/inbox?status=pending&clientKey=demo-client")"

  local json_parser="${AGENTS_PYTHON:-python3}"
  local audit_top_ok
  local inbox_top_ok
  audit_top_ok="$(JSON_INPUT="${audit_json}" "${json_parser}" - <<'PY'
import json, os
try:
    data = json.loads(os.environ.get("JSON_INPUT", ""))
    print("true" if bool(data.get("ok", False)) else "false")
except Exception:
    print("invalid")
PY
)"
  inbox_top_ok="$(JSON_INPUT="${inbox_json}" "${json_parser}" - <<'PY'
import json, os
try:
    data = json.loads(os.environ.get("JSON_INPUT", ""))
    print("true" if bool(data.get("ok", False)) else "false")
except Exception:
    print("invalid")
PY
)"

  local ok=0
  if [[ "${normal_response}" != *'"handled":true'* ]]; then
    echo "Smoke failed: normal flow was not handled."
    ok=1
  fi
  if [[ "${escalation_response}" != *'"status":"escalated"'* ]]; then
    echo "Smoke failed: escalation flow did not escalate."
    ok=1
  fi
  if [[ "${audit_top_ok}" != "true" ]]; then
    if [[ "${audit_json}" == *'Invalid service token'* || "${audit_json}" == *'Missing bearer token'* ]]; then
      echo "Smoke failed: NAP audit auth failed (check NAP_SERVICE_TOKEN sync between nap/.env and agents/.env)."
    else
      echo "Smoke failed: NAP audit endpoint returned error: ${audit_json}"
    fi
    ok=1
  elif [[ "${audit_json}" != *'"events"'* ]]; then
    echo "Smoke failed: audit endpoint did not return events."
    ok=1
  fi
  if [[ "${inbox_top_ok}" != "true" ]]; then
    if [[ "${inbox_json}" == *'Invalid service token'* || "${inbox_json}" == *'Missing bearer token'* ]]; then
      echo "Smoke failed: NAP inbox auth failed (check NAP_SERVICE_TOKEN sync between nap/.env and agents/.env)."
    else
      echo "Smoke failed: NAP inbox endpoint returned error: ${inbox_json}"
    fi
    ok=1
  elif [[ "${inbox_json}" != *'"items"'* ]]; then
    echo "Smoke failed: inbox endpoint did not return items."
    ok=1
  fi

  if [[ "${ok}" -eq 0 ]]; then
    log "SMOKE PASS"
  else
    log "SMOKE FAIL"
    return 1
  fi
}

fetch_most_actives() {
  local count="${1:-3}"
  local url="https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=${count}"
  local payload
  payload="$(curl -fsS "${url}" -H "User-Agent: Mozilla/5.0")"
  python3 - "$payload" <<'PY'
import json
import sys

raw = sys.argv[1]
data = json.loads(raw)
quotes = (
    data.get("finance", {})
    .get("result", [{}])[0]
    .get("quotes", [])
)
symbols = [q.get("symbol") for q in quotes if isinstance(q.get("symbol"), str) and q.get("symbol")]
print(",".join(symbols))
PY
}

set_finance_defaults_from_most_actives() {
  ensure_file "${AGENTS_DIR}/.env"
  local count="${1:-3}"
  log "Fetching Yahoo most_actives (count=${count})"
  local symbols
  symbols="$(fetch_most_actives "${count}")"
  if [[ -z "${symbols}" ]]; then
    echo "Could not resolve symbols from Yahoo most_actives."
    return 1
  fi
  echo "Yahoo most_actives symbols: ${symbols}"
  set_env_value "${AGENTS_DIR}/.env" "FINANCE_DEFAULT_SYMBOLS" "${symbols}"
  log "Updated agents/.env FINANCE_DEFAULT_SYMBOLS=${symbols}"
  echo "Restart services to apply: ./run_spike.sh down && ./run_spike.sh all"
}

usage() {
  cat <<EOF
Usage: ./run_spike.sh <command>

Commands:
  up         Start NAP + SDR + CRM Clerk and tail logs
  down       Stop services and free ports (${NAP_PORT}, ${SDR_PORT}, ${CRM_CLERK_PORT}, ${FINANCE_ANALYST_PORT})
  health     Check health of running services
  tests      Run H1/H2/H3 scripts
  smoke      Run end-to-end smoke checks across SDR, CRM Clerk and NAP
  env SKIP_SMOKE=1 to skip smoke when running `all`
  most-actives [N]  Print Yahoo most_actives symbols as CSV
  finance-defaults-from-most-actives [N]  Set FINANCE_DEFAULT_SYMBOLS in agents/.env from Yahoo list
  token-check  Compare NAP_SERVICE_TOKEN between nap/.env and agents/.env
  token-sync   Copy NAP_SERVICE_TOKEN from nap/.env into agents/.env
  all        Start services, run health checks, run tests, keep services running

Required setup:
  cp nap/.env.example nap/.env
  cp agents/.env.example agents/.env
EOF
}

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN || true)"
  if [[ -n "${pids}" ]]; then
    log "Stopping processes on port ${port}: ${pids}"
    kill ${pids} >/dev/null 2>&1 || true
    sleep 1
    local still
    still="$(lsof -tiTCP:"${port}" -sTCP:LISTEN || true)"
    if [[ -n "${still}" ]]; then
      log "Force stopping remaining processes on port ${port}: ${still}"
      kill -9 ${still} >/dev/null 2>&1 || true
    fi
  else
    log "Port ${port} already free"
  fi
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    up)
      : > "${ROOT_DIR}/.nap.log"
      : > "${ROOT_DIR}/.sdr.log"
      : > "${ROOT_DIR}/.crm-clerk.log"
      : > "${ROOT_DIR}/.finance-analyst.log"
      trap cleanup EXIT INT TERM
      start_nap
      start_agents
      wait_for_http "http://localhost:${NAP_PORT}/api/health" "${NAP_BOOT_TIMEOUT}" 1 || { echo "NAP did not boot (check .nap.log)"; exit 1; }
      wait_for_http "http://localhost:${SDR_PORT}/health" 60 1 || { echo "SDR did not boot"; exit 1; }
      wait_for_http "http://localhost:${CRM_CLERK_PORT}/health" 60 1 || { echo "CRM Clerk did not boot"; exit 1; }
      wait_for_http "http://localhost:${FINANCE_ANALYST_PORT}/health" 60 1 || { echo "Finance Analyst did not boot"; exit 1; }
      health_check
      log "Services running. Logs:"
      echo "  ${ROOT_DIR}/.nap.log"
      echo "  ${ROOT_DIR}/.sdr.log"
      echo "  ${ROOT_DIR}/.crm-clerk.log"
      echo "  ${ROOT_DIR}/.finance-analyst.log"
      tail -f "${ROOT_DIR}/.nap.log" "${ROOT_DIR}/.sdr.log" "${ROOT_DIR}/.crm-clerk.log" "${ROOT_DIR}/.finance-analyst.log"
      ;;
    health)
      health_check
      ;;
    down)
      stop_port "${NAP_PORT}"
      stop_port "${SDR_PORT}"
      stop_port "${CRM_CLERK_PORT}"
      stop_port "${FINANCE_ANALYST_PORT}"
      log "Done. Requested ports are free."
      ;;
    tests)
      run_tests
      ;;
    smoke)
      run_smoke
      ;;
    most-actives)
      fetch_most_actives "${2:-3}"
      ;;
    finance-defaults-from-most-actives)
      set_finance_defaults_from_most_actives "${2:-3}"
      ;;
    token-check)
      token_check
      ;;
    token-sync)
      token_sync
      ;;
    all)
      : > "${ROOT_DIR}/.nap.log"
      : > "${ROOT_DIR}/.sdr.log"
      : > "${ROOT_DIR}/.crm-clerk.log"
      : > "${ROOT_DIR}/.finance-analyst.log"
      trap cleanup EXIT INT TERM
      start_nap
      start_agents
      wait_for_http "http://localhost:${NAP_PORT}/api/health" "${NAP_BOOT_TIMEOUT}" 1 || { echo "NAP did not boot (check .nap.log)"; exit 1; }
      wait_for_http "http://localhost:${SDR_PORT}/health" 60 1 || { echo "SDR did not boot"; exit 1; }
      wait_for_http "http://localhost:${CRM_CLERK_PORT}/health" 60 1 || { echo "CRM Clerk did not boot"; exit 1; }
      wait_for_http "http://localhost:${FINANCE_ANALYST_PORT}/health" 60 1 || { echo "Finance Analyst did not boot"; exit 1; }
      health_check
      run_tests
      if [[ -n "${SKIP_SMOKE}" ]]; then
        log "Skipping smoke test (SKIP_SMOKE is set)."
      else
        run_smoke
      fi
      log "All done. Services remain up until Ctrl+C."
      tail -f "${ROOT_DIR}/.nap.log" "${ROOT_DIR}/.sdr.log" "${ROOT_DIR}/.crm-clerk.log" "${ROOT_DIR}/.finance-analyst.log"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
