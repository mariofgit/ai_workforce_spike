import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBearer, verifyServiceToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const body = await request.json();
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }
    const existing = await prisma.napAgentRegistry.findUnique({ where: { id } });
    const record = existing
      ? await prisma.napAgentRegistry.update({
          where: { id },
          data: {
            sandboxUrl: body.sandboxUrl ?? null,
            status: body.status ?? "healthy",
            metadata: body.metadata ?? {},
            lastHeartbeat: new Date(),
          },
        })
      : await prisma.napAgentRegistry.create({
          data: {
            id,
            agentType: body.agentType,
            agentName: body.agentName,
            clientKey: body.clientKey,
            sandboxUrl: body.sandboxUrl ?? null,
            status: body.status ?? "healthy",
            metadata: body.metadata ?? {},
          },
        });

    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
  }
}

export async function GET(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const url = new URL(request.url);
    const clientKey = url.searchParams.get("clientKey") ?? undefined;
    const records = await prisma.napAgentRegistry.findMany({
      where: clientKey ? { clientKey } : undefined,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
  }
}
