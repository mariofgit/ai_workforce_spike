"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;
type MorningQuote = {
  Ticker: string;
  name?: string;
  last_close?: string;
  prev_close?: string;
  change_pct?: string;
  ok?: boolean;
  error?: string;
};
type WsjItem = {
  title?: string;
  url?: string;
  instrument?: string;
  value?: string;
  change?: string | null;
  as_of?: string;
};
type WsjEquityFact = {
  ticker?: string;
  source?: string;
  quote?: MorningQuote;
};

type StructuredSummary = {
  disclaimer?: string;
  sections: Array<{ id: string; title: string; bullets: string[] }>;
  watch_today: string[];
};

type AuditEvent = {
  id: string;
  agentType?: string;
  eventType?: string;
  createdAt?: string;
  correlationId?: string;
};
type InboxItem = {
  id: string;
  sourceAgentType?: string;
  status?: string;
  summary?: string;
  urgency?: string;
  createdAt?: string;
};
type CrmActivityEvent = {
  at?: string;
  lead_id?: string;
  correlation_id?: string;
  response?: { status?: string; detail?: string; contact_id?: string };
  zoho_response?: {
    http_status?: number;
    status?: string;
    code?: string;
    message?: string;
    details?: { id?: string; [k: string]: unknown };
    error?: string;
    mode?: string;
    [k: string]: unknown;
  };
};

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={className ? `card ${className}` : "card"}>
      <div className="card-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>
      </div>
      {open ? children : null}
    </section>
  );
}

export default function Page() {
  const [leadCounter, setLeadCounter] = useState(1);
  const clientKey = "demo-client";
  const [lastResult, setLastResult] = useState<JsonValue>(null);
  const [morningShotLog, setMorningShotLog] = useState<JsonValue>(null);
  const [wsjShotLog, setWsjShotLog] = useState<JsonValue>(null);
  const [wsjSessionLog, setWsjSessionLog] = useState<JsonValue>(null);
  const [wsjSessionRef, setWsjSessionRef] = useState("");
  const [wsjSessionCookie, setWsjSessionCookie] = useState("");
  const [wsjVmUrl, setWsjVmUrl] = useState("");
  const [symbolsCsv, setSymbolsCsv] = useState("");
  const [stateResult, setStateResult] = useState<JsonValue>(null);
  const [crmActivity, setCrmActivity] = useState<JsonValue>(null);
  const [loading, setLoading] = useState(false);
  const [morningLoading, setMorningLoading] = useState(false);
  const [wsjLoading, setWsjLoading] = useState(false);

  const parsedMorningQuotes = (() => {
    if (!morningShotLog || typeof morningShotLog !== "object" || !("response" in morningShotLog)) return [];
    const response = (morningShotLog as Record<string, unknown>).response;
    if (!response || typeof response !== "object" || !("data" in response)) return [];
    const data = (response as Record<string, unknown>).data;
    if (!data || typeof data !== "object" || !("quotes" in data)) return [];
    const quotes = (data as Record<string, unknown>).quotes;
    return Array.isArray(quotes) ? (quotes as MorningQuote[]) : [];
  })();
  const parsedWsjData = (() => {
    if (!wsjShotLog || typeof wsjShotLog !== "object" || !("response" in wsjShotLog)) return null;
    const response = (wsjShotLog as Record<string, unknown>).response;
    if (!response || typeof response !== "object" || !("data" in response)) return null;
    const data = (response as Record<string, unknown>).data;
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  })();
  const wsjHeadlines = Array.isArray(parsedWsjData?.top_headlines) ? (parsedWsjData?.top_headlines as WsjItem[]) : [];
  const wsjEconomy = Array.isArray(parsedWsjData?.economy_policy) ? (parsedWsjData?.economy_policy as WsjItem[]) : [];
  const wsjMarket = Array.isArray(parsedWsjData?.market_snapshot) ? (parsedWsjData?.market_snapshot as WsjItem[]) : [];

  const wsjFactsPack =
    parsedWsjData && typeof parsedWsjData.facts_pack === "object" && parsedWsjData.facts_pack !== null
      ? (parsedWsjData.facts_pack as Record<string, unknown>)
      : null;
  const wsjEquityFacts = Array.isArray(wsjFactsPack?.equities)
    ? (wsjFactsPack.equities as WsjEquityFact[])
    : [];
  const wsjMacroFacts = Array.isArray(wsjFactsPack?.macro_indices)
    ? (wsjFactsPack.macro_indices as Array<{ ticker?: string; quote?: MorningQuote }>)
    : [];
  const wsjStructured: StructuredSummary | null = (() => {
    const s = parsedWsjData?.structured_summary;
    if (!s || typeof s !== "object") return null;
    const o = s as Record<string, unknown>;
    const rawSections = Array.isArray(o.sections) ? o.sections : [];
    const sections = rawSections
      .map((x) => {
        if (typeof x !== "object" || x === null) return null;
        const r = x as Record<string, unknown>;
        const bullets = Array.isArray(r.bullets)
          ? (r.bullets as unknown[]).filter((b): b is string => typeof b === "string")
          : [];
        return {
          id: String(r.id ?? ""),
          title: String(r.title ?? r.id ?? ""),
          bullets,
        };
      })
      .filter(
        (x): x is { id: string; title: string; bullets: string[] } =>
          x !== null && x.id.length > 0 && x.bullets.length > 0,
      );
    const watch = Array.isArray(o.watch_today)
      ? (o.watch_today as unknown[]).filter((w): w is string => typeof w === "string")
      : [];
    return {
      disclaimer: typeof o.disclaimer === "string" ? o.disclaimer : undefined,
      sections,
      watch_today: watch,
    };
  })();

  const parsedAuditEvents = (() => {
    if (!stateResult || typeof stateResult !== "object" || !("audit" in stateResult)) return [];
    const audit = (stateResult as Record<string, unknown>).audit;
    if (!audit || typeof audit !== "object" || !("events" in audit)) return [];
    const events = (audit as Record<string, unknown>).events;
    return Array.isArray(events) ? (events as AuditEvent[]) : [];
  })();

  const parsedInboxItems = (() => {
    if (!stateResult || typeof stateResult !== "object" || !("inbox" in stateResult)) return [];
    const inbox = (stateResult as Record<string, unknown>).inbox;
    if (!inbox || typeof inbox !== "object" || !("items" in inbox)) return [];
    const items = (inbox as Record<string, unknown>).items;
    return Array.isArray(items) ? (items as InboxItem[]) : [];
  })();
  const parsedCrmEvents = (() => {
    if (!crmActivity || typeof crmActivity !== "object" || !("data" in crmActivity)) return [];
    const data = (crmActivity as Record<string, unknown>).data;
    if (!data || typeof data !== "object" || !("events" in data)) return [];
    const events = (data as Record<string, unknown>).events;
    return Array.isArray(events) ? (events as CrmActivityEvent[]) : [];
  })();

  const eventTone = (eventType?: string) => {
    if (!eventType) return "tone-neutral";
    if (eventType.includes("escalation")) return "tone-warn";
    if (eventType.includes("morning_shot")) return "tone-info";
    if (eventType.includes("handled")) return "tone-success";
    return "tone-neutral";
  };

  const refreshState = async () => {
    const [stateRes, crmRes] = await Promise.all([
      fetch(`/api/ui/state?clientKey=${encodeURIComponent(clientKey)}`),
      fetch("/api/ui/crm-activity"),
    ]);
    const [stateJson, crmJson] = await Promise.all([stateRes.json(), crmRes.json()]);
    setStateResult(stateJson);
    setCrmActivity(crmJson);
  };

  const runMorningShot = async () => {
    setMorningLoading(true);
    const symbols = symbolsCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const requestParams = {
      client_key: clientKey,
      symbols_csv: symbolsCsv,
      symbols,
      snapshot_label: "ui-morning-shot",
    };
    try {
      const res = await fetch("/api/ui/morning-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_key: clientKey,
          symbols_csv: symbolsCsv,
          snapshot_label: "ui-morning-shot",
        }),
      });
      const json = await res.json();
      setMorningShotLog({ requestParams, response: json });
      await refreshState();
    } finally {
      setMorningLoading(false);
    }
  };
  const runWsjMorningShot = async () => {
    setWsjLoading(true);
    const requestParams = {
      client_key: clientKey,
      snapshot_label: "ui-wsj-morning-shot",
      sections: ["market_snapshot", "top_headlines", "economy_policy"],
      session_ref: wsjSessionRef || undefined,
    };
    try {
      const res = await fetch("/api/ui/wsj-morning-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestParams),
      });
      const json = await res.json();
      setWsjShotLog({ requestParams, response: json });
      await refreshState();
    } finally {
      setWsjLoading(false);
    }
  };

  const startWsjSession = async () => {
    const requestParams = { client_key: clientKey, scope: "wsj:morning-shot" };
    const res = await fetch("/api/ui/wsj-session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestParams),
    });
    const json = await res.json();
    setWsjSessionLog({ action: "start", requestParams, response: json });
    const data = (json?.data ?? {}) as Record<string, unknown>;
    if (typeof data.session_ref === "string") setWsjSessionRef(data.session_ref);
    if (typeof data.vm_view_url === "string") setWsjVmUrl(data.vm_view_url);
  };

  const completeWsjSession = async () => {
    const requestParams = {
      client_key: clientKey,
      session_ref: wsjSessionRef,
      session_cookie: wsjSessionCookie,
      artifact_kind: "wsj_session_cookie",
    };
    const res = await fetch("/api/ui/wsj-session/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestParams),
    });
    const json = await res.json();
    setWsjSessionLog({ action: "complete", requestParams: { ...requestParams, session_cookie: "***" }, response: json });
  };

  const sendLead = async (text: string) => {
    setLoading(true);
    try {
      const leadId = `ui-${String(leadCounter).padStart(3, "0")}`;
      const res = await fetch("/api/ui/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, client_key: clientKey, text }),
      });
      const json = await res.json();
      setLastResult(json);
      setLeadCounter((prev) => prev + 1);
      await refreshState();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadFinanceDefaults = async () => {
      try {
        const res = await fetch("/api/ui/finance-defaults");
        const json = (await res.json()) as { ok?: boolean; symbolsCsv?: string };
        if (json.ok && typeof json.symbolsCsv === "string" && json.symbolsCsv.trim()) {
          setSymbolsCsv(json.symbolsCsv);
        }
      } catch {
        // Keep empty input; placeholder remains visible.
      }
    };
    void loadFinanceDefaults();
    refreshState();
    const id = setInterval(() => {
      refreshState();
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <main>
      <h1>Neuforce Spike Console</h1>
      <p>Trigger agent interaction flows. NAP state refreshes automatically every 3 seconds.</p>

      <CollapsibleSection title="Trigger Messages (SDR)" defaultOpen>
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={() => sendLead("Hi, we are evaluating options for 20 users and need pricing.")}
            disabled={loading}
          >
            Send Normal Qualification Message
          </button>
          <button
            type="button"
            onClick={() => sendLead("I am angry and want a refund now. This is a complaint.")}
            disabled={loading}
          >
            Send Complaint Message (Escalation)
          </button>
          <button
            type="button"
            onClick={() => sendLead("Can you guarantee legal commitments in contract by tomorrow?")}
            disabled={loading}
          >
            Send High-Risk Commitment Message
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Last SDR Response" defaultOpen={false}>
        <pre>{JSON.stringify(lastResult, null, 2)}</pre>
      </CollapsibleSection>

      <CollapsibleSection title="CRM Clerk Activity (inbound/outbound log)" defaultOpen={false}>
        {parsedCrmEvents.length === 0 ? (
          <p style={{ opacity: 0.8 }}>Sin actividad aún. Se llena cuando SDR invoca CRM Clerk.</p>
        ) : (
          <div className="event-list">
            {parsedCrmEvents.slice(0, 10).map((ev, idx) => (
              <div key={`${ev.correlation_id ?? "evt"}-${idx}`} style={{ display: "grid", gap: 6 }}>
                <div className={`event-row ${ev.response?.status === "written" ? "tone-success" : "tone-warn"}`}>
                  <span className="pill">lead: {ev.lead_id ?? "-"}</span>
                  <span className="pill">status: {ev.response?.status ?? "-"}</span>
                  <span className="event-id">{ev.response?.contact_id ?? ev.response?.detail ?? ev.correlation_id ?? "-"}</span>
                </div>
                {ev.zoho_response ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div className={`event-row ${ev.zoho_response.status === "success" ? "tone-success" : "tone-neutral"}`}>
                      <span className="pill">zoho: {ev.zoho_response.status ?? ev.zoho_response.mode ?? "-"}</span>
                      <span className="pill">code: {ev.zoho_response.code ?? String(ev.zoho_response.http_status ?? "-")}</span>
                      <span className="event-id">
                        {ev.zoho_response.details?.id ?? ev.zoho_response.message ?? ev.zoho_response.error ?? "-"}
                      </span>
                    </div>
                    <details>
                      <summary style={{ cursor: "pointer", opacity: 0.85 }}>Zoho raw response</summary>
                      <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(ev.zoho_response, null, 2)}</pre>
                    </details>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <pre>{JSON.stringify(crmActivity, null, 2)}</pre>
      </CollapsibleSection>

      <CollapsibleSection title="Finance Analyst — Morning shot (Yahoo Finance)" defaultOpen>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          No usa CRM. Llama al agente <code>finance-analyst</code>, consulta Yahoo vía <code>yfinance</code> y
          registra <code>morning_shot</code> en auditoría NAP.
        </p>
        <label style={{ display: "block", marginBottom: 6 }}>
          Símbolos Yahoo (coma)
          <input
            type="text"
            value={symbolsCsv}
            onChange={(e) => setSymbolsCsv(e.target.value)}
            style={{ display: "block", width: "100%", maxWidth: 480, marginTop: 4 }}
            placeholder="vacío = NVDA,AMD,ARM"
          />
        </label>
        <button type="button" onClick={() => void runMorningShot()} disabled={morningLoading}>
          {morningLoading ? "Generando…" : "Generar morning-shot"}
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="Morning shot log (parámetros + respuesta)" defaultOpen>
        {parsedMorningQuotes.length > 0 && (
          <div className="quotes-grid">
            {parsedMorningQuotes.map((q) => (
              <article className="quote-card" key={q.Ticker}>
                <div className="quote-head">
                  <span className="hl-ticker">{q.Ticker}</span>
                  <span className="hl-name">{q.name ?? q.Ticker}</span>
                </div>
                {q.ok === false ? (
                  <div className="tone-warn">Error: {q.error}</div>
                ) : (
                  <div className="quote-metrics">
                    <div>Last close: {q.last_close ?? "-"}</div>
                    <div>Prev close: {q.prev_close ?? "-"}</div>
                    <div>Change: {q.change_pct ?? "-"}</div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <pre>{JSON.stringify(morningShotLog, null, 2)}</pre>
      </CollapsibleSection>

      <div className="wsj-shot-shell">
        <CollapsibleSection title="WSJ morning shot (risk summary + market data)" className="wsj-shot-panel" defaultOpen>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Authenticated WSJ pages plus Yahoo quotes (active / trending equities) and macro indices. Structured summary
          via OpenAI when <code>OPENAI_API_KEY</code> is set. NAP audit: <code>wsj_morning_shot</code>.
        </p>
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <button type="button" onClick={() => void startWsjSession()}>
            Start WSJ login session (ephemeral VM)
          </button>
          {wsjVmUrl ? (
            <a href={wsjVmUrl} target="_blank" rel="noreferrer">
              Open VM session
            </a>
          ) : null}
          <input
            value={wsjSessionRef}
            onChange={(e) => setWsjSessionRef(e.target.value)}
            placeholder="session_ref"
            style={{ padding: 8 }}
          />
          <input
            value={wsjSessionCookie}
            onChange={(e) => setWsjSessionCookie(e.target.value)}
            placeholder="Paste WSJ cookie from VM session"
            style={{ padding: 8 }}
          />
          <button type="button" onClick={() => void completeWsjSession()} disabled={!wsjSessionRef || !wsjSessionCookie}>
            Complete WSJ login session
          </button>
        </div>
        <button type="button" onClick={() => void runWsjMorningShot()} disabled={wsjLoading}>
          {wsjLoading ? "Running…" : "Run WSJ morning shot"}
        </button>
        {wsjSessionLog ? <pre style={{ marginTop: 8 }}>{JSON.stringify(wsjSessionLog, null, 2)}</pre> : null}
        {parsedWsjData ? (
          <div className="event-list" style={{ marginTop: 12 }}>
            <div className={`event-row ${parsedWsjData.login_required ? "tone-warn" : "tone-info"}`}>
              <span className="pill">source: {String(parsedWsjData.source ?? "wsj")}</span>
              <span className="pill">headlines: {wsjHeadlines.length}</span>
              <span className="pill">economy: {wsjEconomy.length}</span>
              <span className="pill">equities: {wsjEquityFacts.length}</span>
              <span className="event-id">
                {parsedWsjData.login_required ? "login or session required" : "session ok"}
              </span>
            </div>
          </div>
        ) : null}
        {wsjStructured && (wsjStructured.sections.length > 0 || wsjStructured.watch_today.length > 0) ? (
          <div className="wsj-summary">
            {wsjStructured.disclaimer ? <p className="wsj-disclaimer">{wsjStructured.disclaimer}</p> : null}
            {wsjStructured.sections.map((sec) => (
              <div key={sec.id}>
                <h3>{sec.title}</h3>
                <ul>
                  {sec.bullets.map((b, i) => (
                    <li key={`${sec.id}-${i}`}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
            {wsjStructured.watch_today.length > 0 ? (
              <div className="wsj-watch">
                <strong>Watch today</strong>
                <ul>
                  {wsjStructured.watch_today.map((w, i) => (
                    <li key={`watch-${i}`}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : parsedWsjData && !(parsedWsjData.login_required === true) ? (
          <p style={{ opacity: 0.85 }}>
            No structured summary yet. Check <code>OPENAI_API_KEY</code> or the response under source data / raw JSON.
          </p>
        ) : null}
        {parsedWsjData ? (
          <>
            <details className="wsj-source-panel">
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Source data (WSJ + quotes)</summary>
            {wsjMarket.length > 0 ? (
              <div className="quotes-grid">
                {wsjMarket.map((m, idx) => (
                  <article className="quote-card" key={`${m.instrument ?? "market"}-${idx}`}>
                    <div className="quote-head">
                      <span className="hl-ticker">{m.instrument ?? "-"}</span>
                      <span className="hl-name">{m.value ?? "-"}</span>
                    </div>
                    <div className="quote-metrics">
                      <div>Change: {m.change ?? "-"}</div>
                      <div>As of: {m.as_of ?? "-"}</div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {wsjEquityFacts.length > 0 ? (
              <div className="quotes-grid">
                {wsjEquityFacts.map((e) => {
                  const q = e.quote;
                  return (
                    <article className="quote-card" key={e.ticker ?? "eq"}>
                      <div className="quote-head">
                        <span className="hl-ticker">{e.ticker ?? "-"}</span>
                        <span className="hl-name">{q?.name ?? q?.Ticker ?? "-"}</span>
                        <span className="pill">{e.source ?? "-"}</span>
                      </div>
                      {q?.ok === false ? (
                        <div className="tone-warn">Error: {q.error}</div>
                      ) : (
                        <div className="quote-metrics">
                          <div>Last close: {q?.last_close ?? "-"}</div>
                          <div>Change: {q?.change_pct ?? "-"}</div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : null}
            {wsjMacroFacts.length > 0 ? (
              <div className="quotes-grid">
                {wsjMacroFacts.map((m) => {
                  const q = m.quote;
                  const sym = m.ticker ?? "-";
                  return (
                    <article className="quote-card" key={sym}>
                      <div className="quote-head">
                        <span className="hl-ticker">{sym}</span>
                        <span className="hl-name">{q?.name ?? "macro"}</span>
                      </div>
                      {q?.ok === false ? (
                        <div className="tone-warn">Error: {q.error}</div>
                      ) : (
                        <div className="quote-metrics">
                          <div>Last close: {q?.last_close ?? "-"}</div>
                          <div>Change: {q?.change_pct ?? "-"}</div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : null}
            {wsjHeadlines.length > 0 ? (
              <div className="event-list">
                {wsjHeadlines.slice(0, 5).map((h, idx) => (
                  <div className="event-row tone-neutral" key={`${h.url ?? "headline"}-${idx}`}>
                    <span className="pill">headline</span>
                    <span className="event-id">{h.title ?? "-"}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {wsjEconomy.length > 0 ? (
              <div className="event-list">
                {wsjEconomy.slice(0, 5).map((h, idx) => (
                  <div className="event-row tone-neutral" key={`${h.url ?? "econ"}-${idx}`}>
                    <span className="pill">economy</span>
                    <span className="event-id">{h.title ?? "-"}</span>
                  </div>
                ))}
              </div>
            ) : null}
            </details>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", opacity: 0.85 }}>Raw JSON (request + response)</summary>
              <pre style={{ marginTop: 8 }}>{JSON.stringify(wsjShotLog, null, 2)}</pre>
            </details>
          </>
        ) : null}
        </CollapsibleSection>
      </div>
      <CollapsibleSection title="NAP Snapshot" defaultOpen>
        {parsedAuditEvents.length > 0 && (
          <div className="event-list">
            {parsedAuditEvents.slice(0, 10).map((ev) => (
              <div className={`event-row ${eventTone(ev.eventType)}`} key={ev.id}>
                <span className="pill">{ev.agentType ?? "unknown-agent"}</span>
                <span className="pill">{ev.eventType ?? "unknown-event"}</span>
                <span className="event-id">{ev.correlationId ?? ev.id}</span>
              </div>
            ))}
          </div>
        )}
        {parsedInboxItems.length > 0 && (
          <div className="event-list">
            {parsedInboxItems.slice(0, 6).map((item) => (
              <div className="event-row tone-neutral" key={item.id}>
                <span className="pill">{item.sourceAgentType ?? "unknown-source"}</span>
                <span className="pill">{item.urgency ?? "medium"}</span>
                <span className="event-id">{item.summary ?? item.id}</span>
              </div>
            ))}
          </div>
        )}
        <pre>{JSON.stringify(stateResult, null, 2)}</pre>
      </CollapsibleSection>
    </main>
  );
}
