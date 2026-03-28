import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sdrBaseUrl = process.env.SDR_BASE_URL ?? "http://localhost:8010";

    const response = await fetch(`${sdrBaseUrl}/lead-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: body.lead_id,
        text: body.text,
        channel: "whatsapp",
        client_key: body.client_key ?? "demo-client",
      }),
    });

    const json = await response.json();
    return NextResponse.json({ ok: response.ok, data: json }, { status: response.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
