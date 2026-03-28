import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBearer, verifyServiceToken } from "@/lib/auth";

function statusForError(error: unknown): number {
  const message = String(error);
  if (message.includes("Invalid service token") || message.includes("Missing bearer token")) {
    return 401;
  }
  return 500;
}

export async function POST(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const body = await request.json();
    const event = await prisma.napAuditEvent.create({
      data: {
        clientKey: body.clientKey,
        agentType: body.agentType,
        eventType: body.eventType,
        correlationId: body.correlationId ?? null,
        inputPayload: body.inputPayload ?? null,
        outputPayload: body.outputPayload ?? null,
        screenshotPath: body.screenshotPath ?? null,
        tokenIn: body.tokenIn ?? 0,
        tokenOut: body.tokenOut ?? 0,
        actionCount: body.actionCount ?? 1,
      },
    });
    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: statusForError(error) });
  }
}

export async function GET(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const url = new URL(request.url);
    const clientKey = url.searchParams.get("clientKey") ?? undefined;
    const events = await prisma.napAuditEvent.findMany({
      where: clientKey ? { clientKey } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: statusForError(error) });
  }
}
