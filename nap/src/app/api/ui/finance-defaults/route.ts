import { NextResponse } from "next/server";

export async function GET() {
  const csv = process.env.FINANCE_DEFAULT_SYMBOLS ?? "NVDA,AMD,ARM";
  return NextResponse.json({ ok: true, symbolsCsv: csv });
}
