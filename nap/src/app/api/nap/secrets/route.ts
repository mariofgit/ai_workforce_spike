import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBearer, verifyServiceToken } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const body = await request.json();
    const row = await prisma.napAgentSecret.upsert({
      where: {
        agentType_clientKey_secretName: {
          agentType: body.agentType,
          clientKey: body.clientKey,
          secretName: body.secretName,
        },
      },
      update: {
        encryptedBlob: encryptSecret(String(body.secretValue ?? "")),
        isActive: body.isActive ?? true,
      },
      create: {
        agentType: body.agentType,
        clientKey: body.clientKey,
        secretName: body.secretName,
        encryptedBlob: encryptSecret(String(body.secretValue ?? "")),
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 });
  }
}
