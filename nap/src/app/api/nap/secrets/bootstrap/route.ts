import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBearer, verifyServiceToken } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const body = await request.json();
    const clientKey = String(body.clientKey || "");
    const agentType = String(body.agentType || "");
    if (!clientKey || !agentType) {
      return NextResponse.json({ ok: false, error: "clientKey and agentType are required" }, { status: 400 });
    }

    const rows = await prisma.napAgentSecret.findMany({
      where: { clientKey, agentType, isActive: true },
    });

    const secrets = Object.fromEntries(rows.map((row) => [row.secretName, decryptSecret(row.encryptedBlob)]));
    return NextResponse.json({ ok: true, secrets });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
  }
}
