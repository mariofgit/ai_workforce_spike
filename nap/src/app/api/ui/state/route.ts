import { NextResponse } from "next/server";

import { napSelfOrigin } from "@/lib/nap-self-origin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientKey = url.searchParams.get("clientKey") ?? "demo-client";
    const token = process.env.NAP_SERVICE_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: "NAP_SERVICE_TOKEN missing in NAP env" }, { status: 500 });
    }

    const origin = napSelfOrigin();
    const auth = { Authorization: `Bearer ${token}` };
    const [auditRes, inboxRes] = await Promise.all([
      fetch(`${origin}/api/nap/audit?clientKey=${encodeURIComponent(clientKey)}`, {
        headers: auth,
      }),
      fetch(
        `${origin}/api/nap/inbox?status=pending&clientKey=${encodeURIComponent(clientKey)}`,
        { headers: auth },
      ),
    ]);

    const [audit, inbox] = await Promise.all([auditRes.json(), inboxRes.json()]);
    return NextResponse.json({ ok: true, audit, inbox });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
