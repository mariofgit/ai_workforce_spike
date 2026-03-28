import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const base = process.env.FINANCE_ANALYST_BASE_URL ?? "http://localhost:8012";

    const clientKey = typeof body.client_key === "string" ? body.client_key : "demo-client";
    const snapshotLabel =
      typeof body.snapshot_label === "string" ? body.snapshot_label : "ui-morning-shot";

    let symbols: string[] | undefined;
    if (Array.isArray(body.symbols)) {
      symbols = body.symbols.filter((s): s is string => typeof s === "string");
    } else if (typeof body.symbols_csv === "string" && body.symbols_csv.trim()) {
      symbols = body.symbols_csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const forwardBody = {
      client_key: clientKey,
      snapshot_label: snapshotLabel,
      ...(symbols && symbols.length > 0 ? { symbols } : {}),
    };

    const response = await fetch(`${base}/morning-shot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardBody),
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
