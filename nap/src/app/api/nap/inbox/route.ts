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
    const item = await prisma.napInbox.create({
      data: {
        clientKey: body.clientKey,
        sourceAgentType: body.sourceAgentType,
        targetHumanQueue: body.targetHumanQueue ?? "default",
        category: body.category ?? "general",
        summary: body.summary,
        question: body.question ?? null,
        urgency: body.urgency ?? "medium",
        payload: body.payload ?? {},
      },
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: statusForError(error) });
  }
}

export async function GET(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";
    const clientKey = url.searchParams.get("clientKey") ?? undefined;
    const items = await prisma.napInbox.findMany({
      where: { status, ...(clientKey ? { clientKey } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: statusForError(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));
    const body = await request.json();
    const item = await prisma.napInbox.update({
      where: { id: body.id },
      data: {
        status: body.status ?? "resolved",
        resolvedBy: body.resolvedBy ?? null,
        resolvedAt: body.status === "resolved" ? new Date() : null,
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: statusForError(error) });
  }
}
