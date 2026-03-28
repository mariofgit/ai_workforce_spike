import { NextResponse } from "next/server";

export async function GET() {
  try {
    const crmBaseUrl = process.env.CRM_CLERK_BASE_URL ?? "http://localhost:8011";
    const response = await fetch(`${crmBaseUrl}/activity`, { cache: "no-store" });
    const json = (await response.json().catch(() => ({ parse_error: true }))) as Record<string, unknown>;
    return NextResponse.json(
      { ok: response.ok, status: response.status, data: json },
      { status: response.ok ? 200 : response.status >= 400 ? response.status : 502 },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
