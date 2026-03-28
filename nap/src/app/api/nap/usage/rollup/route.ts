import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBearer, verifyServiceToken } from "@/lib/auth";

type AuditGroup = {
  usageDate: string;
  clientKey: string;
  agentType: string;
  tokenIn: number;
  tokenOut: number;
  actionCount: number;
  eventCount: number;
  escalations: number;
};

export async function POST(request: Request) {
  try {
    verifyServiceToken(requireBearer(request));

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - 1);

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    const events = await prisma.napAuditEvent.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    const grouped = new Map<string, AuditGroup>();
    for (const event of events) {
      const usageDate = startDate.toISOString().slice(0, 10);
      const key = `${usageDate}|${event.clientKey}|${event.agentType}`;
      const prev = grouped.get(key) ?? {
        usageDate,
        clientKey: event.clientKey,
        agentType: event.agentType,
        tokenIn: 0,
        tokenOut: 0,
        actionCount: 0,
        eventCount: 0,
        escalations: 0,
      };
      prev.tokenIn += event.tokenIn;
      prev.tokenOut += event.tokenOut;
      prev.actionCount += event.actionCount;
      prev.eventCount += 1;
      if (event.eventType.includes("escalation")) prev.escalations += 1;
      grouped.set(key, prev);
    }

    const upserts = [];
    for (const row of grouped.values()) {
      upserts.push(
        prisma.napUsageDaily.upsert({
          where: {
            usageDate_clientKey_agentType: {
              usageDate: new Date(row.usageDate),
              clientKey: row.clientKey,
              agentType: row.agentType,
            },
          },
          update: {
            tokenIn: row.tokenIn,
            tokenOut: row.tokenOut,
            actionCount: row.actionCount,
            eventCount: row.eventCount,
            escalations: row.escalations,
          },
          create: {
            usageDate: new Date(row.usageDate),
            clientKey: row.clientKey,
            agentType: row.agentType,
            tokenIn: row.tokenIn,
            tokenOut: row.tokenOut,
            actionCount: row.actionCount,
            eventCount: row.eventCount,
            escalations: row.escalations,
          },
        }),
      );
    }

    await Promise.all(upserts);
    return NextResponse.json({ ok: true, processed: grouped.size });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 401 });
  }
}
