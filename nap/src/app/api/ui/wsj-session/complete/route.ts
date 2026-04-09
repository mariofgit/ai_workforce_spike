import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const base = process.env.FINANCE_ANALYST_BASE_URL ?? "http://localhost:8012";

    const clientKey = typeof body.client_key === "string" ? body.client_key : "demo-client";
    const sessionRef = typeof body.session_ref === "string" ? body.session_ref : "";
    const sessionCookie = typeof body.session_cookie === "string" ? body.session_cookie : "";
    const artifactKind = typeof body.artifact_kind === "string" ? body.artifact_kind : "wsj_session_cookie";

    if (!sessionRef) {
      return NextResponse.json({ ok: false, error: "session_ref_required" }, { status: 400 });
    }

    const response = await fetch(`${base}/wsj-session/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_key: clientKey,
        session_ref: sessionRef,
        session_cookie: sessionCookie,
        artifact_kind: artifactKind,
      }),
    });

    const json = (await response.json().catch(() => ({ parse_error: true }))) as Record<string, unknown>;
    return NextResponse.json(
      { ok: response.ok, status: response.status, data: json },
      { status: response.ok ? 200 : response.status >= 400 ? response.status : 502 },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
